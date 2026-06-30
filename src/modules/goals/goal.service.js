import { Goal } from './goal.model.js';
import { Transaction } from '../transactions/transaction.model.js';
import { HttpError } from '../../common/api/http.js';
import { goalThemeAt } from './goalThemes.js';

/**
 * Keep `completedAt` in sync with saved/target on a hydrated goal doc (does NOT
 * save). Sets it the first time saved >= target; clears it if saved drops back
 * below target (e.g. a contribution was deleted). Returns true if it crossed
 * INTO completion on this call (so callers can flag a celebration).
 */
function syncCompletion(goal) {
  const reached = goal.saved >= goal.target;
  if (reached && !goal.completedAt) {
    goal.completedAt = new Date();
    return true;
  }
  if (!reached && goal.completedAt) {
    goal.completedAt = null;
  }
  return false;
}

/** Active goals for a user, newest intent first (by order then recency). */
export function listGoals(userId) {
  return Goal.find({ userId, isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
}

/** Create a goal. Theme is taken from the request (a suggestion) or cycled by count. */
export async function createGoal(userId, data) {
  const count = await Goal.countDocuments({ userId, isActive: true });
  const theme = goalThemeAt(typeof data.theme === 'number' ? data.theme : count);
  const goal = await Goal.create({
    userId,
    name: (data.name || '').trim() || 'New goal',
    emoji: data.emoji || '🎯',
    target: data.target,
    saved: Math.min(data.saved ?? 0, data.target),
    accent: theme.accent,
    bg: theme.bg,
    border: theme.border,
    order: count,
  });
  return goal.toObject();
}

/**
 * Update a goal. Supports editing name/emoji/target and either an absolute
 * `saved` or a relative `addAmount` contribution (clamped at >= 0). `target`
 * changes re-clamp nothing — over-funding is allowed (a goal can hit 100%+).
 */
export async function updateGoal(userId, id, patch) {
  const goal = await Goal.findOne({ _id: id, userId, isActive: true });
  if (!goal) return null;

  if (patch.name !== undefined) goal.name = patch.name.trim() || goal.name;
  if (patch.emoji !== undefined) goal.emoji = patch.emoji;
  if (patch.target !== undefined) goal.target = patch.target;
  if (patch.saved !== undefined) goal.saved = Math.max(0, patch.saved);
  if (patch.addAmount !== undefined) goal.saved = Math.max(0, goal.saved + patch.addAmount);

  syncCompletion(goal); // target/saved edits can flip completion either way
  await goal.save();
  return goal.toObject();
}

/**
 * Goal funding accounting (mirrors balance.service's apply/reverse pattern).
 *
 * Money added to a goal is recorded as a DRAFT (needs_review) transaction on the
 * chosen bank/cash account (created in transaction.service). GOAL PROGRESS is
 * decoupled from bank-balance timing: goal.saved is updated IMMEDIATELY when the
 * contribution is created (so the progress bar moves on add), while the bank
 * balance still only changes when the linked txn is confirmed. The activity log
 * still surfaces each contribution's bank-side status (pending/confirmed). The
 * txn's `goalApplied` flag makes apply/reverse idempotent (no double counting):
 * apply runs once at creation; confirm is a no-op; delete reverses it.
 */

/** Apply a contribution onto goal.saved. Idempotent via the txn's goalApplied flag. */
export async function applyGoalForTransaction(userId, txnId) {
  const txn = await Transaction.findOne({ _id: txnId, userId });
  if (!txn || !txn.goalId || txn.goalApplied) return;
  const goal = await Goal.findOne({ _id: txn.goalId, userId, isActive: true });
  if (!goal) return; // goal removed — nothing to credit
  goal.saved = Math.max(0, goal.saved + txn.amount);
  syncCompletion(goal); // mark completedAt the first time it reaches 100%
  await goal.save();
  txn.goalApplied = true;
  await txn.save();
}

/** Reverse a finalized contribution (e.g. if a confirmed contribution is undone). */
export async function reverseGoalForTransaction(userId, txnId) {
  const txn = await Transaction.findOne({ _id: txnId, userId });
  if (!txn || !txn.goalId || !txn.goalApplied) return;
  const goal = await Goal.findOne({ _id: txn.goalId, userId, isActive: true });
  if (goal) {
    goal.saved = Math.max(0, goal.saved - txn.amount);
    syncCompletion(goal); // dropping below target clears completedAt
    await goal.save();
  }
  txn.goalApplied = false;
  await txn.save();
}

/**
 * Contribution activity for a goal's detail view: each linked transaction with
 * date, amount, account and status (pending=needs_review, confirmed). Newest
 * first. Used by the goal sheet's activity log.
 */
export async function listGoalContributions(userId, goalId) {
  const rows = await Transaction.find({ userId, goalId })
    .sort({ occurredAt: -1, createdAt: -1 })
    .select('amount accountName status occurredAt createdAt')
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    amount: r.amount,
    accountName: r.accountName || 'Account',
    status: r.status, // 'needs_review' | 'confirmed'
    occurredAt: r.occurredAt || r.createdAt,
  }));
}

/** Soft-delete a goal so it drops out of listings. */
export async function deleteGoal(userId, id) {
  const goal = await Goal.findOneAndUpdate(
    { _id: id, userId, isActive: true },
    { isActive: false },
    { new: true }
  ).lean();
  return goal;
}
