import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * users — app users.
 *
 * Security (NON-NEGOTIABLE):
 * - We NEVER store a plaintext password. `passwordHash` holds ONLY a one-way
 *   bcrypt hash (computed with bcryptjs). It is `select:false` so it is never
 *   loaded unless explicitly asked for, and the toJSON transform below strips
 *   it (plus reset-token material) so it can never leak in an API response.
 * - Google sign-in users have a `googleId` and may have no passwordHash.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },

    // One-way bcrypt hash — never plaintext, never serialized, never logged.
    passwordHash: { type: String, default: null, select: false },

    // Google OAuth subject id (sparse-unique: optional, but unique when present).
    googleId: { type: String, default: null },
    avatarUrl: { type: String, default: '' },

    // Password reset: store only a hash of the token + an expiry. select:false.
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },

    currency: { type: String, default: 'INR' },
    locale: { type: String, default: 'en-IN' },
    avatarEmoji: { type: String, default: '👋' },

    // Profile (all optional; added by the Profile feature).
    phone: { type: String, default: '' },
    avatarColor: { type: String, default: '' },

    // Monthly salary — feeds the "upcoming salary" card AND the salary-tracking
    // feature (auto-detect + manual "credited" tick + per-month status).
    // - amount  : expected monthly salary (₹)
    // - payDay  : expected credit day-of-month (1–31; 31 ≈ month-end via clamp)
    // - accountId: the designated SALARY ACCOUNT (one at a time). Salary credits
    //   land here; auto-detect only matches credits on this account.
    salary: {
      amount: { type: Number, default: 0, min: 0 },
      payDay: { type: Number, default: null, min: 1, max: 31 },
      accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    },

    // In-app daily reminder to add transactions. When enabled, the app shows a
    // dismissible banner after `reminderTime` (24h "HH:MM", local) on days the
    // user hasn't logged a transaction. No push/email — purely in-app.
    reminderEnabled: { type: Boolean, default: false },
    reminderTime: { type: String, default: '21:00' },

    // First-run setup wizard state. Only genuinely-new signups get the wizard:
    // they are created with completed:false. Legacy users (no field) and the
    // seeded demo user are treated as already onboarded (completed:true).
    onboarding: {
      completed: { type: Boolean, default: false },
      skipped: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Unique only when googleId is a string (allows many users with no googleId).
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);

// Defense in depth: secrets can never leak through JSON serialization.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpiresAt;
    delete ret.__v;
    return ret;
  },
});

// Guard against Next.js hot-reload / serverless re-import re-registering the model.
export const User = mongoose.models.User || mongoose.model('User', userSchema);

/** Strip sensitive/internal fields from a lean or hydrated user → safe API shape. */
export function toSafeUser(user) {
  if (!user) return null;
  const u = typeof user.toObject === 'function' ? user.toObject() : user;
  const { passwordHash, resetTokenHash, resetTokenExpiresAt, __v, ...safe } = u;
  return safe;
}
