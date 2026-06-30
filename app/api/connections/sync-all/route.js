import { handle, requireDb, ok, HttpError } from '@/common/api/http';
import { env } from '@/common/config/env';
import { requireAuth } from '@/common/auth/session';
import { syncAllGmailForUser } from '@/modules/email-ingestion/emailIngestion.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // multiple inboxes may take a while

/**
 * Sync ALL of the logged-in user's active Gmail connections in one call.
 * Returns aggregate totals plus a per-account breakdown. Idempotent across
 * runs and across inboxes (content fingerprint dedupe).
 */
export const POST = handle(async () => {
  await requireDb();
  const user = await requireAuth();

  if (!env.gmailConfigured) {
    throw new HttpError(400, 'Gmail is not configured on the server. Use Simulate fetch, or set GOOGLE_CLIENT_ID/SECRET.');
  }

  const result = await syncAllGmailForUser(user._id);
  return ok({ data: result });
});
