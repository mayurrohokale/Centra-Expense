import { Holding } from './holding.model.js';
import { HttpError } from '../../common/api/http.js';

export function listHoldings(userId, filter = {}) {
  const q = { userId };
  if (filter.instrumentType) q.instrumentType = filter.instrumentType;
  if (filter.source) q.source = filter.source;
  return Holding.find(q).sort({ instrumentType: 1, createdAt: 1 }).lean();
}

/** Create a manually-added holding (the Invest "Add manually" flow). */
export async function createHolding(userId, data) {
  // currentValue is optional for manual entries — default it to the invested
  // amount (0% gain) when the user doesn't know/enter it yet.
  const currentValue = data.currentValue != null ? data.currentValue : data.investedValue;
  const created = await Holding.create({
    ...data,
    currentValue,
    userId,
    source: 'manual',
    lastSyncedAt: new Date(),
  });
  return created.toObject();
}

/** Update a MANUAL holding (user-scoped). Auto-synced holdings aren't editable here. */
export async function updateHolding(userId, id, patch) {
  const allowed = (({ instrumentType, name, tag, color, subtitle, investedValue, currentValue, units, interestRate }) => ({
    instrumentType, name, tag, color, subtitle, investedValue, currentValue, units, interestRate,
  }))(patch);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

  const holding = await Holding.findOne({ _id: id, userId });
  if (!holding) throw new HttpError(404, 'Holding not found');
  if (holding.source !== 'manual') throw new HttpError(400, 'Only manually-added holdings can be edited here.');

  Object.assign(holding, allowed);
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
  const holdings = await Holding.find({ userId }).lean();
  const invested = holdings.reduce((s, h) => s + h.investedValue, 0);
  const current = holdings.reduce((s, h) => s + h.currentValue, 0);
  const returns = current - invested;

  const byType = { mutual_fund: 0, crypto: 0, fd: 0 };
  for (const h of holdings) byType[h.instrumentType] += h.currentValue;

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
