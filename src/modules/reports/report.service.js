import mongoose from 'mongoose';
import { Transaction } from '../transactions/transaction.model.js';
import { Account } from '../accounts/account.model.js';
import { Category } from '../categories/category.model.js';
import { normalizeMerchant } from '../email-ingestion/categorize.js';

/**
 * Reports / spending-analytics aggregation (Feature: Reports page).
 *
 * One user-scoped read → { period, summary, byCategory, topMerchants, trend,
 * byAccount, incomeVsExpense }. Only CONFIRMED transactions count (drafts /
 * needs_review are excluded). Debits = spending, credits = income.
 *
 * Computed with MongoDB aggregation (group by category / accountId / date
 * bucket) plus a small JS merge for merchants so we can normalize "ZOMATO" /
 * "zomato@hdfc" together using the SAME normalizer the categorizer uses.
 */

const TZ = 'Asia/Kolkata';

function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

/**
 * Resolve a period key (or custom from/to) into the current window, the
 * matching previous window (for deltas), the trend bucket, and a label.
 * Windows are [start, end) — end is exclusive.
 */
export function resolvePeriod(period, fromStr, toStr) {
  const now = new Date();
  let start; let end; let prevStart; let prevEnd; let bucket; let label;

  switch (period) {
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = monthStart(now);
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      prevEnd = start; bucket = 'day'; label = 'Last month';
      break;
    }
    case 'last_3_months': {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
      prevEnd = start; bucket = 'month'; label = 'Last 3 months';
      break;
    }
    case 'this_year': {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = start; bucket = 'month'; label = 'This year';
      break;
    }
    case 'custom': {
      start = fromStr ? new Date(fromStr) : monthStart(now);
      // include the whole `to` day (exclusive end at next midnight)
      end = toStr ? new Date(new Date(toStr).getTime() + 86400000) : new Date();
      if (!(start < end)) { start = monthStart(now); end = new Date(); }
      const len = end - start;
      prevEnd = start; prevStart = new Date(start.getTime() - len);
      bucket = len / 86400000 > 62 ? 'month' : 'day'; label = 'Custom';
      break;
    }
    case 'this_month':
    default: {
      start = monthStart(now);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = start; bucket = 'day'; label = 'This month';
    }
  }
  return { start, end, prevStart, prevEnd, bucket, label };
}

function matchStage(uid, start, end, extra = {}) {
  // `loanId: null` excludes loan principal/repayment txns from ALL report
  // aggregations (income, spend, by-category, by-account, merchants, trend) —
  // a loan received isn't income and a repayment isn't a normal expense. This is
  // the loan analogue of transfers being excluded by their 'transfer' direction.
  return { userId: uid, status: 'confirmed', loanId: null, occurredAt: { $gte: start, $lt: end }, ...extra };
}

