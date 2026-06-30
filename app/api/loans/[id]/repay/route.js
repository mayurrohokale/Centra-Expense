import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/loans/loan.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  amount: z.number().positive().max(1_000_000_000),
  accountId: z.string().min(1, 'Pick an account.'),
  date: z.string().datetime().optional(),
});

// Record a repayment. Creates a CONFIRMED txn (balance-guarded for a BORROWED
// loan, where I pay them back = a debit). Rejects amount > outstanding (400);
// settles the loan at 0.
export const POST = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const body = schema.parse(await readJson(req));
  const data = await service.repayLoan(user._id, id, body);
  return ok({ data }, { status: 201 });
});
