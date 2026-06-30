import { NextResponse } from 'next/server';
import { handle, requireDb } from '@/common/api/http';
import { env } from '@/common/config/env';
import { logger } from '@/common/logger/logger';
import {
  verifyGmailState, exchangeGmailCode, getGmailProfile, expiryFromNow, GMAIL_SCOPE,
} from '@/modules/email-ingestion/gmailOAuth';
import { upsertConnection } from '@/modules/connections/connection.service';

export const dynamic = 'force-dynamic';

const GMAIL_STATE_COOKIE = 'centra_gmail_oauth';

function back(flag) {
  return NextResponse.redirect(`${env.appUrl}/?tab=email&gmail=${flag}`);
}

/**
 * Gmail OAuth callback: verify state → exchange code → read the mailbox
 * address → store an ENCRYPTED gmail connection (refresh+access tokens) for
 * the user. Tokens are never logged or stored in plaintext.
 */
export const GET = handle(async (req) => {
  if (!env.gmailConfigured) return back('unconfigured');

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const nonceCookie = req.cookies.get(GMAIL_STATE_COOKIE)?.value;

  if (oauthError) {
    logger.warn(`[gmail-callback] Google returned error param: ${oauthError}`);
    return back('denied');
  }
  if (!code || !state) {
    logger.warn(`[gmail-callback] missing code/state (code=${!!code}, state=${!!state})`);
    return back('failed');
  }

  // ---- CSRF / state verification (each failure reason logged distinctly) ----
  const verified = await verifyGmailState(state);
  if (!verified) {
    logger.warn('[gmail-callback] state JWT invalid or expired (>10 min between start and callback?). Reconnect.');
    return back('failed');
  }
  if (!nonceCookie) {
    logger.warn('[gmail-callback] state cookie missing on callback (cookie not returned — SameSite/host/secure?).');
    return back('failed');
  }
  if (verified.nonce !== nonceCookie) {
    logger.warn('[gmail-callback] state nonce mismatch (possible CSRF or a stale/concurrent flow).');
    return back('failed');
  }

  await requireDb();

  let tokens;
  let profile;
  try {
    logger.info(`[gmail-callback] exchanging code for tokens (redirect_uri=${env.gmailRedirectUri})`);
    tokens = await exchangeGmailCode(code);
    if (!tokens?.refresh_token) {
      // Google omits refresh_token if the user previously consented without
      // revoking. prompt=consent should prevent this; surface a clear flag.
      logger.warn('[gmail-callback] no refresh_token returned (re-consent needed).');
      return back('no_refresh');
    }
    logger.info('[gmail-callback] token exchange ok; fetching mailbox profile.');
    profile = await getGmailProfile(tokens.access_token);
    logger.info(`[gmail-callback] profile ok for ${profile.emailAddress || '(no address)'}.`);
  } catch (err) {
    // Full reason + stack so the terminal shows the real cause (token bodies
    // are never logged; only Google's error code/description).
    logger.error('[gmail-callback] token exchange / profile failed:', err?.message || 'unknown');
    if (err?.stack) logger.error(err.stack);
    return back('failed');
  }

  // ---- Persist (guarded, so a DB/validation error redirects + logs, not 500) ----
  try {
    // Keyed on emailAddress → connecting a NEW inbox appends a connection;
    // re-connecting the SAME inbox updates its tokens in place (no duplicate).
    await upsertConnection(verified.userId, {
      kind: 'gmail',
      accountId: null, // one inbox scans all monitored bank senders
      emailAddress: profile.emailAddress,
      label: profile.emailAddress,
      provider: 'Google',
      scopes: [GMAIL_SCOPE],
      tokens: {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        scope: tokens.scope,
      },
      tokenExpiresAt: expiryFromNow(tokens.expires_in),
      historyId: profile.historyId,
    });
    logger.info(`[gmail-callback] connection saved for ${profile.emailAddress}.`);
  } catch (err) {
    logger.error('[gmail-callback] saving the connection failed:', err?.message || 'unknown');
    if (err?.stack) logger.error(err.stack);
    return back('save_failed');
  }

  const res = back('connected');
  res.cookies.set(GMAIL_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
