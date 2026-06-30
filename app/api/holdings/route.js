import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/holdings/holding.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const sp = new URL(req.url).searchParams;
  const data = await service.listHoldings(user._id, {
    instrumentType: sp.get('type') || undefined,
    source: sp.get('source') || undefined,
  });
  return ok({ data });
});

const createSchema = z.object({
  instrumentType: z.enum(['mutual_fund', 'crypto', 'fd', 'stocks', 'gold', 'other']),
  name: z.string().min(1),
  tag: z.string().optional(),
  color: z.string().optional(),
  subtitle: z.string().optional(),
  investedValue: z.number().nonnegative(),
  // Optional for manual entries — defaults to investedValue server-side.
  currentValue: z.number().nonnegative().optional(),
  units: z.number().optional(),
  schemeCode: z.string().optional(),
  interestRate: z.number().optional(),
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const body = createSchema.parse(await readJson(req));
  const data = await service.createHolding(user._id, body);
  return ok({ data }, { status: 201 });
});
