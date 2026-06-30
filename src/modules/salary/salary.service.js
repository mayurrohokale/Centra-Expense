import { Transaction } from '../transactions/transaction.model.js';
import { Account } from '../accounts/account.model.js';
import { User } from '../users/user.model.js';
import { HttpError } from '../../common/api/http.js';
import { createTransaction } from '../transactions/transaction.service.js';

/**
 * Salary tracking service.
 *
 * Model recap (no new collection):
 *  - The designated salary account + expected amount + expected credit day live
 *    on `user.salary` ({ accountId, amount, payDay }).
 *  - A month is "credited" iff an income (credit) transaction with
 *    `isSalary:true` exists for that user in that calendar month. This is the
 *    single source of truth, so auto-detected and manually-ticked salary share
 *    one idempotency check and a month can never be double-counted.
 *
 * Salary credits flow through the SAME draft/confirm + balance machinery as any
 * other transaction (createTransaction → applyBalanceForTransaction), so the
 * salary account balance and the reports income figure stay exact.
 */

// ±15% tolerance band for matching an email credit to the expected salary.
const SALARY_TOLERANCE = 0.15;
// Narration keywords that strongly indicate a salary credit.
const SALARY_KEYWORDS = /\bsalary\b|\bsal\b|payroll|\bsalry\b|neft.*salary|salary.*neft|monthly pay|\bwages\b|\bstipend\b/i;

/** [start, end) for the calendar month containing `d` (local time). */
export function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

/** "YYYY-MM" key for a date (used for labels / logging). */
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Does an amount fall within tolerance of the expected salary? Used by
 * auto-detect. Returns false if no expected amount is configured.
 */
export function withinSalaryTolerance(amount, expected, tol = SALARY_TOLERANCE) {
  if (!expected || expected <= 0) return false;
  const diff = Math.abs(amount - expected) / expected;
  return diff <= tol;
}

/**
 * Heuristic: should this parsed CREDIT on the salary account be treated as the
 * month's salary? True when the narration mentions salary/payroll OR the amount
 * is within tolerance of the expected salary. Caller has already confirmed the
 * txn is a credit landing on the salary account.
 */
export function looksLikeSalary({ amount, merchant }, expectedAmount) {
  const text = String(merchant || '');
  if (SALARY_KEYWORDS.test(text)) return true;
  return withinSalaryTolerance(amount, expectedAmount);
}

/** The income (credit) salary row for a given month, if any. */
export async function findSalaryTxnForMonth(userId, when = new Date()) {
  const { start, end } = monthRange(when);
  return Transaction.findOne({
    userId,
    isSalary: true,
    direction: 'credit',
    occurredAt: { $gte: start, $lt: end },
  }).sort({ occurredAt: -1 }).lean();
}

/**
 * Whole salary status for the current month — drives the Home/Reports card and
 * the manual-tick visibility. Returns:
 *   {
 *     configured, accountId, accountName, expectedAmount, payDay,
 *     credited, creditedAmount, creditedDate, creditedTxnId, autoDetected,
 *     canMarkCredited, monthKey
 *   }
 */
export async function getSalaryStatus(userId, now = new Date()) {
  const user = await User.findById(userId).lean();
  const salary = user?.salary || {};
  const expectedAmount = salary.amount || 0;
  const payDay = salary.payDay || null;
  const accountId = salary.accountId ? String(salary.accountId) : null;
  const configured = !!(accountId && expectedAmount > 0);

  let accountName = '';
  if (accountId) {
    const acct = await Account.findOne({ _id: accountId, userId }).lean();
    accountName = acct?.name || '';
  }

  const txn = configured || accountId ? await findSalaryTxnForMonth(userId, now) : null;
  const credited = !!txn;

  // The manual tick becomes available toward the end of the month / start of
  // next: from the expected pay day (or the 25th if none) onward, AND only when
  // this month isn't already credited and salary is configured.
  const windowStart = Math.min(payDay || 25, 25);
  const canMarkCredited = configured && !credited && now.getDate() >= windowStart;

  return {
    configured,
    accountId,
    accountName,
    expectedAmount,
    payDay,
    credited,
    creditedAmount: txn?.amount ?? null,
    creditedDate: txn?.occurredAt ?? null,
    creditedTxnId: txn ? String(txn._id) : null,
    // source 'email' (auto) vs 'manual' (ticked)
    autoDetected: txn ? txn.source === 'email' : false,
    canMarkCredited,
    monthKey: monthKey(now),
  };
}

/**
 * Manual tick: record this month's salary as credited. Creates a CONFIRMED
 * income credit on the salary account (so it flows through applyBalance →
 * updates the account balance and the reports income figure immediately).
 *
 * Idempotent: refuses if the month is already credited (auto OR manual).
 * `amount` is editable by the caller (defaults to the expected salary).
 * `date` (ISO, optional) defaults to today.
 */
export async function markSalaryCredited(userId, { amount, date } = {}) {
  const user = await User.findById(userId).lean();
  const salary = user?.salary || {};
  if (!salary.accountId) throw new HttpError(400, 'Set a salary account first.');
  if (!(salary.amount > 0)) throw new HttpError(400, 'Set your expected salary first.');

  const when = date ? new Date(date) : new Date();
  if (Number.isNaN(when.getTime())) throw new HttpError(400, 'Invalid date.');

  // Idempotency: never double-count a month.
  const existing = await findSalaryTxnForMonth(userId, when);
  if (existing) throw new HttpError(409, 'Salary is already recorded for this month.');

  const acct = await Account.findOne({ _id: salary.accountId, userId }).lean();
  if (!acct) throw new HttpError(400, 'Your salary account no longer exists. Pick another in settings.');

  const amt = amount != null && amount > 0 ? amount : salary.amount;

  const { transaction } = await createTransaction(userId, {
    accountId: acct._id,
    accountName: acct.name,
    source: 'manual',
    status: 'confirmed', // applies the balance + counts in income immediately
    direction: 'credit',
    amount: amt,
    currency: 'INR',
    merchant: 'Salary credited',
    categoryKey: 'income',
    categorySource: 'manual',
    icon: '💼',
    iconBg: '#EAF7EF',
    isSalary: true,
    occurredAt: when,
  });
  return transaction;
}
