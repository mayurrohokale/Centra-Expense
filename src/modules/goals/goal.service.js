import { Goal } from './goal.model.js';
import { Transaction } from '../transactions/transaction.model.js';
import { HttpError } from '../../common/api/http.js';
import { goalThemeAt } from './goalThemes.js';

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

  await goal.save();
  return goal.toObject();
}

/**
 * Goal funding accounting (mirrors balance.service's apply/reverse pattern).
 *
 * Money added to a goal is recorded as a DRAFT (needs_review) transaction on the
 * chosen bank/cash account (created in transaction.service). The goal's `saved`
 * total is the sum of CONFIRMED contributions only — pending drafts show in the
 * activity log but don't inflate the progress bar until confirmed. The txn's
 * `goalApplied` flag makes apply/reverse idempotent (no double counting).
 */

/** Finalize a contribution onto goal.saved when its linked txn is confirmed. */
export async function applyGoalForTransaction(userId, txnId) {
  const txn = await Transaction.findOne({ _id: txnId, userId });
  if (!txn || !txn.goalId || txn.goalApplied) return;
  const goal = await Goal.findOne({ _id: txn.goalId, userId, isActive: true });
  if (!goal) return; // goal removed — nothing to credit
  goal.saved = Math.max(0, goal.saved + txn.amount);
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
