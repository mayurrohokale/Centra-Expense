import { Holding } from './holding.model.js';
import { HttpError } from '../../common/api/http.js';
import { getSpotPricesForIds, getUsdInrRate } from '../market-data/crypto.client.js';
import { createTransaction } from '../transactions/transaction.service.js';
import { Account } from '../accounts/account.model.js';

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
 * Enrich lean holdings with LIVE, accurate per-asset values + P/L. Each returned
 * holding gets, in its NATIVE currency:
 *   investedValue, currentValue, pl (= current − invested), plPct
 * and, normalized to ₹ for the portfolio rollup:
 *   investedInr, currentInr, plInr
 * plus flags: priceStale (crypto, price feed down), matured (FD past maturity),
 * excludeFromActive (credited FD — its money now lives in the bank account).
 *
 * Per-asset rules:
 *  - CRYPTO (USD): invested = units×buyPriceUsd (or stored); current = units×spot
 *    USD. No live price → current falls back to invested (0 P/L, never fake gains).
 *  - FD (₹): invested = principal; current = ACCRUED value to-date (quarterly
 *    compounding, capped at maturity). Credited FDs use the maturity value but
 *    are flagged excludeFromActive so the rollup doesn't double-count the bank.
 *  - STOCKS/MF/GOLD/OTHER (₹): invested = stored; current = stored currentValue
 *    if a real one exists, else falls back to invested (0 P/L, no fake gains).
 *
 * `fxRate` (USD→INR) is fetched once and threaded through; pass it to avoid a
 * second lookup when the caller already has it.
 */
export async function valueHoldings(holdings, fxRate) {
  const cryptoIds = holdings
    .filter((h) => h.instrumentType === 'crypto' && h.coinId && h.units != null)
    .map((h) => h.coinId);
  const [spot, fx] = await Promise.all([
    cryptoIds.length ? getSpotPricesForIds(cryptoIds) : Promise.resolve({}),
    fxRate != null ? Promise.resolve(fxRate) : getUsdInrRate(),
  ]);

  return holdings.map((h) => {
    const out = { ...h };
    let invested = Number(h.investedValue) || 0;
    let current = Number(h.currentValue) || 0;

    if (h.instrumentType === 'crypto' && h.coinId && h.units != null) {
      const px = spot[String(h.coinId).toLowerCase()];
      out.spotUsd = px ?? null;
      out.priceStale = px == null;
      // Cost basis in USD (prefer explicit invested, else units×buyPrice).
      invested = Number(h.investedValue) || (h.units * (h.buyPriceUsd || 0));
      current = px != null ? Number((h.units * px).toFixed(2)) : invested; // no price → 0 P/L
      out.currency = 'USD';
    } else if (h.instrumentType === 'fd') {
      const maturity = h.maturityValue ?? fdMaturityValue(h.principal, h.interestRate, h.fdStartDate, h.maturityDate);
      out.maturityValue = maturity;
      invested = Number(h.principal ?? h.investedValue) || 0;
      out.matured = !!(h.maturityDate && new Date() >= new Date(h.maturityDate));
      // Credited FD: value lives in the bank now → flag for exclusion from active
      // totals; show its maturity value for the "matured" history.
      out.excludeFromActive = !!h.maturedCredited;
      current = h.maturedCredited ? maturity : fdAccruedValue(h);
      out.currency = 'INR';
    } else {
      // stocks / mutual_fund / gold / other: no live feed wired → use stored
      // currentValue only when it's a real, distinct figure; else fall back to
      // invested so we never show a fake gain/loss.
      invested = Number(h.investedValue) || 0;
      const stored = Number(h.currentValue);
      current = Number.isFinite(stored) && stored > 0 ? stored : invested;
      out.currency = h.currency || 'INR';
    }

    out.investedValue = invested;
    out.currentValue = current;
    out.pl = Number((current - invested).toFixed(2));
    out.plPct = invested > 0 ? Number((((current - invested) / invested) * 100).toFixed(1)) : 0;

    // ₹-normalized for the rollup (crypto USD → ×fx).
    const k = out.currency === 'USD' ? fx : 1;
    out.investedInr = Math.round(invested * k);
    out.currentInr = Math.round(current * k);
    out.plInr = out.currentInr - out.investedInr;

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

/**
 * Portfolio rollup across ALL asset types (₹). Totals are the sum of per-asset
 * ₹-normalized values from valueHoldings, EXCLUDING credited FDs (their money
 * now lives in the bank account — counting it here would double-count). So:
 *   invested = Σ investedInr (active)
 *   current  = Σ currentInr  (active)
 *   returns  = current − invested
 *   returnsPct = returns / invested × 100   (guarded /0 and !isFinite)
 * This stays internally consistent: Σ per-asset invested = total invested, etc.
 */
export async function getPortfolio(userId) {
  // Process any matured FDs first so their value/credit is reflected.
  await processMaturedFDs(userId);
  const raw = await Holding.find({ userId }).lean();
  const fxRate = await getUsdInrRate();
  const valued = await valueHoldings(raw, fxRate);

  // Active = everything except credited FDs (already reflected in the bank).
  const active = valued.filter((h) => !h.excludeFromActive);

  const invested = active.reduce((s, h) => s + h.investedInr, 0);
  const current = active.reduce((s, h) => s + h.currentInr, 0);
  const returns = current - invested;
  const returnsPctRaw = invested > 0 ? (returns / invested) * 100 : 0;
  const returnsPct = Number.isFinite(returnsPctRaw) ? Number(returnsPctRaw.toFixed(1)) : 0;

  // Allocation by type (₹ current), three headline buckets for the donut.
  const byType = {};
  for (const h of active) byType[h.instrumentType] = (byType[h.instrumentType] || 0) + h.currentInr;
  const pct = (v) => (current > 0 ? Math.round((v / current) * 100) : 0);

  // Matured-FD history summary (excluded from active, shown separately).
  const maturedFds = valued.filter((h) => h.excludeFromActive);
  const maturedTotal = maturedFds.reduce((s, h) => s + (h.maturityValue || h.currentInr), 0);

  return {
    current,
    invested,
    returns,
    returnsPct,
    fxRate,
    allocation: {
      mutual_fund: pct(byType.mutual_fund || 0),
      crypto: pct(byType.crypto || 0),
      fd: pct(byType.fd || 0),
    },
    maturedCount: maturedFds.length,
    maturedTotal,
  };
}
