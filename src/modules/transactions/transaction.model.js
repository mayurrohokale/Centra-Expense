import mongoose from 'mongoose';

const { Schema } = mongoose;

export const TX_SOURCES = ['email', 'aa_sync', 'cash', 'manual'];
export const TX_DIRECTIONS = ['debit', 'credit'];
export const TX_STATUSES = ['confirmed', 'needs_review'];

/**
 * transactions — unified ledger across all data pipes.
 *
 * Security: raw email bodies are NEVER stored. Only extracted fields land here.
 * Idempotency: `fingerprint` is a unique partial-indexed hash so re-fetched
 * emails and re-synced AA data dedupe cleanly.
 *
 * Note: the design UI uses the source token `sync`; our DB uses `aa_sync`.
 * The API/UI layer maps between them.
 */
const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },
    accountName: { type: String, default: '' }, // denormalized for fast list rendering

    source: { type: String, enum: TX_SOURCES, required: true },
    direction: { type: String, enum: TX_DIRECTIONS, required: true },
    status: { type: String, enum: TX_STATUSES, default: 'confirmed', index: true },

    amount: { type: Number, required: true, min: 0 }, // always positive; sign comes from direction
    currency: { type: String, default: 'INR' },

    merchant: { type: String, required: true, trim: true },
    categoryKey: { type: String, default: 'other' }, // FK-ish to categories.key
    // How categoryKey was assigned — drives review confidence / bulk-approve.
    categorySource: {
      type: String,
      enum: ['merchant-rule', 'ai', 'default', 'manual'],
      default: 'default',
    },
    icon: { type: String, default: '💳' },
    iconBg: { type: String, default: '#F1EEF6' },

    occurredAt: { type: Date, required: true, index: true },
    dateLabel: { type: String, default: '' }, // design groups by label e.g. "TODAY · 29 JUN"

    note: { type: String, default: '' },

    // Per-bank balance tracking (Feature B).
    // availableBalance = the authoritative "Avl Bal" parsed from the alert (if
    // any) → sets the account balance directly when this txn is confirmed.
    availableBalance: { type: Number, default: null },
    balanceAsOf: { type: Date, default: null },
    // Idempotency guard: whether this txn's balance effect was applied to its
    // account. Confirm applies it; reverse (un-confirm/delete) undoes it.
    balanceApplied: { type: Boolean, default: false },

    // Idempotent dedupe key. Unique only among string values — a partial
    // index is used (NOT sparse) because manual/cash rows store fingerprint
    // as null, and many explicit nulls collide under a sparse unique index
    // (sparse skips absent fields, not null values).
    fingerprint: { type: String, default: null },
  },
  { timestamps: true }
);

transactionSchema.index(
  { fingerprint: 1 },
  { unique: true, partialFilterExpression: { fingerprint: { $type: 'string' } } }
);
transactionSchema.index({ userId: 1, occurredAt: -1 });
transactionSchema.index({ userId: 1, status: 1 });

export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
