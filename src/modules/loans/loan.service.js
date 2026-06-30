import { Loan } from './loan.model.js';
import { Transaction } from '../transactions/transaction.model.js';
import { Account } from '../accounts/account.model.js';
import { HttpError } from '../../common/api/http.js';
import { createTransaction, deleteTransaction } from '../transactions/transaction.service.js';

/**
 * Loans / debts service.
 *
 * Each loan EVENT (creation principal move + every repayment) is recorded as a
 * CONFIRMED transaction (categoryKey 'loan', loanId set) so it moves the real
 * bank/cash balance through the shared balance system AND shows in history. The
 * balance GUARD (assertSufficientBalance inside createTransaction) automatically
 * blocks user-initiated OUTFLOWS that exceed the account balance — i.e. LENT
 * creation and BORROWED repayment (both source 'manual'|'cash' debits).
 *
 * The loan's `outstanding` is maintained as events apply/reverse. Repayments are
 * NOT embedded — they're queried by loanId, so deleting a repayment txn (which
 * reverses its balance) just requires re-deriving outstanding. We keep it simple
 * and idempotent: outstanding = principal − Σ(confirmed repayment amounts), and
 * recomputeOutstanding() re-derives it from the linked txns after any change.
 */

const ICON = '🤝';
const ICON_BG = '#E0F2FE';

/** Resolve + return {account} or throw if the account doesn't belong to the user. */
async function requireAccount(userId, accountId) {
  const acct = await Account.findOne({ _id: accountId, userId }).lean();
  if (!acct) throw new HttpError(400, 'Pick a valid account.');
  return acct;
}

/**
 * Re-derive a loan's outstanding from its principal minus confirmed repayments
 * (linked txns that are NOT the principal txn). Flips status open/settled and
 * stamps settledAt. Idempotent — safe to call after create/repay/delete.
 */
export async function recomputeOutstanding(userId, loanId) {
  const loan = await Loan.findOne({ _id: loanId, userId });
  if (!loan) return null;

  const repayTxns = await Transaction.find({
    userId, loanId, status: 'confirmed', _id: { $ne: loan.principalTxnId },
  }).select('amount').lean();
  const repaid = repayTxns.reduce((s, t) => s + t.amount, 0);

  const outstanding = Math.max(0, loan.principal - repaid);
  loan.outstanding = outstanding;
  if (outstanding === 0 && loan.status !== 'settled') {
    loan.status = 'settled';
    loan.settledAt = new Date();
  } else if (outstanding > 0 && loan.status !== 'open') {
    loan.status = 'open';
    loan.settledAt = null;
  }
  await loan.save();
  return loan.toObject();
}

/** List loans (newest first) + the two headline totals. */
export async function listLoans(userId) {
  const loans = await Loan.find({ userId }).sort({ status: 1, createdAt: -1 }).lean();
  const youOwe = loans
    .filter((l) => l.direction === 'borrowed' && l.status === 'open')
    .reduce((s, l) => s + l.outstanding, 0);
  const owedToYou = loans
    .filter((l) => l.direction === 'lent' && l.status === 'open')
    .reduce((s, l) => s + l.outstanding, 0);
  return { loans, totals: { youOwe, owedToYou } };
}

/** Repayment history for a loan (linked txns excluding the principal txn). */
export async function listRepayments(userId, loanId) {
  const loan = await Loan.findOne({ _id: loanId, userId }).lean();
  if (!loan) throw new HttpError(404, 'Loan not found');
  const rows = await Transaction.find({
    userId, loanId, _id: { $ne: loan.principalTxnId },
  }).sort({ occurredAt: -1, createdAt: -1 }).select('amount accountName occurredAt direction').lean();
  return rows.map((r) => ({
    _id: String(r._id),
    amount: r.amount,
    accountName: r.accountName || 'Account',
    occurredAt: r.occurredAt,
  }));
}

/**
 * Create a loan + its principal transaction.
 *  - borrowed: CREDIT the account (+balance). merchant "Loan from <name>".
 *  - lent:     DEBIT the account (−balance, balance-guarded). "Loan to <name>".
 * outstanding starts at principal.
 */
