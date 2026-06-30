import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { handle } from '@/common/api/http';
import { env } from '@/common/config/env';

export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'centra_oauth_state';

/**
 * Start Google sign-in: redirect the browser to Google's consent screen.
 * If Google isn't configured, degrade gracefully → bounce back to the app with
 * a flag the auth screen turns into a clear "not configured" message.
 */
export const GET = handle(async () => {
  if (!env.googleConfigured) {
    return NextResponse.redirect(`${env.appUrl}/?auth=google_unconfigured`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  // Short-lived, httpOnly CSRF state cookie.
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: 600,
  });
  return res;
});
