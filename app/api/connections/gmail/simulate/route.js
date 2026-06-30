import { handle, requireDb, ok, HttpError } from '@/common/api/http';
import { env } from '@/common/config/env';
import { requireAuth } from '@/common/auth/session';
import { simulateIngest } from '@/modules/email-ingestion/emailIngestion.service';

export const dynamic = 'force-dynamic';

/**
 * DEV / SIMULATE: feed realistic sample bank emails through the SAME parser
 * registry + ingestion pipeline as live Gmail, producing needs_review email
 * transactions for the logged-in user. Proves parse + dedupe + storage before
 * real OAuth is set up. Re-running is idempotent (0 new on the second call).
 *
 * Guard: authenticated user only, and disabled in production once real Gmail
 * is configured (so it can't be used to inject data on a live deployment).
 */
export const POST = handle(async () => {
  await requireDb();
  const user = await requireAuth();

  if (env.isProd && env.gmailConfigured) {
    throw new HttpError(403, 'Simulate mode is disabled in production. Use a real Gmail sync.');
  }

  const summary = await simulateIngest(user._id);
  return ok({ data: { ...summary, simulated: true } });
});
