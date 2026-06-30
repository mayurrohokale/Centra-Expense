import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/accounts/account.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const type = new URL(req.url).searchParams.get('type') || undefined;
  const accounts = await service.listAccounts(user._id, { type });
  return ok({ data: accounts });
});

const createSchema = z.object({
  type: z.enum(['bank', 'cash']),
  name: z.string().trim().min(1, 'Name is required').max(60),
  institution: z.string().trim().max(60).optional(),
  last4: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, 'Use up to 4 digits')
    .optional(),
  balance: z.number().min(0).max(1_000_000_000).optional(),
  currency: z.string().trim().max(8).optional(),
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const data = createSchema.parse(await readJson(req));
  const account = await service.createAccount(user._id, data);
  return ok({ data: account }, { status: 201 });
});
