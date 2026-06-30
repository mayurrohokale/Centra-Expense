import { SignJWT, jwtVerify } from 'jose';
import { jwtSecretBytes } from '../config/env.js';

/**
 * Session JWTs, signed with HS256 via `jose` (works in both the Node.js and
 * Edge runtimes, so the same code can be used in middleware if needed).
 *
 * The token payload is intentionally minimal — just the user id (`sub`). All
 * other user data is loaded fresh from the DB on each request.
 */

const ISSUER = 'centra-expense';
const AUDIENCE = 'centra-app';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export async function signSession(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(jwtSecretBytes());
}

/** Verify a session token → its payload, or null when invalid/expired. */
export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecretBytes(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload;
  } catch {
    return null;
  }
}
