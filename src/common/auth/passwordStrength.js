/**
 * Dependency-free password strength scorer (0..4). Safe to import in client
 * components (no bcrypt/zod). The signup meter and the server use the same
 * function so "Too weak → Strong" stays consistent.
 */
export function scorePassword(p = '') {
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 12) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
  if (/[0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p)) score += 1;
  return Math.min(4, score);
}
