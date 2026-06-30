import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { toSafeUser } from '@/modules/users/user.model';
import { completeOnboarding } from '@/modules/users/user.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['complete', 'skip']).default('complete'),
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const { action } = bodySchema.parse(await readJson(req));
  const updated = await completeOnboarding(user._id, { skip: action === 'skip' });
  return ok({ data: toSafeUser(updated) });
});
