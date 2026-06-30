import { SignJWT, jwtVerify } from 'jose';
import { env, jwtSecretBytes } from '../../common/config/env.js';
import { httpRequest } from '../../common/http/httpClient.js';
import { logger } from '../../common/logger/logger.js';

/**
 * Gmail read-only OAuth — a SEPARATE flow from app sign-in.
 *
 * Scope: gmail.readonly (restricted/sensitive — prod use needs Google
 * verification). access_type=offline + prompt=consent so Google returns a
 * refresh token, which we encrypt at rest. Plaintext tokens are never logged
 * or persisted (only ciphertext, via the connections model).
 */

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const STATE_TTL = '10m';
const STATE_ISSUER = 'centra-gmail-oauth';

/** Sign a short-lived state token binding the flow to the logged-in user + a CSRF nonce. */
export async function signGmailState(userId, nonce) {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(STATE_ISSUER)
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(jwtSecretBytes());
}

/** Verify the state token → { userId, nonce } or null. */
export async function verifyGmailState(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecretBytes(), { issuer: STATE_ISSUER });
    return { userId: payload.sub, nonce: payload.nonce };
  } catch {
    return null;
  }
}

/** Build the Google consent URL for the gmail.readonly flow. */
export function buildGmailAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.gmailRedirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    state,
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even on re-consent
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Read Google's OAuth error body (safe to log: it carries error codes like
 * `invalid_client` / `invalid_grant` / `redirect_uri_mismatch`, never secrets).
 * Returns a short "error: error_description" string for diagnostics.
 */
async function googleErrorDetail(res) {
  try {
    const data = await res.clone().json();
    // Two shapes: OAuth2 token endpoint → { error: "invalid_client", error_description }
    // Google API endpoints → { error: { code, message, status } }
    if (data.error && typeof data.error === 'object') {
      const e = data.error;
      const status = e.status ? ` (${e.status})` : '';
      return `${e.message || 'unknown_error'}${status}`;
    }
    const code = data.error || 'unknown_error';
    const desc = data.error_description ? ` — ${data.error_description}` : '';
    return `${code}${desc}`;
  } catch {
    return `http_${res.status}`;
  }
}

/** Exchange an auth code → { access_token, refresh_token, expires_in, scope }. */
export async function exchangeGmailCode(code) {
  const res = await httpRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.gmailRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const detail = await googleErrorDetail(res);
    // No secrets in this body — surface Google's exact reason for the terminal.
    logger.error(`[gmail-callback] token exchange failed (${res.status}): ${detail} | redirect_uri=${env.gmailRedirectUri}`);
    throw new Error(`GMAIL_TOKEN_EXCHANGE_FAILED: ${detail}`);
  }
  return res.json();
}

/**
 * Mint a fresh access token from a stored refresh token.
 * Returns { access_token, expires_in } (Google does not re-issue a refresh
 * token here — the stored one is reused).
 */
export async function refreshGmailAccessToken(refreshToken) {
  const res = await httpRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    logger.warn(`Gmail token refresh failed: ${res.status}`);
    throw new Error('GMAIL_TOKEN_REFRESH_FAILED');
  }
  const json = await res.json();
  return { access_token: json.access_token, expires_in: json.expires_in };
}

/** Compute an absolute expiry Date from Google's expires_in (seconds), with skew. */
export function expiryFromNow(expiresInSec) {
  const secs = Number(expiresInSec);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  return new Date(Date.now() + secs * 1000);
}

/**
 * Read the connected mailbox profile: { emailAddress, historyId }.
 * emailAddress is the per-account identity + connection label; historyId is a
 * forward-compat sync cursor.
 */
export async function getGmailProfile(accessToken) {
  const res = await httpRequest('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await googleErrorDetail(res);
    logger.error(`[gmail-callback] profile fetch failed (${res.status}): ${detail}`);
    throw new Error(`GMAIL_PROFILE_FAILED: ${detail}`);
  }
  const json = await res.json();
  return { emailAddress: json.emailAddress || '', historyId: json.historyId || null };
}

/** Back-compat shim: just the mailbox address. */
export async function getGmailAddress(accessToken) {
  return (await getGmailProfile(accessToken)).emailAddress;
}

/**
 * Best-effort revocation of a token at Google's side (refresh or access token).
 * Never throws — local disconnect must always succeed even if Google is
 * unreachable. The caller still clears the stored ciphertext regardless.
 */
export async function revokeGoogleToken(token) {
  if (!token) return false;
  try {
    const res = await httpRequest('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch (err) {
    logger.warn('Google token revoke failed (continuing with local disconnect).', err?.message || '');
    return false;
  }
}
