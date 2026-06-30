import { NextResponse } from 'next/server';
import { handle, requireDb } from '@/common/api/http';
import { env } from '@/common/config/env';
import { logger } from '@/common/logger/logger';
import { setSessionCookie } from '@/common/auth/session';
import { provisionNewUser } from '@/modules/users/provisionUser';
import { User } from '@/modules/users/user.model';

export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'centra_oauth_state';

function fail(reason) {
  return NextResponse.redirect(`${env.appUrl}/?auth=google_failed`);
}

/**
 * Google OAuth callback: exchange the code, fetch the profile, find-or-create
 * the user (linking by email when it matches), set the session, and redirect
 * into the app.
 */
export const GET = handle(async (req) => {
  if (!env.googleConfigured) {
    return NextResponse.redirect(`${env.appUrl}/?auth=google_unconfigured`);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('state_mismatch');
  }

  await requireDb();

  // 1) Exchange the authorization code for tokens.
  let profile;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('token_exchange');
    const tokens = await tokenRes.json();

    // 2) Fetch the user's basic profile (never persist the access token).
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) return fail('userinfo');
    profile = await profileRes.json();
  } catch (err) {
    logger.warn('Google OAuth exchange failed:', err?.message || 'unknown');
    return fail('network');
  }

  const googleId = profile.sub;
  const email = (profile.email || '').toLowerCase();
  const name = profile.name || email.split('@')[0] || 'Centra user';
  if (!googleId || !email) return fail('no_profile');

  // 3) Find-or-create. Link to an existing email account when present.
  let user = await User.findOne({ googleId });
  let isNew = false;
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = googleId;
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
      await user.save();
    } else {
      user = await User.create({
        name,
        email,
        googleId,
        avatarUrl: profile.picture || '',
        avatarEmoji: '👋',
      });
      isNew = true;
    }
  }
  if (isNew) await provisionNewUser(user._id);

  const res = NextResponse.redirect(`${env.appUrl}/`);
  await setSessionCookie(res, user._id);
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
