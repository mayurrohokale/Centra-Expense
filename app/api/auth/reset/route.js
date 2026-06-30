import crypto from 'node:crypto';
import { z } from 'zod';
import { handle, requireDb, ok, HttpError, readJson } from '@/common/api/http';
import { hashPassword, passwordSchema } from '@/common/auth/password';
import { User } from '@/modules/users/user.model';

export const dynamic = 'force-dynamic';

const resetSchema = z.object({
  token: z.string().min(10, 'Invalid reset token'),
  password: passwordSchema,
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const POST = handle(async (req) => {
  await requireDb();
  const { token, password } = resetSchema.parse(await readJson(req));

  const user = await User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpiresAt: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpiresAt');

  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired.');

  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  return ok({ data: { message: 'Password updated. You can now log in.' } });
});
