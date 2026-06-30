/**
 * Centralized runtime config, read from process.env.
 *
 * In the Next.js app these come from `.env.local` (loaded automatically by
 * Next for server code). The standalone seed script loads `.env.local`
 * itself via common/config/loadEnv.js before importing this module.
 *
 * This module is server-only — never import it into client components.
 */

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGODB_URI || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Model for the AI extraction fallback. Default to the most capable model;
  // set ANTHROPIC_MODEL=claude-haiku-4-5 for cheaper/faster extraction.
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
  hasDb: !!process.env.MONGODB_URI,

  // ---- Auth ----
  jwtSecret: process.env.JWT_SECRET || '',
  appUrl: process.env.APP_URL || 'http://localhost:5000',

  // Google OAuth (sign-in). Blank → the Google button degrades gracefully.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
  get googleConfigured() {
    return !!(this.googleClientId && this.googleClientSecret);
  },

  // Gmail read-only ingestion (SEPARATE OAuth flow from sign-in). Reuses the
  // same Google client id/secret but a DISTINCT redirect URI. Blank client →
  // the Connect button degrades gracefully ("not configured", never a crash).
  gmailRedirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/connections/gmail/callback',
  get gmailConfigured() {
    return !!(this.googleClientId && this.googleClientSecret);
  },

  // Protects the Vercel Cron email-sync route from public invocation.
  cronSecret: process.env.CRON_SECRET || '',
};

// Dev fallback so the app still signs sessions before JWT_SECRET is set.
// configWarnings() surfaces a warning when this is in use.
const DEV_JWT_FALLBACK = 'centra-dev-insecure-jwt-secret-change-me-please-0123456789';

/** Resolved signing secret as a Uint8Array for jose. */
export function jwtSecretBytes() {
  const secret = env.jwtSecret && env.jwtSecret.length >= 32 ? env.jwtSecret : DEV_JWT_FALLBACK;
  return new TextEncoder().encode(secret);
}

/**
 * Returns a list of soft warnings about missing/placeholder config.
 * The app must NOT crash on these — it degrades gracefully (503 on DB routes).
 */
export function configWarnings() {
  const warnings = [];
  if (!env.mongoUri) {
    warnings.push('MONGODB_URI is not set — running without a database. Set it in .env.local, then run `npm run seed`.');
  }
  const keyOk = /^[0-9a-fA-F]{64}$/.test(env.encryptionKey) && env.encryptionKey !== '0'.repeat(64);
  if (!keyOk) {
    warnings.push('ENCRYPTION_KEY is missing, malformed, or a placeholder — token encryption will fall back to a dev key. Set a real 32-byte hex key for production.');
  }
  if (!env.anthropicApiKey) {
    warnings.push('ANTHROPIC_API_KEY is not set — AI extraction fallback is disabled (not needed for Milestone 1).');
  }
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    warnings.push('JWT_SECRET is missing or too short — sessions are signed with an insecure dev key. Set a 32+ char secret in .env.local for production.');
  }
  if (!env.googleConfigured) {
    warnings.push('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — "Continue with Google" and live Gmail ingestion are disabled until configured. Use the dev "Simulate fetch" to exercise the email pipe meanwhile.');
  }
  if (!env.cronSecret) {
    warnings.push('CRON_SECRET is not set — the scheduled /api/cron/email-sync route will reject all calls until it is set (manual & simulate sync still work).');
  }
  return warnings;
}
