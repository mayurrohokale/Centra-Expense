import { cookies } from 'next/headers';
import { env } from '../config/env.js';
import { HttpError } from '../api/http.js';
import { signSession, verifySession, SESSION_MAX_AGE_SEC } from './jwt.js';
import { User } from '../../modules/users/user.model.js';

/**
 * Session glue: a single httpOnly cookie holding a signed JWT.
 *
 * - getAuthUser(): reads + verifies the cookie and loads the user. Returns null
 *   when there is no valid session. This REPLACES the old devUser context.
 * - requireAuth(): getAuthUser() or throw 401 — used by every protected route.
 * - setSessionCookie / clearSessionCookie: mutate a NextResponse's cookies.
 */

export const SESSION_COOKIE = 'centra_session';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd, // Secure in prod; allows http://localhost in dev
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

/** Attach a fresh signed session cookie to a NextResponse. */
export async function setSessionCookie(res, userId) {
  const token = await signSession(userId);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}

/** Clear the session cookie on a NextResponse (logout). */
export function clearSessionCookie(res) {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return res;
}

/** Read + verify the session cookie and load the user, or null. */
export async function getAuthUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload?.sub) return null;
  try {
    const user = await User.findById(payload.sub).lean();
    return user || null;
  } catch {
    return null;
  }
}

/** Authenticated user or a clean 401 — the single guard every data route uses. */
export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) throw new HttpError(401, 'Not authenticated');
  return user;
}
