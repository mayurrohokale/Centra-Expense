import { Transaction } from './transaction.model.js';
import { HttpError } from '../../common/api/http.js';
import { fingerprint } from '../../common/crypto/cryptoService.js';
import { categorize } from '../email-ingestion/categorize.js';
import { applyBalanceForTransaction, reverseBalanceForTransaction, getAccountBalance } from '../accounts/balance.service.js';
import { applyGoalForTransaction, reverseGoalForTransaction } from '../goals/goal.service.js';
import { inr } from '../../common/lib/format.js';

/**
 * Is this a USER-INITIATED outflow we should balance-check? Per product
 * decision, ONLY block manual/cash entries the user creates — manual expenses,
 * transfers (the FROM/source account), and goal contributions. Email/AA-synced
 * rows already happened in the real world, so they are NEVER blocked.
 */
function isUserInitiatedOutflow(data) {
  const userSource = data.source === 'manual' || data.source === 'cash';
  if (!userSource) return false;
  return data.direction === 'debit' || data.direction === 'transfer';
}

/**
 * Throw a 400 if a user-initiated outflow would exceed the source account's
 * available balance. `accountId` is the FROM/source account (= accountId for a
 * debit/transfer). No-op when there's no source account.
 */
export async function assertSufficientBalance(userId, { accountId, amount }) {
  if (!accountId || !(amount > 0)) return;
  const acct = await getAccountBalance(userId, accountId);
  if (!acct) return; // account missing — let downstream handle it
  if (amount > acct.balance) {
    throw new HttpError(
      400,
      `Amount exceeds ${acct.name} balance (${inr(Math.max(0, acct.balance))} available).`
    );
  }
}

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
  // Re-validate balance at confirm time for user-initiated outflows: the source
  // balance may have dropped since the draft was created. Email/AA rows are not
  // blocked. (Read the pending row first so we know its source/direction/amount.)
  const pending = await Transaction.findOne({ _id: id, userId, status: 'needs_review' })
    .select('source direction amount accountId')
    .lean();
  if (pending && isUserInitiatedOutflow(pending)) {
    await assertSufficientBalance(userId, { accountId: pending.accountId, amount: pending.amount });
  }

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
    // Goal contributions are already applied to goal.saved at CREATION time (the
    // progress bar moves immediately on add — see createTransaction). This call
    // is a no-op safety net: applyGoalForTransaction early-returns when
    // goalApplied is already true, so confirm never double-adds. (Kept in case a
    // goal-linked row ever reaches confirm without having been applied.)
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
 * Goal funding: if the row is a goal contribution, undo its effect on goal.saved
 * too. Goal progress is applied at CREATION (decoupled from bank balance), so
 * BOTH a pending draft and a confirmed contribution carry goalApplied=true —
 * deleting either decrements goal.saved (progress bar drops back).
 *
 * Idempotent: reverse helpers clear balanceApplied / goalApplied, and the row
 * is then deleted so it can't be reversed twice.
 */
export async function deleteTransaction(userId, id) {
  const txn = await Transaction.findOne({ _id: id, userId }).lean();
  if (!txn) throw new HttpError(404, 'Transaction not found');
  // Reverse the per-bank balance effect of a confirmed (applied) transaction.
  if (txn.balanceApplied) await reverseBalanceForTransaction(userId, id);
  // Reverse the goal contribution (applied at creation → goalApplied=true for
  // both draft and confirmed), so deleting a contribution drops the progress bar.
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

  // Block user-initiated outflows (manual/cash debit, transfer, goal funding)
  // that exceed the source account's available balance. Email/AA rows skip this
  // — they already happened. Validated at CREATION so the user gets immediate
  // feedback (and goal contributions, which apply to goal.saved on create, can't
  // be added beyond the funding account's balance).
  if (isUserInitiatedOutflow(data)) {
    await assertSufficientBalance(userId, { accountId: data.accountId, amount: data.amount });
  }

  const created = await Transaction.create({ ...data, userId, fingerprint: fp });
  // Manual/cash entries (and any row created already-confirmed) move their
  // account balance immediately. needs_review rows wait until confirmed.
  if (created.status === 'confirmed' && created.accountId) {
    await applyBalanceForTransaction(userId, created._id);
  }
  // GOAL PROGRESS is decoupled from bank-balance timing: a goal contribution
  // (any status, incl. a needs_review draft) is applied to goal.saved IMMEDIATELY
  // on creation so the progress bar moves the moment money is added. The bank
  // balance still only changes on confirm (above / confirmTransaction). The
  // txn's `goalApplied` flag (set here by applyGoalForTransaction) makes the
  // later confirm idempotent — it won't re-add — and a draft delete reverses it.
  if (created.goalId) {
    await applyGoalForTransaction(userId, created._id);
  }
  // Re-read so the returned object reflects goalApplied=true (and any updates).
  const fresh = await Transaction.findById(created._id).lean();
  return { transaction: fresh || created.toObject(), deduped: false };
}

/** Money in / out / net for the current month-style summary card. */
export async function getSummary(userId) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [rows, addedToday] = await Promise.all([
    Transaction.aggregate([
      // Loan principal/repayments (loanId set) are NOT income/expense — excluded,
      // mirroring how transfers (direction 'transfer') fall outside debit/credit.
      { $match: { userId, status: 'confirmed', loanId: null } },
      { $group: { _id: '$direction', total: { $sum: '$amount' } } },
    ]),
    // Any transaction logged today (added or dated today, any status) — powers
    // the in-app "add today's transactions" reminder so it doesn't nag once the
    // user has already logged something.
    Transaction.countDocuments({
      userId,
      $or: [{ createdAt: { $gte: dayStart } }, { occurredAt: { $gte: dayStart } }],
    }),
  ]);
  const income = rows.find((r) => r._id === 'credit')?.total || 0;
  const expenses = rows.find((r) => r._id === 'debit')?.total || 0;
  return { income, expenses, savings: income - expenses, addedToday };
}

/** Spend grouped by category for the "Where it went" bar chart. */
export async function getCategoryBreakdown(userId) {
  return Transaction.aggregate([
    // Exclude loan-linked debits (repayments / lending) — not real spending.
    { $match: { userId, direction: 'debit', status: 'confirmed', loanId: null } },
    { $group: { _id: '$categoryKey', amount: { $sum: '$amount' } } },
    { $sort: { amount: -1 } },
  ]);
}
