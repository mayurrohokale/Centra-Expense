import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { getSalaryStatus } from '@/modules/salary/salary.service';

export const dynamic = 'force-dynamic';

// This month's salary status: configured?, expected amount/day, salary account,
// and whether the salary has been credited (auto-detected or manually ticked).
export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const data = await getSalaryStatus(user._id);
  return ok({ data });
});
