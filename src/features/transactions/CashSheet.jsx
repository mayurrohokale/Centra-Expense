'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';

const CHIPS = [100, 500, 1000, 2000];

// Cash wallet sheet: menu → add/spend entry. Writes a cash transaction and
// adjusts the cash account balance.
export default function CashSheet({ open, onClose, cash, onDone }) {
  const [mode, setMode] = useState('menu'); // menu | add | spend
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode('menu'); setAmount(''); };
  const close = () => { reset(); onClose(); };

  if (!cash) return null;
  const isSpend = mode === 'spend';

  async function submit() {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) { setMode('menu'); return; }
    setBusy(true);
    try {
      await api.createTransaction({
        accountId: cash._id,
        source: 'cash',
        direction: isSpend ? 'debit' : 'credit',
        amount: amt,
        merchant: isSpend ? 'Cash spend' : 'Cash added',
        categoryKey: isSpend ? 'other' : 'income',
        icon: isSpend ? '💵' : '🏧',
        iconBg: '#EAF7EF',
        dateLabel: 'TODAY · 29 JUN',
      });
      await api.updateAccount(cash._id, {
        balance: cash.balance + (isSpend ? -amt : amt),
        spentThisMonth: cash.spentThisMonth + (isSpend ? amt : 0),
      });
      reset();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#34D39E,#1FAE63)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👛</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Cash wallet</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>Spent {inr(cash.spentThisMonth)} in cash this month</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, letterSpacing: '.4px' }}>IN HAND</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: '#1FAE63', letterSpacing: '-.5px' }}>{inr(cash.balance)}</div>
        </div>
      </div>

      {mode === 'menu' && (
        <div style={{ display: 'flex', gap: 11, marginTop: 22 }}>
          <div onClick={() => setMode('add')} style={{ flex: 1, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,#34D39E,#1FAE63)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', boxShadow: '0 8px 18px rgba(31,174,99,.3)' }}>
            <span style={{ fontSize: 22 }}>➕</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: '#fff' }}>Add cash</span><span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,.85)' }}>ATM / received</span>
          </div>
          <div onClick={() => setMode('spend')} style={{ flex: 1, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', boxShadow: '0 8px 18px rgba(255,107,94,.3)' }}>
            <span style={{ fontSize: 22 }}>💸</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: '#fff' }}>Log spend</span><span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,.85)' }}>paid in cash</span>
          </div>
        </div>
      )}

      {mode !== 'menu' && (
        <>
          <div style={{ marginTop: 20, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{isSpend ? 'How much did you spend?' : 'How much cash did you add?'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '14px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
            <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink }}>₹</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink, minWidth: 0, letterSpacing: '-.5px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {CHIPS.map((v) => (<div key={v} onClick={() => setAmount(String(v))} style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 13, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#7a5fc0', cursor: 'pointer' }}>₹{v}</div>))}
          </div>
          <div onClick={busy ? undefined : submit} style={{ marginTop: 16, padding: 15, borderRadius: 18, background: isSpend ? 'linear-gradient(135deg,#FF8A7A,#FF6B5E)' : 'linear-gradient(135deg,#34D39E,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : isSpend ? 'Log cash spend' : 'Add to wallet'}</div>
          <div onClick={() => setMode('menu')} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Back</div>
        </>
      )}
    </Sheet>
  );
}
