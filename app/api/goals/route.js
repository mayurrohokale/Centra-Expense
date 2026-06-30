import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/goals/goal.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const goals = await service.listGoals(user._id);
  return ok({ data: goals });
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  emoji: z.string().trim().max(8).optional(),
  target: z.number().min(1, 'Target must be positive').max(1_000_000_000),
  saved: z.number().min(0).max(1_000_000_000).optional(),
  theme: z.number().int().min(0).max(20).optional(),
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const data = createSchema.parse(await readJson(req));
  const goal = await service.createGoal(user._id, data);
  return ok({ data: goal }, { status: 201 });
});
