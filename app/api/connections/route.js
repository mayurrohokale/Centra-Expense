import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/connections/connection.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const data = await service.listConnections(user._id);
  return ok({ data });
});

const upsertSchema = z.object({
  kind: z.enum(['gmail', 'outlook', 'aa_setu', 'aa_finvu']),
  accountId: z.string().optional(),
  label: z.string().optional(),
  provider: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  // M1: real OAuth deferred. Accept a stub token object so the connect flow
  // can demonstrate encrypted-at-rest storage end to end.
  tokens: z.record(z.any()).optional(),
  consentExpiresAt: z.string().datetime().optional(),
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const body = upsertSchema.parse(await readJson(req));
  const conn = await service.upsertConnection(user._id, body);
  return ok({ data: conn }, { status: 201 });
});
