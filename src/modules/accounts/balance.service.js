import { Account } from './account.model.js';
import { Transaction } from '../transactions/transaction.model.js';

/**
 * Per-bank balance effects of a transaction (Feature B).
 *
 * Priority:
 *  1. EMAIL-AUTHORITATIVE — if the txn carries `availableBalance` (the "Avl Bal"
 *     parsed from the bank alert), set the account balance to that exact value.
 *     This is the true post-transaction balance, so it wins over computed.
 *  2. COMPUTED — otherwise adjust a running balance: debit lowers it, credit
 *     raises it.
 *
 * Timing: applied when a txn is CONFIRMED (or created already-confirmed, e.g.
 * manual/cash). Idempotency: the txn's `balanceApplied` flag guards against
 * double-counting; reverse() undoes the effect on un-confirm/delete/amount-edit.
 */

function signedDelta(txn) {
  return txn.direction === 'credit' ? txn.amount : -txn.amount;
}

/** Current stored balance of an account (₹), or 0 if not found. */
export async function getAccountBalance(userId, accountId) {
  if (!accountId) return 0;
  const acct = await Account.findOne({ _id: accountId, userId }).select('balance name').lean();
  return acct ? { balance: acct.balance || 0, name: acct.name || 'account' } : null;
}

/**
 * Adjust one account's running balance by `delta`. `trackSpend` controls whether
 * a cash outflow bumps the wallet's "spent this month" — true for real spending,
 * FALSE for transfers (moving your own money is not spending).
 */
async function adjustAccount(userId, accountId, delta, trackSpend = false) {
  if (!accountId) return;
  const acct = await Account.findOne({ _id: accountId, userId });
  if (!acct) return;
  acct.balance = (acct.balance || 0) + delta;
  if (acct.balanceSource !== 'email') acct.balanceSource = 'computed';
  acct.balanceUpdatedAt = new Date();
  if (trackSpend && acct.type === 'cash' && delta < 0) {
    acct.spentThisMonth = (acct.spentThisMonth || 0) + Math.abs(delta);
  }
  acct.lastActivity = 'Just now';
  await acct.save();
}

/**
 * Apply a transaction's balance effect to its account. No-op if already applied
 * or the txn has no linked account. Returns the updated account (lean) or null.
 */
export async function applyBalanceForTransaction(userId, txnId) {
  const txn = await Transaction.findOne({ _id: txnId, userId });
  if (!txn || txn.balanceApplied || !txn.accountId) return null;

  // Self-transfer: debit the FROM account and credit the TO account together.
  // trackSpend=false on both legs — moving your own money is NOT spending, so it
  // must not inflate a cash wallet's "spent this month" (or any spend total).
  if (txn.direction === 'transfer') {
    await adjustAccount(userId, txn.accountId, -txn.amount, false);  // from
    await adjustAccount(userId, txn.toAccountId, txn.amount, false); // to
    txn.balanceApplied = true;
    await txn.save();
    return null;
  }

  const acct = await Account.findOne({ _id: txn.accountId, userId });
  if (!acct) return null;

  if (txn.availableBalance != null) {
    // Authoritative snapshot from the bank email.
    acct.balance = txn.availableBalance;
    acct.balanceSource = 'email';
    acct.balanceUpdatedAt = txn.balanceAsOf || txn.occurredAt || new Date();
  } else {
    acct.balance = (acct.balance || 0) + signedDelta(txn);
    // Don't downgrade an authoritative email balance label on a plain adjust.
    if (acct.balanceSource !== 'email') acct.balanceSource = 'computed';
    acct.balanceUpdatedAt = new Date();
  }

  // Cash wallet also tracks money spent this month.
  if (acct.type === 'cash' && txn.direction === 'debit') {
    acct.spentThisMonth = (acct.spentThisMonth || 0) + txn.amount;
  }
  acct.lastActivity = 'Just now';
  await acct.save();

  txn.balanceApplied = true;
  await txn.save();
  return acct.toObject();
}

/**
 * Reverse a previously-applied balance effect (un-confirm / delete / before an
 * amount edit). No-op if not applied. Reverses the computed delta; an email
 * snapshot is approximated back out (the next sync re-asserts the true value).
 */
export async function reverseBalanceForTransaction(userId, txnId) {
  const txn = await Transaction.findOne({ _id: txnId, userId });
  if (!txn || !txn.balanceApplied) return null;

  // Self-transfer: undo BOTH legs (credit back the from, debit back the to).
  if (txn.direction === 'transfer') {
    await adjustAccount(userId, txn.accountId, txn.amount, false);    // refund from
    await adjustAccount(userId, txn.toAccountId, -txn.amount, false); // pull back to
    txn.balanceApplied = false;
    await txn.save();
    return true;
  }

  if (txn.accountId) {
    const acct = await Account.findOne({ _id: txn.accountId, userId });
    if (acct) {
      acct.balance = (acct.balance || 0) - signedDelta(txn);
      acct.balanceSource = 'computed';
      acct.balanceUpdatedAt = new Date();
      if (acct.type === 'cash' && txn.direction === 'debit') {
        acct.spentThisMonth = Math.max(0, (acct.spentThisMonth || 0) - txn.amount);
      }
      await acct.save();
    }
  }

  txn.balanceApplied = false;
  await txn.save();
  return true;
}
