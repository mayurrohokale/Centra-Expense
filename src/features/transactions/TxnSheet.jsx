'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import Sheet from '../../common/ui/Sheet.jsx';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dateLabelFor(iso) {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const lbl = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
  return same ? `TODAY · ${lbl}` : lbl;
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Add Expense / Add Income entry sheet. Writes a real transaction (source
// 'manual', or 'cash' when a cash account is chosen) scoped to the user.
export default function TxnSheet({ open, onClose, initialMode = 'expense', accounts = [], onDone }) {
  const [mode, setMode] = useState(initialMode);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [date, setDate] = useState(todayInput());
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (open) setMode(initialMode); }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    api.getCategories().then((r) => setCats(r.data || [])).catch(() => setCats([]));
  }, [open]);

  // Default the account to the first bank (or cash) when accounts arrive.
  useEffect(() => {
    if (!accountId && accounts.length) {
      const firstBank = accounts.find((a) => a.type === 'bank') || accounts[0];
      setAccountId(firstBank?._id || '');
    }
  }, [accounts, accountId]);

  const isExpense = mode === 'expense';
  const visibleCats = useMemo(
    () => cats.filter((c) => (isExpense ? c.kind === 'expense' : c.kind === 'income' || c.key === 'income')),
    [cats, isExpense]
  );

  // Keep a valid category selected for the current mode.
  useEffect(() => {
    if (!visibleCats.length) return;
    if (!visibleCats.some((c) => c.key === categoryKey)) {
      setCategoryKey(isExpense ? (visibleCats[0]?.key || 'other') : 'income');
    }
  }, [visibleCats, categoryKey, isExpense]);

  function reset() {
    setAmount(''); setMerchant(''); setDate(todayInput()); setErr('');
  }
  function close() { reset(); onClose(); }

  async function submit() {
    if (busy) return;
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Enter an amount.'); return; }
    if (!merchant.trim()) { setErr(isExpense ? 'What did you spend on?' : 'Where did this income come from?'); return; }
    const acct = accounts.find((a) => a._id === accountId);
    const isCash = acct?.type === 'cash';
    setBusy(true);
    try {
      const occurredAt = new Date(date + 'T08:00:00').toISOString();
      const cat = visibleCats.find((c) => c.key === categoryKey);
      await api.createTransaction({
        accountId: accountId || undefined,
        source: isCash ? 'cash' : 'manual',
        direction: isExpense ? 'debit' : 'credit',
        amount: amt,
        merchant: merchant.trim(),
        categoryKey: categoryKey || (isExpense ? 'other' : 'income'),
        icon: cat?.emoji || (isExpense ? '💸' : '💰'),
        iconBg: isExpense ? '#FFEDE9' : '#EAF7EF',
        occurredAt,
        dateLabel: dateLabelFor(occurredAt),
      });
      // Balance movement (bank AND cash) is now applied server-side when the
      // transaction is created confirmed — see balance.service. No client-side
      // account update needed (avoids double-counting).
      reset();
      onDone();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const accentGrad = isExpense ? 'linear-gradient(135deg,#FF8A7A,#FF6B5E)' : 'linear-gradient(135deg,#34D39E,#1FAE63)';
  const tabStyle = (active) => ({
    flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, cursor: 'pointer',
    fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13,
    ...(active ? { background: '#fff', color: COLOR.ink, boxShadow: '0 4px 10px rgba(90,70,130,.12)' } : { background: 'transparent', color: COLOR.mutedSoft }),
  });

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>
        {isExpense ? 'Add expense 💸' : 'Add income 💰'}
      </div>

      {/* mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, background: '#f2eef7', borderRadius: 14, padding: 4 }}>
        <div onClick={() => setMode('expense')} style={tabStyle(isExpense)}>Expense</div>
        <div onClick={() => setMode('income')} style={tabStyle(!isExpense)}>Income</div>
      </div>

      {err && <div style={{ marginTop: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {/* amount */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '14px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink, minWidth: 0, letterSpacing: '-.5px' }} />
      </div>

      {/* merchant */}
      <input
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        placeholder={isExpense ? 'Merchant (e.g. Swiggy)' : 'Source (e.g. Freelance)'}
        style={{ width: '100%', marginTop: 11, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }}
      />

      {/* category chips */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 8px', letterSpacing: '.4px' }}>CATEGORY</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {visibleCats.map((c) => {
          const active = c.key === categoryKey;
          return (
            <div key={c.key} onClick={() => setCategoryKey(c.key)} style={{ cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
              {c.emoji} {c.label}
            </div>
          );
        })}
      </div>

      {/* account + date */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 8px', letterSpacing: '.4px' }}>ACCOUNT</div>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.muted }}>📅 Date</span>
        <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.ink, outline: 'none' }} />
      </div>

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: accentGrad, textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Saving…' : isExpense ? 'Add expense' : 'Add income'}
      </div>
      <div onClick={close} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
