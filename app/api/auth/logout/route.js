import { NextResponse } from 'next/server';
import { handle } from '@/common/api/http';
import { clearSessionCookie } from '@/common/auth/session';

export const dynamic = 'force-dynamic';

export const POST = handle(async () => {
  const res = NextResponse.json({ data: { ok: true } });
  clearSessionCookie(res);
  return res;
});
