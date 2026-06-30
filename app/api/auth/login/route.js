import { z } from 'zod';
import { NextResponse } from 'next/server';
import { handle, requireDb, HttpError, readJson } from '@/common/api/http';
import { setSessionCookie } from '@/common/auth/session';
import { verifyPassword } from '@/common/auth/password';
import { User, toSafeUser } from '@/modules/users/user.model';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = handle(async (req) => {
  await requireDb();
  const { email, password } = loginSchema.parse(await readJson(req));

  // passwordHash is select:false → ask for it explicitly here only.
  const user = await User.findOne({ email }).select('+passwordHash');

  // Generic error on any failure → no user-enumeration.
  const okPass = user && (await verifyPassword(password, user.passwordHash));
  if (!okPass) throw new HttpError(401, 'Invalid email or password');

  const res = NextResponse.json({ data: toSafeUser(user) });
  await setSessionCookie(res, user._id);
  return res;
});
