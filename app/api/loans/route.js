import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/loans/loan.service';

export const dynamic = 'force-dynamic';

// List all loans + the two headline totals (youOwe / owedToYou).
export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const data = await service.listLoans(user._id);
  return ok({ data });
});

const createSchema = z.object({
  direction: z.enum(['borrowed', 'lent']),
  counterpartyName: z.string().trim().min(1, 'Who is the loan with?').max(60),
  principal: z.number().positive().max(1_000_000_000),
  accountId: z.string().min(1, 'Pick an account.'),
  note: z.string().trim().max(200).optional(),
  startDate: z.string().datetime().optional(),
});

// Create a loan. The principal move is a CONFIRMED txn (balance-guarded for LENT,
// which is a debit). 400 if a LENT amount exceeds the account balance.
export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const body = createSchema.parse(await readJson(req));
  const data = await service.createLoan(user._id, body);
  return ok({ data }, { status: 201 });
});
