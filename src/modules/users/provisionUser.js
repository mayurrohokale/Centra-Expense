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
