import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/goals/goal.service';

export const dynamic = 'force-dynamic';

// Contribution activity log for a goal: linked transactions with date, amount,
// account and status (pending=needs_review | confirmed). Newest first.
export const GET = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const data = await service.listGoalContributions(user._id, id);
  return ok({ data });
});
