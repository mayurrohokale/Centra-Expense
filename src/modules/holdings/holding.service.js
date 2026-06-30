import { Holding } from './holding.model.js';
import { HttpError } from '../../common/api/http.js';
import { getSpotPricesForIds } from '../market-data/crypto.client.js';
import { createTransaction } from '../transactions/transaction.service.js';
import { Account } from '../accounts/account.model.js';

// Approximate USD→INR for the (₹-denominated) portfolio ROLLUP only. There's no
// live FX feed wired, so crypto USD amounts are converted with this constant to
// keep the portfolio total meaningful. The crypto CARDS still show true USD.
// NOTE: refine with a live FX rate if/when one is added.
const USD_INR = 83;

/**
 * FD maturity value with QUARTERLY compounding (user decision):
 *   maturity = principal × (1 + rate/400)^(4 × years)
 * `years` is derived from start→maturity dates. Returns rounded ₹.
 */
export function fdMaturityValue(principal, ratePct, startDate, maturityDate) {
  const p = Number(principal) || 0;
  const r = Number(ratePct) || 0;
  if (p <= 0 || r <= 0 || !startDate || !maturityDate) return p;
  const years = (new Date(maturityDate).getTime() - new Date(startDate).getTime()) / (365.25 * 86400000);
  if (years <= 0) return p;
  return Math.round(p * Math.pow(1 + r / 400, 4 * years));
}

/** Accrued FD value as of `asOf` (quarterly compounding, capped at maturity). */
export function fdAccruedValue(holding, asOf = new Date()) {
  const { principal, interestRate, fdStartDate, maturityDate } = holding;
  if (!principal || !interestRate || !fdStartDate) return holding.currentValue || principal || 0;
  const end = maturityDate && new Date(asOf) > new Date(maturityDate) ? new Date(maturityDate) : new Date(asOf);
  return fdMaturityValue(principal, interestRate, fdStartDate, end);
}

export function listHoldings(userId, filter = {}) {
  const q = { userId };
  if (filter.instrumentType) q.instrumentType = filter.instrumentType;
  if (filter.source) q.source = filter.source;
  return Holding.find(q).sort({ instrumentType: 1, createdAt: 1 }).lean();
}

/**
 * Enrich lean holdings with LIVE values that aren't stored:
 *  - crypto (currency USD, has coinId+units): currentValue = units × spot USD
 *    (also exposes spotUsd + computed P/L). Falls back to stored currentValue
 *    when the price feed is unavailable.
 *  - FD: currentValue reflects the accrued (or matured) value; maturityValue is
 *    surfaced for display.
 * Returns plain objects safe for the API.
 */
export async function valueHoldings(holdings) {
  const cryptoIds = holdings
    .filter((h) => h.instrumentType === 'crypto' && h.coinId && h.units != null)
    .map((h) => h.coinId);
  const spot = cryptoIds.length ? await getSpotPricesForIds(cryptoIds) : {};

  return holdings.map((h) => {
    const out = { ...h };
    if (h.instrumentType === 'crypto' && h.coinId && h.units != null) {
      const px = spot[String(h.coinId).toLowerCase()];
      out.spotUsd = px ?? null;
      out.priceStale = px == null; // couldn't refresh → using cost/last value
      if (px != null) out.currentValue = Number((h.units * px).toFixed(2));
      // currency stays USD; investedValue is the USD cost basis.
    } else if (h.instrumentType === 'fd') {
      out.maturityValue = h.maturityValue ?? fdMaturityValue(h.principal, h.interestRate, h.fdStartDate, h.maturityDate);
      // Show accrued-to-date as the current value (matured → maturity value).
      out.currentValue = h.maturedCredited ? out.maturityValue : fdAccruedValue(h);
    }
    return out;
  });
}

/**
 * Lazy maturity processing (no cron): for every manual FD whose maturityDate has
 * passed and that hasn't been credited yet, post a CONFIRMED income credit of the
 * maturity value to the linked bank account and mark the FD credited. Idempotent
 * via `maturedCredited` (never double-credits). Called from the holdings/portfolio
 * GETs so it runs on app load whenever investments/accounts are fetched.
 */
export async function processMaturedFDs(userId, now = new Date()) {
  const due = await Holding.find({
    userId,
    instrumentType: 'fd',
    source: 'manual',
    maturedCredited: { $ne: true },
    maturityDate: { $ne: null, $lte: now },
  });

  let credited = 0;
  for (const fd of due) {
    const value = fd.maturityValue || fdMaturityValue(fd.principal, fd.interestRate, fd.fdStartDate, fd.maturityDate);
    // Mark credited FIRST (idempotency): if the credit below partially fails on a
    // retry, we won't double-post. The flag flip + value snapshot are atomic-ish.
    fd.maturedCredited = true;
    fd.maturityValue = value;
    fd.currentValue = value;
    await fd.save();

    if (fd.creditAccountId && value > 0) {
      const acct = await Account.findOne({ _id: fd.creditAccountId, userId }).lean();
      await createTransaction(userId, {
        accountId: fd.creditAccountId,
        accountName: acct?.name || '',
        source: 'manual',
        status: 'confirmed', // applies to balance + counts as income immediately
        direction: 'credit',
        amount: value,
        currency: 'INR',
        merchant: `FD Maturity: ${fd.name}`,
        categoryKey: 'income',
        categorySource: 'manual',
        icon: '🏦',
        iconBg: '#EAF7EF',
        occurredAt: fd.maturityDate || now,
      });
    }
    credited += 1;
  }
  return credited;
}

