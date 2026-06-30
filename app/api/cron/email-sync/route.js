import { handle, requireDb, ok, HttpError } from '@/common/api/http';
import { env } from '@/common/config/env';
import { logger } from '@/common/logger/logger';
import { listActiveByKind } from '@/modules/connections/connection.service';
import { syncGmailConnection } from '@/modules/email-ingestion/emailIngestion.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // give the sweep room on Vercel

/**
 * Scheduled auto-sync (Vercel Cron). Iterates every active Gmail connection
 * and syncs it. Protected by CRON_SECRET — Vercel Cron sends it as a Bearer
 * token (Authorization header); we also accept ?key= for manual testing.
 *
 * Public/unauthorized calls are rejected (401) so this can't be triggered to
 * burn quota or scrape inboxes.
 */
export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const provided = bearer || url.searchParams.get('key') || '';

  if (!env.cronSecret || provided !== env.cronSecret) {
    throw new HttpError(401, 'Unauthorized');
  }

  await requireDb();

  const conns = await listActiveByKind('gmail');
  const results = { connections: conns.length, created: 0, duplicate: 0, failed: 0, errors: 0 };

  for (const conn of conns) {
    try {
      const s = await syncGmailConnection(conn.userId, conn);
      results.created += s.created;
      results.duplicate += s.duplicate;
      results.failed += s.failed;
    } catch (err) {
      results.errors += 1;
      logger.warn(`Cron email-sync: a connection failed to sync.`, err?.message || '');
    }
  }

  logger.info(`Cron email-sync complete: ${results.connections} inbox(es), ${results.created} new txns.`);
  return ok({ data: results });
});