export async function createLoan(userId, data) {
  const direction = data.direction;
  if (!['borrowed', 'lent'].includes(direction)) throw new HttpError(400, 'Invalid loan direction.');
  const principal = Number(data.principal);
  if (!(principal > 0)) throw new HttpError(400, 'Enter a valid amount.');
  const name = (data.counterpartyName || '').trim();
  if (!name) throw new HttpError(400, 'Who is the loan with?');

  const acct = await requireAccount(userId, data.accountId);
  const isCash = acct.type === 'cash';
  const txnDirection = direction === 'borrowed' ? 'credit' : 'debit';
  const merchant = direction === 'borrowed' ? `Loan from ${name}` : `Loan to ${name}`;
  const occurredAt = data.startDate ? new Date(data.startDate) : new Date();

  // The linked CONFIRMED txn moves the balance now. For LENT (a debit) the
  // balance guard inside createTransaction rejects over-balance with a 400.
  const { transaction } = await createTransaction(userId, {
    accountId: acct._id,
    accountName: acct.name,
    source: isCash ? 'cash' : 'manual',
    status: 'confirmed',
    direction: txnDirection,
    amount: principal,
    currency: 'INR',
    merchant,
    categoryKey: 'loan',
    categorySource: 'manual',
    icon: ICON,
    iconBg: ICON_BG,
    occurredAt,
    note: data.note || '',
    // loanId is patched in below once the loan exists.
  });

  const loan = await Loan.create({
    userId,
    direction,
    counterpartyName: name,
    principal,
    outstanding: principal,
    accountId: acct._id,
    accountName: acct.name,
    principalTxnId: transaction._id,
    note: data.note || '',
    status: 'open',
    startDate: occurredAt,
  });

  // Link the principal txn back to the loan (for reports exclusion + history).
  await Transaction.updateOne({ _id: transaction._id, userId }, { $set: { loanId: loan._id } });
  return loan.toObject();
}

/**
 * Record a repayment on a loan.
 *  - borrowed (I pay them back): DEBIT the account (−balance, guarded). "Repaid <name>".
 *  - lent (they pay me back):    CREDIT the account (+balance). "Repayment from <name>".
 * Reduces outstanding; settles at 0. Rejects amount > outstanding.
 */
export async function repayLoan(userId, loanId, data) {
  const loan = await Loan.findOne({ _id: loanId, userId });
  if (!loan) throw new HttpError(404, 'Loan not found');
  if (loan.status === 'settled') throw new HttpError(400, 'This loan is already settled.');

  const amount = Number(data.amount);
  if (!(amount > 0)) throw new HttpError(400, 'Enter a valid repayment amount.');
  if (amount > loan.outstanding) {
    throw new HttpError(400, `Repayment exceeds the ₹${loan.outstanding.toLocaleString('en-IN')} still outstanding.`);
  }

  const acct = await requireAccount(userId, data.accountId);
  const isCash = acct.type === 'cash';
  // borrowed → I pay them (debit, guarded); lent → they pay me (credit).
  const txnDirection = loan.direction === 'borrowed' ? 'debit' : 'credit';
  const merchant = loan.direction === 'borrowed'
    ? `Repaid ${loan.counterpartyName}`
    : `Repayment from ${loan.counterpartyName}`;
  const occurredAt = data.date ? new Date(data.date) : new Date();

  const { transaction } = await createTransaction(userId, {
    accountId: acct._id,
    accountName: acct.name,
    source: isCash ? 'cash' : 'manual',
    status: 'confirmed',
    direction: txnDirection,
    amount,
    currency: 'INR',
    merchant,
    categoryKey: 'loan',
    categorySource: 'manual',
    icon: ICON,
    iconBg: ICON_BG,
    occurredAt,
    loanId: loan._id,
  });

  // Re-derive outstanding from confirmed repayment txns (idempotent).
  const updated = await recomputeOutstanding(userId, loan._id);
  return { loan: updated, repaymentTxnId: String(transaction._id) };
}

/**
 * Delete a whole loan: reverse EVERY linked txn (principal + repayments) so all
 * balance effects are undone, then remove the loan. deleteTransaction reverses
 * each txn's balance idempotently (balanceApplied guard), so this is safe.
 */
export async function deleteLoan(userId, loanId) {
  const loan = await Loan.findOne({ _id: loanId, userId }).lean();
  if (!loan) throw new HttpError(404, 'Loan not found');

  const linked = await Transaction.find({ userId, loanId }).select('_id').lean();
  for (const t of linked) {
    await deleteTransaction(userId, t._id); // reverses balance + removes the row
  }
  await Loan.deleteOne({ _id: loanId, userId });
  return { deleted: true, id: String(loanId) };
}

/**
 * Delete a single REPAYMENT: reverse its txn (restores the balance) and re-derive
 * outstanding (which may re-open a settled loan). Refuses to delete the principal
 * txn here (use deleteLoan for that).
 */
export async function deleteRepayment(userId, loanId, txnId) {
  const loan = await Loan.findOne({ _id: loanId, userId });
  if (!loan) throw new HttpError(404, 'Loan not found');
  if (String(loan.principalTxnId) === String(txnId)) {
    throw new HttpError(400, 'That is the original loan — delete the whole loan instead.');
  }
  const txn = await Transaction.findOne({ _id: txnId, userId, loanId }).select('_id').lean();
  if (!txn) throw new HttpError(404, 'Repayment not found');

  await deleteTransaction(userId, txnId); // reverses balance + removes row
  const updated = await recomputeOutstanding(userId, loanId);
  return { loan: updated };
}
