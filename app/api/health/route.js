import { handle, ok } from '@/common/api/http';
import { dbState } from '@/common/db/connect';

// Health probe — stays alive even when the DB is down (never calls requireDb).
export const dynamic = 'force-dynamic';

export const GET = handle(async () =>
  ok({ ok: true, db: dbState(), uptime: process.uptime() })
);
