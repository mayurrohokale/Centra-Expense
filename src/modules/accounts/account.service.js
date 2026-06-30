import { Account } from './account.model.js';
import { HttpError } from '../../common/api/http.js';

// Badge colors cycled for newly-created bank accounts (matches the design palette).
const NEW_ACCOUNT_COLORS = ['#6C5CE7', '#0050A0', '#F47216', '#22409A', '#97144D', '#2BC4B0'];

export function listAccounts(userId, filter = {}) {
  const q = { userId, isActive: true };
  if (filter.type) q.type = filter.type;
  return Account.find(q).sort({ order: 1, createdAt: 1 }).lean();
}

export function getAccount(userId, id) {
  return Account.findOne({ _id: id, userId }).lean();
}

/** Update a cash account balance (Add cash / Log spend from the wallet sheet). */
export async function adjustCashBalance(userId, accountId, { delta, spentDelta = 0 }) {
  return Account.findOneAndUpdate(
    { _id: accountId, userId, type: 'cash' },
    { $inc: { balance: delta, spentThisMonth: spentDelta } },
    { new: true }
  ).lean();
}

export function updateAccount(userId, id, patch) {
  const allowed = (({ balance, spentThisMonth, name, institution, last4, lastActivity }) => ({
    balance, spentThisMonth, name, institution, last4, lastActivity,
  }))(patch);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
  // A user-edited balance is the authoritative starting point for computed mode.
  if (allowed.balance !== undefined) {
    allowed.balanceSource = 'manual';
    allowed.startingBalance = allowed.balance;
    allowed.balanceUpdatedAt = new Date();
  }
  return Account.findOneAndUpdate({ _id: id, userId }, allowed, { new: true }).lean();
}

/**
 * Create a bank or cash account for the user. A user may hold only ONE cash
 * wallet (the "cash is a single tracked account" rule), so a second cash
 * account is rejected. Bank accounts get a derived single-letter badge + color.
 */
export async function createAccount(userId, data) {
  const type = data.type === 'cash' ? 'cash' : 'bank';

  if (type === 'cash') {
    const existingCash = await Account.findOne({ userId, type: 'cash', isActive: true }).lean();
    if (existingCash) throw new HttpError(409, 'You already have a cash wallet');
  }

  const count = await Account.countDocuments({ userId });
  const name = (data.name || '').trim();
  const logo = type === 'cash' ? '👛' : (name[0] || '₹').toUpperCase();
  const color = type === 'cash' ? '#1FAE63' : NEW_ACCOUNT_COLORS[count % NEW_ACCOUNT_COLORS.length];

  const account = await Account.create({
    userId,
    type,
    name: name || (type === 'cash' ? 'Cash' : 'Account'),
    institution: type === 'cash' ? '' : (data.institution || '').trim(),
    last4: type === 'cash' ? '' : (data.last4 || '').trim(),
    balance: data.balance ?? 0,
    startingBalance: data.balance ?? 0,
    balanceSource: 'manual',
    balanceUpdatedAt: new Date(),
    spentThisMonth: 0,
    subtype: type === 'bank' ? 'Savings' : '',
    logo,
    color,
    currency: data.currency || 'INR',
    order: count,
  });
  return account.toObject();
}

/**
 * Soft-delete an account: flip isActive=false so historical transactions stay
 * intact and the account is excluded from default listings. The single cash
 * wallet is protected from deletion.
 */
export async function softDeleteAccount(userId, id) {
  const account = await Account.findOne({ _id: id, userId });
  if (!account) return null;
  if (account.type === 'cash') throw new HttpError(400, 'The cash wallet cannot be removed');
  account.isActive = false;
  await account.save();
  return account.toObject();
}
