'use client';
import { useEffect, useMemo, useState } from 'react';
import MobileFrame from '@/common/ui/MobileFrame';
import { api } from '@/common/lib/api.js';
import { FONT, COLOR, GRADIENT } from '@/common/theme/tokens.js';
import { scorePassword } from '@/common/auth/passwordStrength.js';
import { AuthScreen, Brand, PasswordField, PrimaryButton, FormError } from '@/features/auth/authUI.jsx';

export default function ResetPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  const score = useMemo(() => scorePassword(password), [password]);

  async function submit() {
    if (busy) return;
    setErr('');
    if (!token) { setErr('This reset link is missing its token.'); return; }
    if (score < 1 || password.length < 8) { setErr('Password must be at least 8 characters with a letter and a number.'); return; }
    if (password !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
    } catch (e) {
      setErr(e.message || 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileFrame>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {done ? (
          <AuthScreen>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 10px' }}>
              <div style={{ width: 76, height: 76, borderRadius: 26, background: GRADIENT.cash, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, boxShadow: '0 14px 30px rgba(31,174,99,.32)' }}>✅</div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, marginTop: 22, letterSpacing: '-.4px' }}>Password updated</div>
              <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13.5, color: COLOR.muted, marginTop: 10, lineHeight: 1.55 }}>You can now log in with your new password.</div>
              <a href="/" style={{ marginTop: 28, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.purple, textDecoration: 'none' }}>Go to log in →</a>
            </div>
          </AuthScreen>
        ) : (
          <AuthScreen>
            <Brand subtitle="Set a new password 🔐" />
            <FormError>{err}</FormError>
            <PasswordField label="NEW PASSWORD" value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <PasswordField label="CONFIRM PASSWORD" value={confirm} onChange={setConfirm} placeholder="Re-enter password" autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <PrimaryButton onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Update password'}</PrimaryButton>
            <a href="/" style={{ display: 'block', textAlign: 'center', marginTop: 24, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.mutedSoft, textDecoration: 'none' }}>← Back to log in</a>
          </AuthScreen>
        )}
      </div>
    </MobileFrame>
  );
}
