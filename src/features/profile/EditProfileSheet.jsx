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

// Edit identity fields: name, email, phone, currency.
export default function EditProfileSheet({ open, onClose, user, onSaved }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setCurrency(user.currency || 'INR');
      setErr('');
    }
  }, [open, user]);

  if (!open) return null;

  async function submit() {
    if (busy) return;
    setErr('');
    if (!name.trim()) { setErr('Name cannot be empty.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Enter a valid email.'); return; }
    setBusy(true);
    try {
      await api.updateProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        currency: currency.trim() || 'INR',
      });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.3px' }}>Edit profile</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, marginTop: 3 }}>Update your name and contact details.</div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      <div style={labelStyle}>FULL NAME</div>
      <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />

      <div style={labelStyle}>EMAIL</div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inputStyle} placeholder="you@email.com" />

      <div style={labelStyle}>PHONE</div>
      <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s-]/g, ''))} inputMode="tel" style={inputStyle} placeholder="+91 98765 43210" />

      <div style={labelStyle}>CURRENCY</div>
      <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 5))} style={inputStyle} placeholder="INR" />

      <div onClick={busy ? undefined : submit} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save changes'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
