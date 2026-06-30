import { Connection } from './connection.model.js';
import { encryptJson, decryptJson } from '../../common/crypto/cryptoService.js';

/** List connections (ciphertext is never selected/returned). */
export function listConnections(userId) {
  return Connection.find({ userId }).sort({ createdAt: 1 }).lean();
}

/** A single user-scoped connection (no ciphertext). */
export function getConnection(userId, id) {
  return Connection.findOne({ _id: id, userId }).lean();
}

/**
 * Decrypt and return the token material for a connection. Used only by the
 * server-side ingestion service. The plaintext is never persisted or logged.
 * Returns null when the connection is missing/revoked or has no tokens.
 */
export async function getConnectionTokens(userId, id) {
  const conn = await Connection.findOne({ _id: id, userId }).select('+encryptedTokens').lean();
  if (!conn || !conn.encryptedTokens) return null;
  try {
    return decryptJson(conn.encryptedTokens);
  } catch {
    return null;
  }
}

/** Active connections of a kind across all users — drives the cron sweep. */
export function listActiveByKind(kind) {
  return Connection.find({ kind, status: 'connected' }).lean();
}

/** Active connections of a kind for ONE user (no ciphertext) — drives per-user "sync all". */
export function listConnectionsByKind(userId, kind, { status = 'connected' } = {}) {
  const filter = { userId, kind };
  if (status) filter.status = status;
  return Connection.find(filter).sort({ createdAt: 1 }).lean();
}

/**
 * Persist a refreshed access token + bump lastSyncedAt after a sync.
 * Also records the new access-token expiry and (optional) Gmail historyId cursor.
 */
export async function recordSync(userId, id, { tokens, tokenExpiresAt, historyId } = {}) {
  const update = { lastSyncedAt: new Date(), status: 'connected' };
  if (tokens) update.encryptedTokens = encryptJson(tokens);
  if (tokenExpiresAt) update.tokenExpiresAt = tokenExpiresAt;
  if (historyId) update.historyId = historyId;
  return Connection.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true }).lean();
}

/** Flag a connection as errored (e.g. refresh failed) without clearing tokens. */
export async function markConnectionError(userId, id) {
  return Connection.findOneAndUpdate(
    { _id: id, userId },
    { $set: { status: 'error' } },
    { new: true }
  ).lean();
}

/**
 * Upsert a connection. Token material is encrypted before storage; plaintext
 * tokens never touch the DB or logs.
 *
 * Identity:
 * - Email pipes (gmail/outlook) are keyed on (userId, kind, emailAddress) so a
 *   user can connect MANY inboxes; re-connecting the SAME inbox updates tokens
 *   in place instead of creating a duplicate.
 * - Other kinds (AA) keep the (userId, kind, accountId) identity.
 */
export async function upsertConnection(userId, {
  kind, accountId, emailAddress, label, provider, scopes, tokens,
  tokenExpiresAt, historyId, consentExpiresAt,
}) {
  const encryptedTokens = tokens ? encryptJson(tokens) : undefined;
  const email = (emailAddress || '').toLowerCase().trim();
  const isEmailKind = kind === 'gmail' || kind === 'outlook';

  const filter = isEmailKind && email
    ? { userId, kind, emailAddress: email }
    : { userId, kind, accountId: accountId || null };

  const update = {
    userId, kind, accountId: accountId || null,
    ...(email ? { emailAddress: email } : {}),
    label, provider,
    scopes: scopes || [], status: 'connected',
    revokedAt: null,
    ...(encryptedTokens ? { encryptedTokens } : {}),
    ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
    ...(historyId ? { historyId } : {}),
    ...(consentExpiresAt ? { consentExpiresAt } : {}),
  };
  return Connection.findOneAndUpdate(
    filter,
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

/**
 * Revoke: clears stored ciphertext and flips status to 'revoked'. Returns the
 * pre-clear token material (decrypted) so callers can additionally revoke it at
 * the provider (e.g. Google /revoke). Revocation MUST clear tokens (security).
 */
export async function revokeConnection(userId, id) {
  // Read tokens BEFORE clearing so the caller can revoke them upstream.
  let priorTokens = null;
  const withTokens = await Connection.findOne({ _id: id, userId }).select('+encryptedTokens').lean();
  if (withTokens?.encryptedTokens) {
    try { priorTokens = decryptJson(withTokens.encryptedTokens); } catch { priorTokens = null; }
  }
  const conn = await Connection.findOneAndUpdate(
    { _id: id, userId },
    { $set: { status: 'revoked', revokedAt: new Date(), tokenExpiresAt: null }, $unset: { encryptedTokens: '' } },
    { new: true }
  ).lean();
  if (!conn) return null;
  return { connection: conn, priorTokens };
}
