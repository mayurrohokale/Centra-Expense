import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { toSafeUser } from '@/modules/users/user.model';

export const dynamic = 'force-dynamic';

// Kept for backward compatibility; same payload as /api/auth/me.
export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  return ok({ data: toSafeUser(user) });
});
