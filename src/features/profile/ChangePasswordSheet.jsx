'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import Sheet from '../../common/ui/Sheet.jsx';

const inputStyle = {
  width: '100%', padding: '13px 16px', borderRadius: 16, background: '#FBF8F4',
  border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter,
  fontWeight: 600, fontSize: 14, color: COLOR.ink,
};
const labelStyle = {
  fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft,
  margin: '14px 2px 7px', letterSpacing: '.4px',
};

export default function ChangePasswordSheet({ open, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) { setCurrent(''); setNext(''); setConfirm(''); setErr(''); setDone(false); }
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (busy) return;
    setErr('');
    if (!current) { setErr('Enter your current password.'); return; }
    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/[0-9]/.test(next)) {
      setErr('New password needs 8+ chars with a letter and a number.'); return;
    }
    if (next !== confirm) { setErr('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      setDone(true);
    } catch (e) {
      setErr(e.message || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.3px' }}>Change password</div>

      {done ? (
        <div style={{ textAlign: 'center', padding: '24px 10px 8px' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: COLOR.ink, marginTop: 10 }}>Password updated</div>
          <div onClick={onClose} style={{ marginTop: 18, padding: 14, borderRadius: 16, background: '#2a2733', color: '#fff', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Done</div>
        </div>
      ) : (
        <>
          {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

          <div style={labelStyle}>CURRENT PASSWORD</div>
          <input value={current} onChange={(e) => setCurrent(e.target.value)} type="password" style={inputStyle} placeholder="••••••••" />

          <div style={labelStyle}>NEW PASSWORD</div>
          <input value={next} onChange={(e) => setNext(e.target.value)} type="password" style={inputStyle} placeholder="At least 8 characters" />

          <div style={labelStyle}>CONFIRM NEW PASSWORD</div>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" style={inputStyle} placeholder="Re-enter new password" />

          <div onClick={busy ? undefined : submit} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Updating…' : 'Update password'}</div>
          <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
        </>
      )}
    </Sheet>
  );
}
