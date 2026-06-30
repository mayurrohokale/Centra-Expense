'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inrBalance } from '../../common/lib/format.js';
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

// Add Expense / Add Income / Transfer entry sheet. Writes a real transaction
// (source 'manual', or 'cash' when a cash account is chosen) scoped to the user.
// Transfer mode moves money between two of the user's own accounts.
export default function TxnSheet({ open, onClose, initialMode = 'expense', accounts = [], onDone }) {
  const [mode, setMode] = useState(initialMode); // 'expense' | 'income' | 'transfer'
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [accountId, setAccountId] = useState('');     // from (transfer) / account
  const [toAccountId, setToAccountId] = useState(''); // transfer destination
  const [categoryKey, setCategoryKey] = useState('');
  const [recurring, setRecurring] = useState(false);
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

  // Default the transfer destination to a DIFFERENT account than the source.
  useEffect(() => {
    if (mode !== 'transfer') return;
    if (!toAccountId || toAccountId === accountId) {
      const other = accounts.find((a) => a._id !== accountId);
      setToAccountId(other?._id || '');
    }
  }, [mode, accountId, toAccountId, accounts]);

  const isExpense = mode === 'expense';
  const isTransfer = mode === 'transfer';
  // Balance guard (Item 1): expense + transfer are outflows from the source
  // account (accountId). Income is never blocked. Clamp the shown balance at 0.
  const amtNum = parseFloat(amount) || 0;
  const sourceAcct = (isExpense || isTransfer) ? accounts.find((a) => a._id === accountId) : null;
  const availBalance = sourceAcct ? Math.max(0, Number(sourceAcct.balance || 0)) : null;
  const overBalance = availBalance != null && amtNum > availBalance;
  // Category picker hides 'transfer' (set automatically) and income-only keys.
  const visibleCats = useMemo(
    () => cats.filter((c) => (isExpense
      ? c.kind === 'expense' && c.key !== 'transfer'
      : c.kind === 'income' || c.key === 'income')),
    [cats, isExpense]
  );

  // Keep a valid category selected for the current mode.
  useEffect(() => {
    if (isTransfer || !visibleCats.length) return;
    if (!visibleCats.some((c) => c.key === categoryKey)) {
      setCategoryKey(isExpense ? (visibleCats[0]?.key || 'other') : 'income');
    }
  }, [visibleCats, categoryKey, isExpense, isTransfer]);

  function reset() {
    setAmount(''); setMerchant(''); setDate(todayInput()); setErr(''); setRecurring(false);
  }
  function close() { reset(); onClose(); }

  async function submit() {
    if (busy) return;
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Enter an amount.'); return; }
    // Balance guard for outflows (expense + transfer source). Server re-validates.
    if (overBalance) {
      setErr(`Amount exceeds ${sourceAcct?.name || 'account'} balance (${inrBalance(availBalance)} available).`);
      return;
    }

    setBusy(true);
    try {
      const occurredAt = new Date(date + 'T08:00:00').toISOString();

      if (isTransfer) {
        if (!accountId || !toAccountId) { setErr('Pick both accounts.'); setBusy(false); return; }
        if (accountId === toAccountId) { setErr('Pick two different accounts.'); setBusy(false); return; }
        const from = accounts.find((a) => a._id === accountId);
        const to = accounts.find((a) => a._id === toAccountId);
        // A transfer is one row (direction 'transfer'); created as DRAFT so the
        // balances move only on confirm, consistent with every other entry.
        await api.createTransaction({
          accountId,
          toAccountId,
          source: from?.type === 'cash' ? 'cash' : 'manual',
          status: 'needs_review',
          direction: 'transfer',
          amount: amt,
          merchant: `${from?.name || 'Account'} → ${to?.name || 'Account'}`,
          categoryKey: 'transfer',
          icon: '🔁',
          iconBg: '#EEF1F5',
          occurredAt,
          dateLabel: dateLabelFor(occurredAt),
        });
        reset();
        onDone();
        setBusy(false);
        return;
      }

      if (!merchant.trim()) { setErr(isExpense ? 'What did you spend on?' : 'Where did this income come from?'); setBusy(false); return; }
      const acct = accounts.find((a) => a._id === accountId);
      const isCash = acct?.type === 'cash';
      const cat = visibleCats.find((c) => c.key === categoryKey);
      await api.createTransaction({
        accountId: accountId || undefined,
        source: isCash ? 'cash' : 'manual',
        // Created as DRAFT (needs_review) so it does NOT move the balance until
        // the user confirms it — same as email-detected entries.
        status: 'needs_review',
        direction: isExpense ? 'debit' : 'credit',
        amount: amt,
        merchant: merchant.trim(),
        categoryKey: categoryKey || (isExpense ? 'other' : 'income'),
        icon: cat?.emoji || (isExpense ? '💸' : '💰'),
        iconBg: isExpense ? '#FFEDE9' : '#EAF7EF',
        occurredAt,
        dateLabel: dateLabelFor(occurredAt),
        // Monthly recurring marker (expenses only).
        ...(isExpense && recurring ? { recurring: true, frequency: 'monthly' } : {}),
      });
      reset();
      onDone();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const accentGrad = isTransfer
    ? 'linear-gradient(135deg,#7C8DB5,#5A6B92)'
    : isExpense ? 'linear-gradient(135deg,#FF8A7A,#FF6B5E)' : 'linear-gradient(135deg,#34D39E,#1FAE63)';
  const tabStyle = (active) => ({
    flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, cursor: 'pointer',
    fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13,
    ...(active ? { background: '#fff', color: COLOR.ink, boxShadow: '0 4px 10px rgba(90,70,130,.12)' } : { background: 'transparent', color: COLOR.mutedSoft }),
  });
  const acctChip = (a, active, onClick) => (
    <div key={a._id} onClick={onClick} style={{ flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
      {a.type === 'cash' ? '👛' : a.logo} {a.name}
    </div>
  );

  const title = isTransfer ? 'Transfer 🔁' : isExpense ? 'Add expense 💸' : 'Add income 💰';

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>{title}</div>

      {/* mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, background: '#f2eef7', borderRadius: 14, padding: 4 }}>
        <div onClick={() => setMode('expense')} style={tabStyle(isExpense)}>Expense</div>
        <div onClick={() => setMode('income')} style={tabStyle(mode === 'income')}>Income</div>
        <div onClick={() => setMode('transfer')} style={tabStyle(isTransfer)}>Transfer</div>
      </div>

      {err && <div style={{ marginTop: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {/* amount */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '14px 16px', borderRadius: 16, background: '#FBF8F4', border: `1.5px solid ${overBalance ? '#ffb4ab' : '#f1ecf6'}` }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: overBalance ? '#d6483b' : COLOR.ink, minWidth: 0, letterSpacing: '-.5px' }} />
      </div>
      {/* Available-balance hint for outflows (expense + transfer source). */}
      {availBalance != null && (
        <div style={{ marginTop: 6, fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: overBalance ? '#d6483b' : COLOR.mutedSoft, padding: '0 2px' }}>
          {overBalance
            ? `Exceeds ${sourceAcct?.name || 'account'} balance — ${inrBalance(availBalance)} available`
            : `${inrBalance(availBalance)} available in ${sourceAcct?.name || 'account'}`}
        </div>
      )}

      {isTransfer ? (
        <>
          {/* From */}
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 8px', letterSpacing: '.4px' }}>FROM</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {accounts.map((a) => acctChip(a, a._id === accountId, () => setAccountId(a._id)))}
          </div>
          {/* To (exclude the from account) */}
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 8px', letterSpacing: '.4px' }}>TO</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {accounts.filter((a) => a._id !== accountId).map((a) => acctChip(a, a._id === toAccountId, () => setToAccountId(a._id)))}
          </div>
        </>
      ) : (
        <>
          {/* merchant */}
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={isExpense ? 'Merchant (e.g. Swiggy, Health Insurance)' : 'Source (e.g. Freelance)'}
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

          {/* account */}
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 8px', letterSpacing: '.4px' }}>ACCOUNT</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {accounts.map((a) => acctChip(a, a._id === accountId, () => setAccountId(a._id)))}
          </div>

          {/* monthly recurring (expenses only) */}
          {isExpense && (
            <div onClick={() => setRecurring((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 14, padding: '12px 14px', borderRadius: 14, background: recurring ? '#F2ECFC' : '#FBF8F4', border: `1.5px solid ${recurring ? '#e4d8fb' : '#f1ecf6'}`, cursor: 'pointer' }}>
              <span style={{ fontSize: 18 }}>🔁</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>Monthly recurring</div>
                <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedSoft }}>For SIPs, insurance, rent & subscriptions</div>
              </div>
              <div style={{ width: 44, height: 26, borderRadius: 15, background: recurring ? '#7C5CE0' : '#e4dff0', position: 'relative', transition: 'background .18s' }}>
                <div style={{ position: 'absolute', top: 3, left: recurring ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,.18)', transition: 'left .18s' }} />
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.muted }}>📅 Date</span>
        <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.ink, outline: 'none' }} />
      </div>

      <div onClick={(busy || overBalance) ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: overBalance ? '#e7e0f0' : accentGrad, textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: overBalance ? '#9b94a8' : '#fff', cursor: overBalance ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Saving…' : overBalance ? 'Insufficient balance' : isTransfer ? 'Add transfer' : isExpense ? 'Add expense' : 'Add income'}
      </div>
      <div onClick={close} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
