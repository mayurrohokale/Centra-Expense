import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { passwordSchema } from '@/common/auth/password';
import { changePassword } from '@/modules/users/user.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const { currentPassword, newPassword } = bodySchema.parse(await readJson(req));
  await changePassword(user._id, currentPassword, newPassword);
  return ok({ data: { ok: true } });
});
