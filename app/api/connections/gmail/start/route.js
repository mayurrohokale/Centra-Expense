import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { handle, requireDb } from '@/common/api/http';
import { env } from '@/common/config/env';
import { requireAuth } from '@/common/auth/session';
import { signGmailState, buildGmailAuthUrl } from '@/modules/email-ingestion/gmailOAuth';

export const dynamic = 'force-dynamic';

const GMAIL_STATE_COOKIE = 'centra_gmail_oauth';

/**
 * Start the Gmail read-only OAuth flow for the logged-in user.
 * Degrades gracefully (no crash) when Google isn't configured.
 */
export const GET = handle(async () => {
  await requireDb();
  const user = await requireAuth();

  if (!env.gmailConfigured) {
    return NextResponse.redirect(`${env.appUrl}/?tab=email&gmail=unconfigured`);
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const state = await signGmailState(user._id, nonce);

  const res = NextResponse.redirect(buildGmailAuthUrl(state));
  res.cookies.set(GMAIL_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: 600,
  });
  return res;
});
