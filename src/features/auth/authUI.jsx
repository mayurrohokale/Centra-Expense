'use client';
import { useState } from 'react';
import { FONT, COLOR, GRADIENT } from '../../common/theme/tokens.js';
import Logo from '../../common/ui/Logo';

// Shared building blocks for the Login / Signup / Forgot screens so they share
// the exact same tokens, gradient CTA, and field styling as the rest of the app.

export function AuthScreen({ children }) {
  return (
    <div style={{ minHeight: '100%', padding: '34px 26px 32px', display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}

export function Brand({ subtitle }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 26 }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: 22, margin: '0 auto 16px',
          boxShadow: '0 14px 30px rgba(255,111,165,.4)', lineHeight: 0,
        }}
      >
        <Logo size={64} round={22} />
      </div>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink, letterSpacing: '-.6px' }}>Centra Expense</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.muted, marginTop: 5 }}>{subtitle}</div>
    </div>
  );
}

export function Field({ label, type = 'text', value, onChange, placeholder, autoComplete, rightSlot, onKeyDown }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: COLOR.muted, margin: '0 2px 7px', letterSpacing: '.3px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 15px', borderRadius: 16, background: '#fff', border: '1.5px solid #f1ecf6', boxShadow: '0 8px 18px rgba(90,70,130,.05)' }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink, minWidth: 0 }}
        />
        {rightSlot}
      </div>
    </div>
  );
}

export function PasswordField({ label, value, onChange, placeholder, autoComplete, onKeyDown }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onKeyDown={onKeyDown}
      rightSlot={
        <span onClick={() => setShow((s) => !s)} style={{ fontSize: 17, cursor: 'pointer', userSelect: 'none', opacity: 0.7 }}>
          {show ? '🙈' : '👁️'}
        </span>
      }
    />
  );
}

export function PrimaryButton({ children, onClick, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        marginTop: 6, padding: 16, borderRadius: 18, textAlign: 'center',
        background: GRADIENT.brand, boxShadow: '0 14px 30px rgba(255,111,165,.4)',
        fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15.5, color: '#fff',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.65 : 1, transition: 'opacity .15s',
      }}
    >
      {children}
    </div>
  );
}

export function GoogleButton({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 14, borderRadius: 16, textAlign: 'center', background: '#fff',
        border: '1.5px solid #ece6f3', boxShadow: '0 8px 18px rgba(90,70,130,.05)',
        fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}
    >
      <GoogleGlyph /> Continue with Google
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.5 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.2-9.6 6.2-17z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.1-5.5c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.8-4-13.7-9.9l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function Divider({ label = 'or' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
      <div style={{ flex: 1, height: 1.5, background: '#eee6f3' }} />
      <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: COLOR.mutedSoft }}>{label}</span>
      <div style={{ flex: 1, height: 1.5, background: '#eee6f3' }} />
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div style={{ margin: '0 0 14px', padding: '11px 14px', borderRadius: 13, background: '#FFEFEC', border: '1.5px solid #ffd3ca', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: '#d6483b' }}>
      ⚠️ {children}
    </div>
  );
}

export function Notice({ children, tone = 'info' }) {
  if (!children) return null;
  const palette = tone === 'info'
    ? { bg: '#F4ECFF', border: '#e4d8fb', fg: '#7a5fc0' }
    : { bg: '#FFF6DB', border: '#ffe6a8', fg: '#8a6d12' };
  return (
    <div style={{ margin: '0 0 14px', padding: '11px 14px', borderRadius: 13, background: palette.bg, border: `1.5px solid ${palette.border}`, fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: palette.fg }}>
      {children}
    </div>
  );
}
