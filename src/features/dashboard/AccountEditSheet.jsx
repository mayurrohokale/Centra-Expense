'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import Sheet from '../../common/ui/Sheet.jsx';

// Edit an account (name + balance). Used for both bank cards and the Cash wallet.
export default function AccountEditSheet({ open, onClose, account, onDone }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (account) {
      setName(account.name || '');
      setBalance(String(account.balance ?? ''));
      setErr('');
    }
  }, [account]);

  if (!account) return null;
  const isCash = account.type === 'cash';

  async function submit() {
    if (busy) return;
    setErr('');
    const bal = parseFloat(balance);
    if (Number.isNaN(bal) || bal < 0) { setErr('Enter a valid balance.'); return; }
    if (!name.trim()) { setErr('Name cannot be empty.'); return; }
    setBusy(true);
    try {
      await api.updateAccount(account._id, { name: name.trim(), balance: bal });
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, background: isCash ? 'linear-gradient(135deg,#34D39E,#1FAE63)' : account.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: '#fff' }}>
          {isCash ? '👛' : account.logo}
        </div>
        <div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Edit {isCash ? 'Cash' : 'account'}</div>
          {!isCash && <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>•••• {account.last4}</div>}
        </div>
      </div>

      {err && <div style={{ marginTop: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '18px 2px 7px', letterSpacing: '.4px' }}>NAME</div>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }} />

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '14px 2px 7px', letterSpacing: '.4px' }}>{isCash ? 'CASH IN HAND' : 'BALANCE'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
      </div>

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save changes'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
