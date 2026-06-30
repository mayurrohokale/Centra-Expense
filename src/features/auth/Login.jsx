'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { AuthScreen, Brand, Field, PasswordField, PrimaryButton, GoogleButton, Divider, FormError } from './authUI.jsx';

export default function Login({ onAuthed, goSignup, goForgot, onGoogle }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setErr('');
    if (!email || !password) { setErr('Enter your email and password.'); return; }
    setBusy(true);
    try {
      const res = await api.login({ email, password });
      onAuthed(res.data);
    } catch (e) {
      setErr(e.message || 'Could not log you in.');
    } finally {
      setBusy(false);
    }
  }

  const onEnter = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <AuthScreen>
      <Brand subtitle="Welcome back 👋" />
      <FormError>{err}</FormError>

      <Field label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" onKeyDown={onEnter} />
      <PasswordField label="PASSWORD" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" onKeyDown={onEnter} />

      <div onClick={goForgot} style={{ textAlign: 'right', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.purple, margin: '2px 2px 18px', cursor: 'pointer' }}>
        Forgot password?
      </div>

      <PrimaryButton onClick={submit} disabled={busy}>{busy ? 'Logging in…' : 'Log In'}</PrimaryButton>

      <Divider />
      <GoogleButton onClick={onGoogle} />

      <div style={{ textAlign: 'center', marginTop: 26, fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.muted }}>
        New here?{' '}
        <span onClick={goSignup} style={{ fontFamily: FONT.jakarta, fontWeight: 700, color: COLOR.purple, cursor: 'pointer' }}>Create an account</span>
      </div>
    </AuthScreen>
  );
}
