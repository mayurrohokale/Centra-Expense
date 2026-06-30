import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/holdings/holding.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const type = new URL(req.url).searchParams.get('type') || undefined;
  const data = await service.listHoldings(user._id, { instrumentType: type });
  return ok({ data });
});

const createSchema = z.object({
  instrumentType: z.enum(['mutual_fund', 'crypto', 'fd']),
  name: z.string().min(1),
  tag: z.string().optional(),
  color: z.string().optional(),
  subtitle: z.string().optional(),
  investedValue: z.number().nonnegative(),
  currentValue: z.number().nonnegative(),
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
