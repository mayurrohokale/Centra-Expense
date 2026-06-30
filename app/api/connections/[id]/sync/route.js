import { handle, requireDb, ok, HttpError } from '@/common/api/http';
import { env } from '@/common/config/env';
import { requireAuth } from '@/common/auth/session';
import { getConnection } from '@/modules/connections/connection.service';
import { syncGmailConnection } from '@/modules/email-ingestion/emailIngestion.service';

export const dynamic = 'force-dynamic';

/**
 * Manual sync for a single connection (user-scoped). Gmail only this milestone.
 * Returns a { created, duplicate, failed, total } summary; re-running is
 * idempotent (fingerprint dedupe).
 */
export const POST = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;

  const conn = await getConnection(user._id, id);
  if (!conn) throw new HttpError(404, 'Connection not found');
  if (conn.kind !== 'gmail') {
    throw new HttpError(400, 'Sync is only available for Gmail connections in this milestone.');
  }
  if (conn.status !== 'connected') {
    throw new HttpError(400, 'This connection is not active. Reconnect Gmail first.');
  }
  if (!env.gmailConfigured) {
    throw new HttpError(400, 'Gmail is not configured on the server. Use Simulate fetch, or set GOOGLE_CLIENT_ID/SECRET.');
  }

  let summary;
  try {
    summary = await syncGmailConnection(user._id, conn);
  } catch (err) {
    if (err?.message === 'NO_REFRESH_TOKEN') {
      throw new HttpError(400, 'Gmail needs to be reconnected (no refresh token). Disconnect and connect again.');
    }
    if (err?.message === 'GMAIL_TOKEN_REFRESH_FAILED') {
      throw new HttpError(502, 'Could not refresh Gmail access. Reconnect Gmail and try again.');
    }
    throw new HttpError(502, 'Gmail sync failed. Please try again shortly.');
  }

  return ok({ data: summary });
});
