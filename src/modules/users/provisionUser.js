import { Category } from '../categories/category.model.js';
import { Account } from '../accounts/account.model.js';
import { DEFAULT_CATEGORIES } from '../categories/defaultCategories.js';

/**
 * Seed a sensible starter set for a brand-new user so the app is usable
 * immediately after signup (no empty/broken screens):
 *  - the default Indian categories
 *  - an empty, editable Cash account (the "cash is a tracked account" rule)
 *
 * Idempotent: skips anything that already exists for this user.
 */
export async function provisionNewUser(userId) {
  const existingCats = await Category.countDocuments({ userId });
  if (existingCats === 0) {
    await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
  } else {
    // Existing user — make sure any newly-added default categories are present.
    await backfillCategories(userId);
  }

  const existingCash = await Account.findOne({ userId, type: 'cash' });
  if (!existingCash) {
    await Account.create({
      userId,
      type: 'cash',
      name: 'Cash',
      logo: '👛',
      color: '#1FAE63',
      balance: 0,
      spentThisMonth: 0,
      order: 10,
    });
  }
}

/**
 * Add any DEFAULT_CATEGORIES the user doesn't already have (by key). Idempotent
 * and cheap: only inserts missing keys, never touches/overwrites existing ones
 * (so a user's custom labels/colors are preserved). Lets existing accounts pick
 * up newly-shipped categories (fuel/groceries/fashion/electricity/recharge/…)
 * the next time their categories are read.
 */
export async function backfillCategories(userId) {
  const existing = await Category.find({ userId }).select('key').lean();
  const have = new Set(existing.map((c) => c.key));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(c.key));
  if (missing.length === 0) return 0;
  // Guard against a race (unique index userId+key) — ignore dup-key errors.
  try {
    await Category.insertMany(missing.map((c) => ({ ...c, userId })), { ordered: false });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  return missing.length;
}
