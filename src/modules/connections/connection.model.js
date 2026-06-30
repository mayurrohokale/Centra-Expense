import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CONNECTION_KINDS = ['gmail', 'outlook', 'aa_setu', 'aa_finvu'];
export const CONNECTION_STATUSES = ['connected', 'revoked', 'pending', 'error'];

/**
 * connections — encrypted OAuth (email) and AA tokens.
 *
 * Security (NON-NEGOTIABLE):
 * - Token material is stored ONLY in `encryptedTokens` (AES-256-GCM ciphertext).
 *   Plaintext tokens are never persisted and never logged.
 * - Read-only / minimal scopes are recorded for auditability.
 * - Revocation clears the ciphertext (see connection.service.revokeConnection).
 */
const connectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: CONNECTION_KINDS, required: true },

    // For email pipes: which bank account this inbox feeds (per-bank email).
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },

    // Canonical mailbox address for email pipes (lowercased). This is the
    // per-account identity: a user may connect MANY Gmail inboxes, and
    // (userId, kind, emailAddress) is unique so the same inbox can't double-connect.
    // Empty for non-email connections (AA), which are not constrained by it.
    emailAddress: { type: String, default: '' },

    // Non-secret display metadata
    label: { type: String, default: '' }, // e.g. "aditya.hdfc@gmail.com"
    provider: { type: String, default: '' }, // "Finvu AA", "Google", "Microsoft"
    scopes: { type: [String], default: [] }, // read-only scopes granted

    status: { type: String, enum: CONNECTION_STATUSES, default: 'connected' },

    // AES-256-GCM ciphertext blob (opaque string). NEVER plaintext, NEVER logged.
    encryptedTokens: { type: String, default: null, select: false },

    // Access-token expiry (UTC). Drives expiry-aware refresh per account.
    tokenExpiresAt: { type: Date, default: null },
    // Gmail sync cursor (profile historyId at last sync) — forward-compat metadata
    // for future incremental sync; lastSyncedAt remains the effective window cursor.
    historyId: { type: String, default: null },

    consentExpiresAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

connectionSchema.index({ userId: 1, kind: 1 });

// One inbox can be connected once per user+kind. Partial filter so only
// email connections (non-empty emailAddress) are constrained; AA connections
// (emailAddress: '') are exempt.
connectionSchema.index(
  { userId: 1, kind: 1, emailAddress: 1 },
  { unique: true, partialFilterExpression: { emailAddress: { $gt: '' } } }
);

// Defense in depth: ensure ciphertext never leaks via JSON serialization.
connectionSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.encryptedTokens;
    return ret;
  },
});

export const Connection = mongoose.models.Connection || mongoose.model('Connection', connectionSchema);
