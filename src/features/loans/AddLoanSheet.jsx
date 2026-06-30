'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inrBalance } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Add a loan. Direction toggle (Borrowed = I got money, I owe them | Lent = I
 * gave money, they owe me), counterparty, amount, funding account, optional
 * note/date. For LENT (an outflow) the account balance is shown + the submit is
 * balance-guarded (the server re-validates).
 */
export default function AddLoanSheet({ open, onClose, onSaved }) {
  const [direction, setDirection] = useState('borrowed');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayInput());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setDirection('borrowed'); setName(''); setAmount(''); setNote(''); setDate(todayInput()); setErr('');
    api.getAccounts()
      .then((r) => {
        const list = r.data || [];
        setAccounts(list);
        const firstBank = list.find((a) => a.type === 'bank') || list[0];
        setAccountId((cur) => cur || firstBank?._id || '');
      })
      .catch(() => setAccounts([]));
  }, [open]);

  if (!open) return null;

  const amt = parseFloat(amount) || 0;
  const acct = accounts.find((a) => a._id === accountId);
  const isLent = direction === 'lent';
  // Balance guard only for LENT (money leaves the account now).
  const availBalance = acct ? Math.max(0, Number(acct.balance || 0)) : null;
  const overBalance = isLent && availBalance != null && amt > availBalance;

  async function submit() {
    if (busy) return;
    setErr('');
    if (!name.trim()) { setErr('Who is the loan with?'); return; }
    if (amt <= 0) { setErr('Enter a valid amount.'); return; }
    if (!accountId) { setErr('Pick an account.'); return; }
    if (overBalance) { setErr(`Amount exceeds ${acct?.name || 'account'} balance (${inrBalance(availBalance)} available).`); return; }
    setBusy(true);
    try {
      await api.createLoan({
        direction,
        counterpartyName: name.trim(),
        principal: amt,
        accountId,
        note: note.trim() || undefined,
        startDate: new Date(date + 'T08:00:00').toISOString(),
      });
      await onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const tab = (key, label, sub) => {
    const active = direction === key;
    return (
      <div onClick={() => setDirection(key)} style={{ flex: 1, textAlign: 'center', padding: '11px 6px', borderRadius: 13, cursor: 'pointer', border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: active ? '#fff' : '#5a5366' }}>{label}</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 9.5, color: active ? 'rgba(255,255,255,.75)' : COLOR.mutedSoft, marginTop: 1 }}>{sub}</div>
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Add loan 🤝</div>

      {err && <div style={{ marginTop: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {/* direction toggle */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {tab('borrowed', 'Borrowed', 'I owe them')}
        {tab('lent', 'Lent', 'They owe me')}
      </div>

      {/* counterparty */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 7px', letterSpacing: '.4px' }}>{isLent ? 'WHO DID YOU LEND TO?' : 'WHO DID YOU BORROW FROM?'}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rohan, Mom, Office" style={{ width: '100%', padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }} />

      {/* amount */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '14px 2px 7px', letterSpacing: '.4px' }}>AMOUNT</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: `1.5px solid ${overBalance ? '#ffb4ab' : '#f1ecf6'}` }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: overBalance ? '#d6483b' : COLOR.ink, minWidth: 0 }} />
      </div>

      {/* account */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 2px 8px' }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, letterSpacing: '.4px' }}>{isLent ? 'PAY FROM' : 'RECEIVE INTO'}</span>
        {isLent && availBalance != null && (
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: overBalance ? '#d6483b' : COLOR.mutedSoft }}>{inrBalance(availBalance)} available</span>
        )}
      </div>
      {accounts.length === 0 ? (
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft }}>Add an account in your profile first.</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {accounts.map((a) => {
            const active = a._id === accountId;
            return (
              <div key={a._id} onClick={() => setAccountId(a._id)} style={{ flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
                {a.type === 'cash' ? '👛' : a.logo} {a.name}
              </div>
            );
          })}
        </div>
      )}

      {/* note + date */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 7px', letterSpacing: '.4px' }}>NOTE (OPTIONAL)</div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. for the Goa trip" style={{ width: '100%', padding: '12px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.muted }}>📅 Date</span>
        <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.ink, outline: 'none' }} />
      </div>

      <div onClick={(busy || overBalance) ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: overBalance ? '#e7e0f0' : (isLent ? 'linear-gradient(135deg,#34D39E,#1FAE63)' : 'linear-gradient(135deg,#FF8A7A,#FF6B5E)'), textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: overBalance ? '#9b94a8' : '#fff', cursor: overBalance ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Saving…' : overBalance ? 'Insufficient balance' : (isLent ? 'Record loan given' : 'Record loan taken')}
      </div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
