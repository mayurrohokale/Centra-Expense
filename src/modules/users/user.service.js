import { User } from './user.model.js';
import { HttpError } from '../../common/api/http.js';
import { hashPassword, verifyPassword } from '../../common/auth/password.js';

/**
 * Profile updates for the authenticated user.
 *
 * Security: this service NEVER touches passwordHash (that is only mutated by
 * changePassword, which verifies the current password first). Email changes are
 * guarded for uniqueness so we never create a duplicate-email account.
 */
export async function updateProfile(userId, patch) {
  const update = {};

  if (patch.email !== undefined) {
    const taken = await User.findOne({ email: patch.email, _id: { $ne: userId } })
      .select('_id')
      .lean();
    if (taken) throw new HttpError(409, 'That email is already in use');
    update.email = patch.email;
  }

  for (const key of ['name', 'phone', 'currency', 'avatarColor', 'reminderEnabled', 'reminderTime']) {
    if (patch[key] !== undefined) update[key] = patch[key];
  }

  if (patch.salary !== undefined) {
    update.salary = {
      amount: patch.salary.amount,
      payDay: patch.salary.payDay,
    };
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

/**
 * Mark the first-run onboarding wizard as finished. `skip` records that the
 * user chose "skip for now" (so the app can nudge them later) while still
 * dismissing the wizard. Either way the wizard won't show again.
 */
export async function completeOnboarding(userId, { skip = false } = {}) {
  const user = await User.findByIdAndUpdate(
    userId,
    { 'onboarding.completed': true, 'onboarding.skipped': !!skip },
    { new: true }
  );
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

/**
 * Change the password for a password-based account. Verifies the current
 * password (bcrypt) before writing a new one-way hash. Google-only users (no
 * passwordHash) get a clear error rather than a silent set.
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new HttpError(404, 'User not found');
  if (!user.passwordHash) {
    throw new HttpError(400, 'No password is set for this account. You signed in with Google.');
  }
  const okPass = await verifyPassword(currentPassword, user.passwordHash);
  if (!okPass) throw new HttpError(400, 'Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  return true;
}
