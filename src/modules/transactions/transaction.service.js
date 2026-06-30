import { Transaction } from './transaction.model.js';
import { HttpError } from '../../common/api/http.js';
import { fingerprint } from '../../common/crypto/cryptoService.js';
import { categorize } from '../email-ingestion/categorize.js';
import { applyBalanceForTransaction, reverseBalanceForTransaction } from '../accounts/balance.service.js';
import { applyGoalForTransaction, reverseGoalForTransaction } from '../goals/goal.service.js';

/** Build a query from list filters. segment: all|in|out, source, status, q. */
export async function listTransactions(userId, { segment = 'all', source, status, q } = {}) {
  const query = { userId };
  if (segment === 'in') query.direction = 'credit';
  if (segment === 'out') query.direction = 'debit';
  if (source && source !== 'all') query.source = source;
  if (status) query.status = status;
  if (q) query.merchant = { $regex: q.trim(), $options: 'i' };
  return Transaction.find(query).sort({ occurredAt: -1, createdAt: -1 }).lean();
}

export function listNeedsReview(userId) {
  return Transaction.find({ userId, status: 'needs_review' })
    .sort({ occurredAt: -1 })
    .lean();
}

export async function confirmTransaction(userId, id, patch = {}) {
  const update = { status: 'confirmed' };
  // A user-picked category is a manual override — record it as such.
  if (patch.categoryKey) {
    update.categoryKey = patch.categoryKey;
    update.categorySource = 'manual';
  }
  const confirmed = await Transaction.findOneAndUpdate(
    { _id: id, userId, status: 'needs_review' },
    update,
    { new: true }
  ).lean();
  // Apply the per-bank balance effect only once, on the needs_review→confirmed
  // transition (the findOneAndUpdate matched, so this is that transition).
  // applyBalance is itself idempotent via the txn's balanceApplied flag.
  if (confirmed) {
    await applyBalanceForTransaction(userId, confirmed._id);
    // If this is a goal-funding contribution, finalize it onto goal.saved now
    // (idempotent via the txn's goalApplied flag). Until confirmed it only
    // showed as a pending contribution in the goal's activity log.
    if (confirmed.goalId) await applyGoalForTransaction(userId, confirmed._id);
  }
  return confirmed;
}

/**
 * Delete a transaction — DRAFT or CONFIRMED (auth + user-scoped).
 *
 * Balance reversal: a confirmed transaction has already moved its account
 * balance (balanceApplied=true), so we reverse that effect before removing the
 * row — a deleted debit adds the amount back, a deleted credit subtracts it
 * (reverseBalanceForTransaction). For email-authoritative snapshots an exact
 * reversal isn't possible, so it does a best-effort computed reversal and the
 * next sync re-asserts the true value. Drafts never moved a balance, so the
 * reversal is a no-op for them (guarded by the balanceApplied flag).
 *
 * Goal funding: if the row is a goal contribution, undo its effect on the goal
 * too — a confirmed contribution had been added to goal.saved (goalApplied),
 * so reverse it; a pending one only lived in the activity log and just vanishes.
 *
 * Idempotent: reverse helpers clear balanceApplied / goalApplied, and the row
 * is then deleted so it can't be reversed twice.
 */
export async function deleteTransaction(userId, id) {
  const txn = await Transaction.findOne({ _id: id, userId }).lean();
  if (!txn) throw new HttpError(404, 'Transaction not found');
  // Reverse the per-bank balance effect of a confirmed (applied) transaction.
  if (txn.balanceApplied) await reverseBalanceForTransaction(userId, id);
  // Keep any linked goal consistent: reverse a finalized contribution; a pending
  // one (goalApplied=false) simply disappears from the activity log on delete.
  if (txn.goalId && txn.goalApplied) await reverseGoalForTransaction(userId, id);
  await Transaction.deleteOne({ _id: id, userId });
  return { deleted: true, id: String(id) };
}

// Back-compat alias: the route previously called deleteDraftTransaction.
export const deleteDraftTransaction = deleteTransaction;

/** Edit a transaction (e.g. re-categorize) — works for any of the user's rows. */
export async function updateTransaction(userId, id, patch = {}) {
  const allowed = (({ categoryKey, merchant, icon, iconBg, note }) => ({
    categoryKey, merchant, icon, iconBg, note,
  }))(patch);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
  // Changing the category by hand pins it as a manual choice (won't be
  // overwritten by future auto-categorization backfills).
  if (allowed.categoryKey) allowed.categorySource = 'manual';
  return Transaction.findOneAndUpdate({ _id: id, userId }, allowed, { new: true }).lean();
}

/**
 * Backfill auto-categorization onto existing transactions that were never
 * auto-categorized (categorySource missing or 'default') and were not manually
 * set. Rule-based only (no AI), so it's cheap and safe to run on every sync.
 * Returns the number of rows updated.
 */
export async function recategorizeUncategorized(userId) {
  const rows = await Transaction.find({
    userId,
    $or: [
      { categorySource: { $exists: false } },
      { categorySource: null },
      { categorySource: 'default' },
    ],
  }).select('merchant direction categoryKey categorySource').lean();

  let updated = 0;
  for (const r of rows) {
    const next = categorize(r.merchant, r.direction);
    // Only write when it actually resolves to something (or stamps the source),
    // so we don't churn rows that legitimately stay 'other'.
    if (next.categoryKey !== r.categoryKey || r.categorySource !== next.categorySource) {
      await Transaction.updateOne(
        { _id: r._id, userId },
        { $set: {
          categoryKey: next.categoryKey,
          icon: next.icon,
          iconBg: next.iconBg,
          categorySource: next.categorySource,
        } }
      );
      updated += 1;
    }
  }
  return updated;
}

/**
 * Idempotent create. If a fingerprint is supplied (email / aa_sync), an
 * existing match is returned instead of inserting a duplicate.
 */
export async function createTransaction(userId, data) {
  const fp = data.fingerprint
    || (data.source === 'email' || data.source === 'aa_sync'
      ? fingerprint([userId, data.source, data.merchant, data.amount, data.occurredAt])
      : null);

  if (fp) {
    const existing = await Transaction.findOne({ fingerprint: fp }).lean();
    if (existing) return { transaction: existing, deduped: true };
  }

  const created = await Transaction.create({ ...data, userId, fingerprint: fp });
  // Manual/cash entries (and any row created already-confirmed) move their
  // account balance immediately. needs_review rows wait until confirmed.
  if (created.status === 'confirmed' && created.accountId) {
    await applyBalanceForTransaction(userId, created._id);
  }
  return { transaction: created.toObject(), deduped: false };
}

/** Money in / out / net for the current month-style summary card. */
export async function getSummary(userId) {
  const rows = await Transaction.aggregate([
    { $match: { userId, status: 'confirmed' } },
    { $group: { _id: '$direction', total: { $sum: '$amount' } } },
  ]);
  const income = rows.find((r) => r._id === 'credit')?.total || 0;
  const expenses = rows.find((r) => r._id === 'debit')?.total || 0;
  return { income, expenses, savings: income - expenses };
}

/** Spend grouped by category for the "Where it went" bar chart. */
export async function getCategoryBreakdown(userId) {
  return Transaction.aggregate([
    { $match: { userId, direction: 'debit', status: 'confirmed' } },
    { $group: { _id: '$categoryKey', amount: { $sum: '$amount' } } },
    { $sort: { amount: -1 } },
  ]);
}
