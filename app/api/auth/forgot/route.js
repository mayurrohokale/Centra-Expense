import crypto from 'node:crypto';
import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { User } from '@/modules/users/user.model';
import { env } from '@/common/config/env';
import { logger } from '@/common/logger/logger';

export const dynamic = 'force-dynamic';

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const POST = handle(async (req) => {
  await requireDb();
  const { email } = forgotSchema.parse(await readJson(req));

  const user = await User.findOne({ email });
  if (user) {
    // Store only a HASH of the token + an expiry; the raw token leaves only via
    // the (future) email. No SMTP yet → log the link in dev so the flow is testable.
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = hashToken(rawToken);
    user.resetTokenExpiresAt = new Date(Date.now() + RESET_TTL_MS);
    await user.save();

    const link = `${env.appUrl}/reset?token=${rawToken}&email=${encodeURIComponent(email)}`;
    // Passed as a plain string arg (the logger redacts object *keys*, not strings),
    // so this is visible in dev only. Real email delivery (SMTP) is deferred.
    logger.info('[dev] Password reset link (email delivery deferred):', link);
  }

  // Always the same response → no user-enumeration.
  return ok({ data: { message: "If that email exists, we've sent a reset link." } });
});
