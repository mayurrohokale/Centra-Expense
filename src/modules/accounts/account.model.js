import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * accounts — bank / cash / investment accounts owned by a user.
 * Cash is a tracked account with an editable balance.
 */
const accountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['bank', 'cash', 'investment'], required: true },

    // Display
    name: { type: String, required: true, trim: true }, // e.g. "HDFC Bank", "Cash"
    institution: { type: String, default: '', trim: true }, // bank/provider name when name is a nickname
    logo: { type: String, default: '' }, // single-letter badge e.g. "H"
    color: { type: String, default: '#A78BFA' }, // brand color hex for the badge
    last4: { type: String, default: '' },
    currency: { type: String, default: 'INR' },

    // Bank metadata (design: "Savings", "Premier"/"Regular"/"Salary"/"811")
    subtype: { type: String, default: '' }, // e.g. "Savings"
    tier: { type: String, default: '' }, // e.g. "Premier"
    lastActivity: { type: String, default: '' }, // human label e.g. "Today"

    balance: { type: Number, default: 0 }, // current balance in ₹ (paise not used in M1)
    // How `balance` was last set: 'email' = authoritative Avl Bal from a bank
    // alert · 'computed' = running balance adjusted by confirmed txns ·
    // 'manual' = user-entered starting/edited balance.
    balanceSource: { type: String, enum: ['email', 'computed', 'manual'], default: 'manual' },
    startingBalance: { type: Number, default: 0 }, // user-set baseline for computed mode
    balanceUpdatedAt: { type: Date, default: null },
    spentThisMonth: { type: Number, default: 0 }, // used by cash wallet

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, type: 1 });

export const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);
