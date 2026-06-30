import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/loans/loan.service';

export const dynamic = 'force-dynamic';

// Repayment history for a loan (linked txns, excluding the principal).
export const GET = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const data = await service.listRepayments(user._id, id);
  return ok({ data });
});
