import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/loans/loan.service';

export const dynamic = 'force-dynamic';

// Delete a whole loan: reverses every linked txn's balance effect, then removes it.
export const DELETE = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const data = await service.deleteLoan(user._id, id);
  return ok({ data });
});
