'use client';
import { useMemo, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { scorePassword } from '../../common/auth/passwordStrength.js';
import { AuthScreen, Brand, Field, PasswordField, PrimaryButton, GoogleButton, Divider, FormError } from './authUI.jsx';

const METER = [
  { label: 'Too weak', color: '#FF6B5E' },
  { label: 'Weak', color: '#FF9F1C' },
  { label: 'Fair', color: '#FFB23E' },
  { label: 'Good', color: '#34D39E' },
  { label: 'Strong', color: '#1FAE63' },
];

function StrengthMeter({ password }) {
  const score = useMemo(() => scorePassword(password), [password]);
  const meta = METER[score];
  const filled = password ? Math.max(1, score) : 0;
  return (
    <div style={{ margin: '-4px 2px 16px' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 4, background: i < filled ? meta.color : '#eee6f3', transition: 'background .2s' }} />
        ))}
      </div>
      {password ? (
        <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: meta.color, marginTop: 6 }}>{meta.label}</div>
      ) : (
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft, marginTop: 6 }}>Use 8+ chars with a letter and a number</div>
      )}
    </div>
  );
}

export default function Signup({ onAuthed, goLogin, onGoogle }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setErr('');
    if (!name.trim()) { setErr('Tell us your name.'); return; }
    if (!email.trim()) { setErr('Enter your email.'); return; }
    if (scorePassword(password) < 1 || password.length < 8) { setErr('Password must be at least 8 characters with a letter and a number.'); return; }
    if (password !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const res = await api.signup({ name: name.trim(), email: email.trim(), password });
      onAuthed(res.data);
    } catch (e) {
      setErr(e.message || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  const onEnter = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <AuthScreen>
      <Brand subtitle="Create your account ✨" />
      <FormError>{err}</FormError>

      <Field label="FULL NAME" value={name} onChange={setName} placeholder="Aditya Sharma" autoComplete="name" onKeyDown={onEnter} />
      <Field label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" onKeyDown={onEnter} />
      <PasswordField label="PASSWORD" value={password} onChange={setPassword} placeholder="Create a password" autoComplete="new-password" onKeyDown={onEnter} />
      <StrengthMeter password={password} />
      <PasswordField label="CONFIRM PASSWORD" value={confirm} onChange={setConfirm} placeholder="Re-enter password" autoComplete="new-password" onKeyDown={onEnter} />

      <PrimaryButton onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</PrimaryButton>

      <Divider />
      <GoogleButton onClick={onGoogle} />

      <div style={{ textAlign: 'center', marginTop: 26, fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.muted }}>
        Already have an account?{' '}
        <span onClick={goLogin} style={{ fontFamily: FONT.jakarta, fontWeight: 700, color: COLOR.purple, cursor: 'pointer' }}>Log in</span>
      </div>
    </AuthScreen>
  );
}
