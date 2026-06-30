'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR, GRADIENT } from '../../common/theme/tokens.js';
import { AuthScreen, Brand, Field, PrimaryButton, FormError } from './authUI.jsx';

export default function Forgot({ goLogin }) {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (busy) return;
    setErr('');
    if (!email.trim()) { setErr('Enter your email.'); return; }
    setBusy(true);
    try {
      await api.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (e) {
      setErr(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthScreen>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 10px' }}>
          <div style={{ width: 76, height: 76, borderRadius: 26, background: GRADIENT.cash, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, boxShadow: '0 14px 30px rgba(31,174,99,.32)' }}>📬</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, marginTop: 22, letterSpacing: '-.4px' }}>Check your inbox!</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13.5, color: COLOR.muted, marginTop: 10, lineHeight: 1.55 }}>
            If an account exists for <b style={{ color: COLOR.ink }}>{email}</b>, we've sent a link to reset your password.
          </div>
          <div onClick={goLogin} style={{ marginTop: 28, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.purple, cursor: 'pointer' }}>← Back to log in</div>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Brand subtitle="Reset your password 🔑" />
      <FormError>{err}</FormError>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.muted, margin: '0 2px 18px', lineHeight: 1.55 }}>
        Enter the email linked to your account and we'll send you a link to set a new password.
      </div>
      <Field label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <PrimaryButton onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</PrimaryButton>
      <div onClick={goLogin} style={{ textAlign: 'center', marginTop: 24, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.mutedSoft, cursor: 'pointer' }}>← Back to log in</div>
    </AuthScreen>
  );
}
