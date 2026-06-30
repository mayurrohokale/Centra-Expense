import { z } from 'zod';
import { handle, requireDb, ok, HttpError, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/accounts/account.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const account = await service.getAccount(user._id, id);
  if (!account) throw new HttpError(404, 'Account not found');
  return ok({ data: account });
});

const patchSchema = z.object({
  balance: z.number().optional(),
  spentThisMonth: z.number().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  institution: z.string().trim().max(60).optional(),
  last4: z.string().trim().regex(/^\d{0,4}$/, 'Use up to 4 digits').optional(),
  lastActivity: z.string().optional(),
});

export const PATCH = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const patch = patchSchema.parse(await readJson(req));
  const updated = await service.updateAccount(user._id, id, patch);
  if (!updated) throw new HttpError(404, 'Account not found');
  return ok({ data: updated });
});

export const DELETE = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const removed = await service.softDeleteAccount(user._id, id);
  if (!removed) throw new HttpError(404, 'Account not found');
  return ok({ data: { _id: removed._id, isActive: removed.isActive } });
});