/** Create a manually-added holding (the Invest "Add manually" flow). */
export async function createHolding(userId, data) {
  // currentValue is optional for manual entries — default it to the invested
  // amount (0% gain) when the user doesn't know/enter it yet.
  const doc = { ...data, userId, source: 'manual', lastSyncedAt: new Date() };

  if (data.instrumentType === 'crypto' && data.coinId && data.units != null) {
    // Crypto: USD, cost basis = units × buyPriceUsd (or provided investedValue).
    doc.currency = 'USD';
    const cost = data.investedValue != null
      ? data.investedValue
      : (data.buyPriceUsd != null ? Number((data.units * data.buyPriceUsd).toFixed(2)) : 0);
    doc.investedValue = cost;
    doc.currentValue = data.currentValue != null ? data.currentValue : cost; // live-recomputed on read
  } else if (data.instrumentType === 'fd') {
    // FD: principal = invested; project maturity value (quarterly compounding).
    doc.currency = 'INR';
    doc.investedValue = data.principal != null ? data.principal : data.investedValue;
    doc.maturityValue = fdMaturityValue(doc.investedValue, data.interestRate, data.fdStartDate, data.maturityDate);
    doc.currentValue = data.currentValue != null ? data.currentValue : doc.investedValue;
    doc.maturedCredited = false;
  } else {
    doc.currency = 'INR';
    doc.currentValue = data.currentValue != null ? data.currentValue : data.investedValue;
  }

  const created = await Holding.create(doc);
  return created.toObject();
}

/** Update a MANUAL holding (user-scoped). Auto-synced holdings aren't editable here. */
export async function updateHolding(userId, id, patch) {
  const allowed = (({
    instrumentType, name, tag, color, subtitle, investedValue, currentValue, units, interestRate,
    coinId, buyPriceUsd, purchaseDate, principal, fdStartDate, maturityDate, creditAccountId,
  }) => ({
    instrumentType, name, tag, color, subtitle, investedValue, currentValue, units, interestRate,
    coinId, buyPriceUsd, purchaseDate, principal, fdStartDate, maturityDate, creditAccountId,
  }))(patch);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

  const holding = await Holding.findOne({ _id: id, userId });
  if (!holding) throw new HttpError(404, 'Holding not found');
  if (holding.source !== 'manual') throw new HttpError(400, 'Only manually-added holdings can be edited here.');

  Object.assign(holding, allowed);

  // Recompute derived values after an edit.
  if (holding.instrumentType === 'crypto' && holding.units != null && holding.buyPriceUsd != null && allowed.investedValue === undefined) {
    holding.investedValue = Number((holding.units * holding.buyPriceUsd).toFixed(2));
  }
  if (holding.instrumentType === 'fd') {
    if (holding.principal != null) holding.investedValue = holding.principal;
    holding.maturityValue = fdMaturityValue(holding.investedValue, holding.interestRate, holding.fdStartDate, holding.maturityDate);
  }

  await holding.save();
  return holding.toObject();
}

/** Delete a MANUAL holding (user-scoped). Auto-synced holdings aren't deletable here. */
export async function deleteHolding(userId, id) {
  const holding = await Holding.findOne({ _id: id, userId }).lean();
  if (!holding) throw new HttpError(404, 'Holding not found');
  if (holding.source !== 'manual') throw new HttpError(400, 'Only manually-added holdings can be deleted here.');
  await Holding.deleteOne({ _id: id, userId });
  return { deleted: true, id: String(id) };
}

/** Portfolio rollup: current, invested, returns, simple allocation + naive XIRR proxy. */
export async function getPortfolio(userId) {
  // Process any matured FDs first so their value/credit is reflected.
  await processMaturedFDs(userId);
  const raw = await Holding.find({ userId }).lean();
  const holdings = await valueHoldings(raw);
  // Convert each holding to ₹ for the rollup (crypto is USD → ×USD_INR).
  const toInr = (h, v) => (h.currency === 'USD' ? v * USD_INR : v);
  const invested = holdings.reduce((s, h) => s + toInr(h, h.investedValue), 0);
  const current = holdings.reduce((s, h) => s + toInr(h, h.currentValue), 0);
  const returns = current - invested;

  const byType = { mutual_fund: 0, crypto: 0, fd: 0 };
  for (const h of holdings) byType[h.instrumentType] = (byType[h.instrumentType] || 0) + toInr(h, h.currentValue);

  const pct = (v) => (current > 0 ? Math.round((v / current) * 100) : 0);

  return {
    current,
    invested,
    returns,
    returnsPct: invested > 0 ? Number(((returns / invested) * 100).toFixed(1)) : 0,
    allocation: {
      mutual_fund: pct(byType.mutual_fund),
      crypto: pct(byType.crypto),
      fd: pct(byType.fd),
    },
  };
}
