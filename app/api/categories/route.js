import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/categories/category.service';
import { backfillCategories } from '@/modules/users/provisionUser';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  // Self-healing: ensure existing users pick up newly-shipped default categories
  // (fuel/groceries/fashion/electricity/recharge/…). Idempotent + cheap — only
  // inserts keys the user is missing, never overwrites their customizations.
  await backfillCategories(user._id);
  const data = await service.listCategories(user._id);
  return ok({ data });
});
