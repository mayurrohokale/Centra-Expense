import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { markSalaryCredited } from '@/modules/salary/salary.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  // Editable before confirming — defaults to the expected salary if omitted.
  amount: z.number().positive().max(1_000_000_000).optional(),
  // Credit date (ISO). Defaults to today.
  date: z.string().datetime().optional(),
});

// Manual "Salary credited this month ✅" tick. Creates a CONFIRMED income credit
// on the salary account (flows through balance + reports). Idempotent per month
// (the service rejects with 409 if this month is already credited).
export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const body = schema.parse(await readJson(req));
  const data = await markSalaryCredited(user._id, body);
  return ok({ data }, { status: 201 });
});
