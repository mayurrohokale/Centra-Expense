import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { getReport } from '@/modules/reports/report.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports?period=this_month | last_month | last_3_months | this_year
 * | custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns spending analytics for the period (confirmed transactions only),
 * user-scoped: { period, summary, byCategory, topMerchants, trend, byAccount,
 * incomeVsExpense }.
 */
export const GET = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const sp = new URL(req.url).searchParams;
  const data = await getReport(user._id, {
    period: sp.get('period') || 'this_month',
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
  });
  return ok({ data });
});
