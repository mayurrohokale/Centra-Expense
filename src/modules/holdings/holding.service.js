import { Holding } from './holding.model.js';

export function listHoldings(userId, filter = {}) {
  const q = { userId };
  if (filter.instrumentType) q.instrumentType = filter.instrumentType;
  return Holding.find(q).sort({ instrumentType: 1, createdAt: 1 }).lean();
}

/** Create a manually-added holding (the Invest "Add manually" flow). */
export async function createHolding(userId, data) {
  const created = await Holding.create({ ...data, userId, source: 'manual', lastSyncedAt: new Date() });
  return created.toObject();
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
