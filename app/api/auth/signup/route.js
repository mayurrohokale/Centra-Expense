import { z } from 'zod';
import { NextResponse } from 'next/server';
import { handle, requireDb, HttpError, readJson } from '@/common/api/http';
import { setSessionCookie } from '@/common/auth/session';
import { hashPassword, passwordSchema } from '@/common/auth/password';
import { provisionNewUser } from '@/modules/users/provisionUser';
import { User, toSafeUser } from '@/modules/users/user.model';

export const dynamic = 'force-dynamic';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: passwordSchema,
});

export const POST = handle(async (req) => {
  await requireDb();
  const { name, email, password } = signupSchema.parse(await readJson(req));

  const existing = await User.findOne({ email }).lean();
  if (existing) throw new HttpError(409, 'An account with this email already exists');

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, avatarEmoji: '👋' });

  // Starter set so the new user's app isn't empty/broken.
  await provisionNewUser(user._id);

  const res = NextResponse.json({ data: toSafeUser(user) }, { status: 201 });
  await setSessionCookie(res, user._id);
  return res;
});
