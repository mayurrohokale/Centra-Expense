'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr, nextPayDate, dayMonth, ordinal } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';

/**
 * Set up salary: which ACCOUNT it lands in, the expected monthly amount, and the
 * expected credit day (1–31; 31 ≈ month-end). Stored on user.salary
 * ({ accountId, amount, payDay }). Powers auto-detect, the manual "credited"
 * tick, and the upcoming-salary card.
 */
export default function SalarySheet({ open, onClose, user, onSaved }) {
  const [amount, setAmount] = useState('');
  const [payDay, setPayDay] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(user?.salary?.amount ? String(user.salary.amount) : '');
    setPayDay(user?.salary?.payDay ? String(user.salary.payDay) : '1');
    setAccountId(user?.salary?.accountId ? String(user.salary.accountId) : '');
    setErr('');
    // Salary lands in a bank account (not cash/investment).
    api.getAccounts()
      .then((r) => {
        const banks = (r.data || []).filter((a) => a.type === 'bank');
        setAccounts(banks);
        // Default to the first bank if none chosen yet.
        setAccountId((cur) => cur || (banks[0]?._id || ''));
      })
      .catch(() => setAccounts([]));
  }, [open, user]);

  if (!open) return null;

  const amtNum = parseFloat(amount);
  const dayNum = parseInt(payDay, 10);
  const validPreview = !Number.isNaN(amtNum) && amtNum > 0 && dayNum >= 1 && dayNum <= 31 && !!accountId;
  const preview = validPreview ? nextPayDate(dayNum) : null;
  const chosen = accounts.find((a) => a._id === accountId);

  async function submit() {
    if (busy) return;
    setErr('');
    if (Number.isNaN(amtNum) || amtNum <= 0) { setErr('Enter a valid salary amount.'); return; }
    if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) { setErr('Pay day must be between 1 and 31.'); return; }
    if (!accountId) { setErr('Pick the account your salary lands in.'); return; }
    setBusy(true);
    try {
      await api.updateProfile({ salary: { amount: amtNum, payDay: dayNum, accountId } });
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, background: '#2BC4B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💼</div>
        <div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.3px' }}>Set up salary</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>Tracks your monthly salary credit</div>
        </div>
      </div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {/* Salary account */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '18px 2px 8px', letterSpacing: '.4px' }}>SALARY ACCOUNT</div>
      {accounts.length === 0 ? (
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, padding: '2px 2px' }}>Add a bank account first, then choose it here.</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {accounts.map((a) => {
            const active = a._id === accountId;
            return (
              <div key={a._id} onClick={() => setAccountId(a._id)} style={{ flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
                {a.logo} {a.name}{a.last4 ? ` ••${a.last4}` : ''}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 7px', letterSpacing: '.4px' }}>EXPECTED MONTHLY SALARY</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="85000" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
      </div>

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '14px 2px 7px', letterSpacing: '.4px' }}>EXPECTED CREDIT DAY (1–31)</div>
      <input value={payDay} onChange={(e) => setPayDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" placeholder="1" style={{ width: '100%', padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }} />
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint, margin: '6px 2px 0' }}>Tip: use 31 for "last day of month".</div>

      {validPreview && (
        <div style={{ marginTop: 14, borderRadius: 16, padding: '13px 15px', background: 'linear-gradient(120deg,#E9FBF3,#D6F5E8)', border: '1.5px solid #c5efdc' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#13795f' }}>
            {inr(amtNum)} into {chosen?.name || 'your account'} on the {ordinal(dayNum)}
          </div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#13795f', marginTop: 3, letterSpacing: '-.3px' }}>
            Next: {dayMonth(preview)}
          </div>
        </div>
      )}

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#2BC4B0,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save salary'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
