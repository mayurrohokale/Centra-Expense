import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/categories/category.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const data = await service.listCategories(user._id);
  return ok({ data });
});
