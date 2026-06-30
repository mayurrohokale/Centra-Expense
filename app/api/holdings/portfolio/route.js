import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/holdings/holding.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const data = await service.getPortfolio(user._id);
  return ok({ data });
});
