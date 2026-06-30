'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr, inrBalance, dayMonth } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';
import { SkeletonRows } from '../../common/ui/Skeleton.jsx';

/**
 * Record a repayment on a loan + show its repayment history.
 *  - borrowed (I pay them back): DEBIT the chosen account (balance-guarded).
 *  - lent (they pay me back):    CREDIT the chosen account.
 * Amount is clamped to the outstanding; the server rejects > outstanding.
 */
export default function RepaySheet({ open, onClose, loan, onSaved }) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !loan) return;
    setAmount(''); setErr('');
    api.getAccounts()
      .then((r) => {
        const list = r.data || [];
        setAccounts(list);
        const pref = list.find((a) => a._id === loan.accountId) || list.find((a) => a.type === 'bank') || list[0];
        setAccountId((cur) => cur || pref?._id || '');
      })
      .catch(() => setAccounts([]));
    setLoadingHist(true);
    api.getLoanRepayments(loan._id)
      .then((r) => setHistory(r.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHist(false));
  }, [open, loan]);

  if (!open || !loan) return null;

  const borrowed = loan.direction === 'borrowed';
  const amt = parseFloat(amount) || 0;
  const acct = accounts.find((a) => a._id === accountId);
  // I pay them back (borrowed) → outflow → balance-guarded. They pay me → inflow.
  const guarded = borrowed;
  const availBalance = acct ? Math.max(0, Number(acct.balance || 0)) : null;
  const overBalance = guarded && availBalance != null && amt > availBalance;
  const overOutstanding = amt > loan.outstanding;

  async function submit() {
    if (busy) return;
    setErr('');
    if (amt <= 0) { setErr('Enter a repayment amount.'); return; }
    if (overOutstanding) { setErr(`Only ${inr(loan.outstanding)} is still outstanding.`); return; }
    if (!accountId) { setErr('Pick an account.'); return; }
    if (overBalance) { setErr(`Amount exceeds ${acct?.name || 'account'} balance (${inrBalance(availBalance)} available).`); return; }
    setBusy(true);
    try {
      await api.repayLoan(loan._id, { amount: amt, accountId, date: new Date().toISOString() });
      await onSaved?.();
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
        <div style={{ width: 46, height: 46, borderRadius: 15, background: borrowed ? '#FFEDE9' : '#EAF7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{borrowed ? '🫳' : '🫴'}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>{borrowed ? `Repay ${loan.counterpartyName}` : `Received from ${loan.counterpartyName}`}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>{inr(loan.outstanding)} of {inr(loan.principal)} remaining</div>
        </div>
      </div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {/* amount */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 2px 7px' }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, letterSpacing: '.4px' }}>AMOUNT</span>
        <span onClick={() => setAmount(String(loan.outstanding))} style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: COLOR.purple, cursor: 'pointer' }}>Settle full · {inr(loan.outstanding)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: `1.5px solid ${(overBalance || overOutstanding) ? '#ffb4ab' : '#f1ecf6'}` }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: (overBalance || overOutstanding) ? '#d6483b' : COLOR.ink, minWidth: 0 }} />
      </div>

      {/* account */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 2px 8px' }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, letterSpacing: '.4px' }}>{borrowed ? 'PAY FROM' : 'RECEIVE INTO'}</span>
        {guarded && availBalance != null && (
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: overBalance ? '#d6483b' : COLOR.mutedSoft }}>{inrBalance(availBalance)} available</span>
        )}
      </div>
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

      <div onClick={(busy || overBalance || overOutstanding) ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: (overBalance || overOutstanding) ? '#e7e0f0' : 'linear-gradient(135deg,#34D39E,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: (overBalance || overOutstanding) ? '#9b94a8' : '#fff', cursor: (overBalance || overOutstanding) ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Saving…' : overBalance ? 'Insufficient balance' : overOutstanding ? 'Exceeds outstanding' : 'Record repayment'}
      </div>

      {/* repayment history */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: COLOR.mutedSoft, letterSpacing: '.5px', margin: '22px 2px 11px' }}>REPAYMENTS</div>
      {loadingHist ? (
        <SkeletonRows count={2} />
      ) : history.length === 0 ? (
        <div style={{ borderRadius: 16, padding: '16px', background: '#FBF8F4', border: '1.5px dashed #efe9f6', textAlign: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft }}>No repayments yet.</div>
      ) : (
        <div style={{ borderRadius: 18, background: '#fff', border: '1.5px solid #f1ecf6', overflow: 'hidden' }}>
          {history.map((h, i) => (
            <div key={h._id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderTop: i ? '1px solid #f6f2fa' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EAF7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{inr(h.amount)}</div>
                <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{h.accountName} · {dayMonth(h.occurredAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div onClick={onClose} style={{ marginTop: 14, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Close</div>
    </Sheet>
  );
}
