'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr, nextPayDate, dayMonth, ordinal } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';

// Set up monthly salary: amount + pay day (1–31), with a "paid on the Nth" preview.
export default function SalarySheet({ open, onClose, user, onSaved }) {
  const [amount, setAmount] = useState('');
  const [payDay, setPayDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(user?.salary?.amount ? String(user.salary.amount) : '');
      setPayDay(user?.salary?.payDay ? String(user.salary.payDay) : '');
      setErr('');
    }
  }, [open, user]);

  if (!open) return null;

  const amtNum = parseFloat(amount);
  const dayNum = parseInt(payDay, 10);
  const validPreview = !Number.isNaN(amtNum) && amtNum > 0 && dayNum >= 1 && dayNum <= 31;
  const preview = validPreview ? nextPayDate(dayNum) : null;

  async function submit() {
    if (busy) return;
    setErr('');
    if (Number.isNaN(amtNum) || amtNum <= 0) { setErr('Enter a valid salary amount.'); return; }
    if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) { setErr('Pay day must be between 1 and 31.'); return; }
    setBusy(true);
    try {
      await api.updateProfile({ salary: { amount: amtNum, payDay: dayNum } });
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
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>Powers your upcoming-salary card</div>
        </div>
      </div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '18px 2px 7px', letterSpacing: '.4px' }}>MONTHLY SALARY</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="85000" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
      </div>

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '14px 2px 7px', letterSpacing: '.4px' }}>PAY DAY (DAY OF MONTH)</div>
      <input value={payDay} onChange={(e) => setPayDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" placeholder="1" style={{ width: '100%', padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }} />

      {validPreview && (
        <div style={{ marginTop: 14, borderRadius: 16, padding: '13px 15px', background: 'linear-gradient(120deg,#E9FBF3,#D6F5E8)', border: '1.5px solid #c5efdc' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#13795f' }}>
            You'll be paid on the {ordinal(dayNum)} each month
          </div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#13795f', marginTop: 3, letterSpacing: '-.3px' }}>
            Next: {inr(amtNum)} on {dayMonth(preview)}
          </div>
        </div>
      )}

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#2BC4B0,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save salary'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
