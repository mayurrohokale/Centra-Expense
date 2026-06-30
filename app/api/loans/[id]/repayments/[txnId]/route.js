import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/loans/loan.service';

export const dynamic = 'force-dynamic';

// Delete a single repayment: reverses its balance effect + re-derives the loan's
// outstanding (may re-open a settled loan). Refuses the principal txn.
export const DELETE = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id, txnId } = await ctx.params;
  const data = await service.deleteRepayment(user._id, id, txnId);
  return ok({ data });
});
