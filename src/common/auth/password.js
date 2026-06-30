import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { scorePassword } from './passwordStrength.js';

/**
 * Password hashing + validation.
 *
 * We use `bcryptjs` (pure-JS, no native build) so this works identically on
 * Windows dev and Vercel serverless. Only the bcrypt hash is ever stored.
 */

const SALT_ROUNDS = 12;

/** Server-side minimum strength. The signup UI shows a 4-bar meter; this is the
 * hard floor we enforce regardless of the client. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long') // bcrypt only uses the first 72 bytes
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), {
    message: 'Password must include at least one letter and one number',
  });

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// Re-export the dependency-free scorer (client imports it from passwordStrength.js).
export { scorePassword };
