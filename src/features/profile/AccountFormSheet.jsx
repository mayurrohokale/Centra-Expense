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

/**
 * Add or edit a bank/cash account. `account` null → add mode (type selectable);
 * a value → edit mode (type fixed, editing name/institution/last4/balance).
 */
export default function AccountFormSheet({ open, onClose, account, onSaved }) {
  const editing = !!account;
  const [type, setType] = useState('bank');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [balance, setBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    if (account) {
      setType(account.type || 'bank');
      setName(account.name || '');
      setInstitution(account.institution || '');
      setLast4(account.last4 || '');
      setBalance(String(account.balance ?? ''));
    } else {
      setType('bank');
      setName('');
      setInstitution('');
      setLast4('');
      setBalance('');
    }
    setErr('');
  }, [open, account]);

  if (!open) return null;
  const isCash = type === 'cash';

  async function submit() {
    if (busy) return;
    setErr('');
    if (!name.trim()) { setErr('Name is required.'); return; }
    const bal = balance === '' ? 0 : parseFloat(balance);
    if (Number.isNaN(bal) || bal < 0) { setErr('Enter a valid balance.'); return; }
    if (!isCash && last4 && !/^\d{1,4}$/.test(last4)) { setErr('Last 4 must be up to 4 digits.'); return; }
    setBusy(true);
    try {
      if (editing) {
        const patch = { name: name.trim(), balance: bal };
        if (!isCash) { patch.institution = institution.trim(); patch.last4 = last4.trim(); }
        await api.updateAccount(account._id, patch);
      } else {
        await api.createAccount({
          type,
          name: name.trim(),
          institution: isCash ? undefined : institution.trim(),
          last4: isCash ? undefined : last4.trim(),
          balance: bal,
        });
      }
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const typeBtn = (val, label, emoji) => (
    <div
      onClick={() => setType(val)}
      style={{
        flex: 1, textAlign: 'center', padding: '11px 8px', borderRadius: 14, cursor: 'pointer',
        fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13,
        ...(type === val
          ? { background: '#2a2733', color: '#fff', border: '1.5px solid #2a2733' }
          : { background: '#fff', color: COLOR.muted, border: '1.5px solid #eee6f3' }),
      }}
    >
      {emoji} {label}
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.3px' }}>{editing ? 'Edit account' : 'Add account'}</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, marginTop: 3 }}>{editing ? 'Update this account’s details.' : 'Track a bank or cash account.'}</div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {!editing && (
        <>
          <div style={labelStyle}>TYPE</div>
          <div style={{ display: 'flex', gap: 9 }}>
            {typeBtn('bank', 'Bank', '🏦')}
            {typeBtn('cash', 'Cash', '👛')}
          </div>
        </>
      )}

      <div style={labelStyle}>NAME</div>
      <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder={isCash ? 'Cash wallet' : 'HDFC Bank'} />

      {!isCash && (
        <>
          <div style={labelStyle}>INSTITUTION (OPTIONAL)</div>
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} style={inputStyle} placeholder="HDFC Bank Ltd." />

          <div style={labelStyle}>LAST 4 DIGITS (OPTIONAL)</div>
          <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} inputMode="numeric" style={inputStyle} placeholder="4582" />
        </>
      )}

      <div style={labelStyle}>{editing ? (isCash ? 'CASH IN HAND' : 'BALANCE') : 'OPENING BALANCE'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
      </div>

      <div onClick={busy ? undefined : submit} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add account'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