/** Money in / out / count for a window. */
async function windowTotals(uid, start, end) {
  const rows = await Transaction.aggregate([
    { $match: matchStage(uid, start, end) },
    { $group: { _id: '$direction', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const spent = rows.find((r) => r._id === 'debit')?.amount || 0;
  const received = rows.find((r) => r._id === 'credit')?.amount || 0;
  const count = rows.reduce((s, r) => s + r.count, 0);
  return { spent, received, count };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function trendLabel(key, bucket) {
  // key is 'YYYY-MM-DD' (day) or 'YYYY-MM' (month)
  const parts = key.split('-');
  if (bucket === 'month') return MONTHS[Number(parts[1]) - 1] || key;
  return String(Number(parts[2])); // day-of-month
}

export async function getReport(userId, { period = 'this_month', from, to } = {}) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const { start, end, prevStart, prevEnd, bucket, label } = resolvePeriod(period, from, to);

  const [cur, prev, catRows, acctRows, merchRows, trendRows, cats, accounts] = await Promise.all([
    windowTotals(uid, start, end),
    windowTotals(uid, prevStart, prevEnd),
    // by category (debits)
    Transaction.aggregate([
      { $match: matchStage(uid, start, end, { direction: 'debit' }) },
      { $group: { _id: '$categoryKey', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
    // by account (debits)
    Transaction.aggregate([
      { $match: matchStage(uid, start, end, { direction: 'debit' }) },
      { $group: { _id: '$accountId', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
    // by {category, merchant} (debits) — powers both global top-merchants and
    // per-category drill-down after JS normalization/merge.
    Transaction.aggregate([
      { $match: matchStage(uid, start, end, { direction: 'debit' }) },
      { $group: { _id: { cat: '$categoryKey', m: '$merchant' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    // spend trend bucketed by day or month
    Transaction.aggregate([
      { $match: matchStage(uid, start, end, { direction: 'debit' }) },
      { $group: { _id: { $dateToString: { format: bucket === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$occurredAt', timezone: TZ } }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Category.find({ userId: uid }).lean(),
    Account.find({ userId: uid }).lean(),
  ]);

  const catMeta = Object.fromEntries(cats.map((c) => [c.key, c]));
  const acctMeta = Object.fromEntries(accounts.map((a) => [String(a._id), a]));
  const spent = cur.spent || 0;

  const byCategory = catRows.map((r) => {
    const meta = catMeta[r._id] || {};
    return {
      key: r._id || 'other',
      label: meta.label || r._id || 'Other',
      emoji: meta.emoji || '🏷️',
      color: meta.color || '#9b94a8',
      amount: r.amount,
      count: r.count,
      pct: spent > 0 ? Math.round((r.amount / spent) * 1000) / 10 : 0,
    };
  });

  const byAccount = acctRows.map((r) => {
    const meta = acctMeta[String(r._id)] || {};
    return {
      accountId: r._id ? String(r._id) : null,
      name: meta.name || 'Unlinked',
      logo: meta.logo || '•',
      color: meta.color || '#9b94a8',
      amount: r.amount,
      count: r.count,
      pct: spent > 0 ? Math.round((r.amount / spent) * 1000) / 10 : 0,
    };
  });

  // Merge merchants by NORMALIZED name (keep the highest-count raw as display).
  const globalMerch = new Map();
  const perCat = new Map(); // categoryKey → Map(normalized → {…})
  for (const r of merchRows) {
    const raw = r._id.m || 'Unknown';
    const norm = normalizeMerchant(raw) || raw.toLowerCase();
    const bump = (map, key) => {
      const cur2 = map.get(key) || { display: raw, displayCount: 0, amount: 0, count: 0 };
      cur2.amount += r.amount;
      cur2.count += r.count;
      if (r.count > cur2.displayCount) { cur2.display = raw; cur2.displayCount = r.count; }
      map.set(key, cur2);
    };
    bump(globalMerch, norm);
    if (!perCat.has(r._id.cat)) perCat.set(r._id.cat, new Map());
    bump(perCat.get(r._id.cat), norm);
  }
  const sortTop = (map, n) => [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n)
    .map((x) => ({ merchant: x.display, amount: x.amount, count: x.count }));

  const topMerchants = sortTop(globalMerch, 10);
  // attach per-category top-3 merchants for drill-down
  for (const c of byCategory) {
    c.topMerchants = perCat.has(c.key) ? sortTop(perCat.get(c.key), 3) : [];
  }

  const trend = trendRows.map((r) => ({ key: r._id, label: trendLabel(r._id, bucket), amount: r.amount }));

  const prevSpent = prev.spent || 0;
  const spendDeltaPct = prevSpent > 0
    ? Math.round(((spent - prevSpent) / prevSpent) * 1000) / 10
    : (spent > 0 ? 100 : 0);

  return {
    period: { key: period, label, start, end, bucket },
    summary: {
      spent,
      received: cur.received || 0,
      net: (cur.received || 0) - spent,
      count: cur.count || 0,
      prevSpent,
      spendDeltaPct,
    },
    byCategory,
    topMerchants,
    trend,
    byAccount,
    incomeVsExpense: { income: cur.received || 0, expense: spent },
  };
}
