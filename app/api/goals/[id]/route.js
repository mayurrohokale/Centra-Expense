import { z } from 'zod';
import { handle, requireDb, ok, HttpError, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/goals/goal.service';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  emoji: z.string().trim().max(8).optional(),
  target: z.number().min(1).max(1_000_000_000).optional(),
  saved: z.number().min(0).max(1_000_000_000).optional(),
  addAmount: z.number().min(-1_000_000_000).max(1_000_000_000).optional(),
});

export const PATCH = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const patch = patchSchema.parse(await readJson(req));
  const updated = await service.updateGoal(user._id, id, patch);
  if (!updated) throw new HttpError(404, 'Goal not found');
  return ok({ data: updated });
});

export const DELETE = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const removed = await service.deleteGoal(user._id, id);
  if (!removed) throw new HttpError(404, 'Goal not found');
  return ok({ data: { _id: removed._id, isActive: removed.isActive } });
});
