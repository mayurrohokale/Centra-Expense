'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr, inrBalance, dayMonth } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';
import { SkeletonRows } from '../../common/ui/Skeleton.jsx';

const QUICK = [500, 1000, 2500, 5000];

/**
 * Add money toward a goal. Per the funding model, this does NOT move money or
 * the goal total directly — it creates a DRAFT (needs_review) debit transaction
 * on the chosen account ("Goal: <name>", category services, linked via goalId).
 * The goal's saved total only increases once that draft is CONFIRMED; until then
 * it shows here as a pending contribution. Deleting the draft (in Transactions /
 * Needs review) cleanly removes the pending contribution.
 */
export default function ContributeSheet({ open, onClose, goal, onSaved }) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  // Load the account picker + the goal's contribution activity each open.
  useEffect(() => {
    if (!open || !goal) return;
    setAmount(''); setErr(''); setDone(false);
    api.getAccounts()
      .then((r) => {
        const list = r.data || [];
        setAccounts(list);
        const firstBank = list.find((a) => a.type === 'bank') || list[0];
        setAccountId((cur) => cur || firstBank?._id || '');
      })
      .catch(() => setAccounts([]));
    setLoadingActivity(true);
    api.getGoalContributions(goal._id)
      .then((r) => setActivity(r.data || []))
      .catch(() => setActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [open, goal]);

  if (!open || !goal) return null;

  const amt = parseFloat(amount) || 0;
  const acct = accounts.find((a) => a._id === accountId);
  // Balance guard (Item 1): a goal contribution is an outflow from the funding
  // account. Block when it exceeds the available (clamped) balance.
  const availBalance = acct ? Math.max(0, Number(acct.balance || 0)) : null;
  const overBalance = availBalance != null && amt > availBalance;
  // Preview reflects that confirmed contributions count now; this one is pending.
  const newSaved = goal.saved + amt;
  const newPct = Math.min(100, Math.round((newSaved / goal.target) * 100));
  const pendingTotal = activity.filter((a) => a.status === 'needs_review').reduce((s, a) => s + a.amount, 0);

  async function submit() {
    if (busy) return;
    setErr('');
    if (amt <= 0) { setErr('Enter an amount to add.'); return; }
    if (!accountId) { setErr('Pick an account to fund from.'); return; }
    if (overBalance) { setErr(`Amount exceeds ${acct?.name || 'account'} balance (${inrBalance(availBalance)} available).`); return; }
    const isCash = acct?.type === 'cash';
    setBusy(true);
    try {
      const occurredAt = new Date().toISOString();
      // DRAFT debit linked to this goal. The goal's saved total + progress bar
      // update IMMEDIATELY (applied server-side at creation via goalId), while
      // the BANK balance only moves once this draft is confirmed (needs_review).
      await api.createTransaction({
        accountId,
        goalId: goal._id,
        source: isCash ? 'cash' : 'manual',
        status: 'needs_review',
        direction: 'debit',
        amount: amt,
        merchant: `Goal: ${goal.name}`,
        categoryKey: 'services',
        icon: goal.emoji || '🎯',
        iconBg: '#F2ECFC',
        occurredAt,
      });
      setDone(true);
      // Refresh the parent goal list + this sheet's activity (shows the new pending row).
      await onSaved?.();
      const r = await api.getGoalContributions(goal._id).catch(() => ({ data: [] }));
      setActivity(r.data || []);
      setAmount('');
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, background: goal.bg, border: `1.5px solid ${goal.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{goal.emoji}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Add to {goal.name}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>{inr(goal.saved)} of {inr(goal.target)} saved{pendingTotal > 0 ? ` · ${inr(pendingTotal)} pending` : ''}</div>
        </div>
      </div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}
      {done && !err && (
        <div style={{ marginTop: 14, borderRadius: 14, padding: '11px 14px', background: '#F2ECFC', border: '1.5px solid #e4d8fb', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#6C5CE7' }}>
          ✓ Added to your goal. Confirm it in Needs review to deduct ₹ from {acct?.name || 'your account'} (the bank balance updates on confirm).
        </div>
      )}

      {/* Amount */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '18px 2px 7px', letterSpacing: '.4px' }}>AMOUNT TO ADD</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        {QUICK.map((q) => (
          <div key={q} onClick={() => setAmount(String((parseFloat(amount) || 0) + q))} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 13, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#7a5fc0', cursor: 'pointer' }}>+{inr(q)}</div>
        ))}
      </div>

      {/* Account picker — same chip style as the add-transaction sheet */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 2px 8px' }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, letterSpacing: '.4px' }}>FUND FROM</span>
        {availBalance != null && (
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: overBalance ? '#d6483b' : COLOR.mutedSoft }}>
            {inrBalance(availBalance)} available
          </span>
        )}
      </div>
      {accounts.length === 0 ? (
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, padding: '2px 2px' }}>Add an account in your profile first.</div>
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

      {/* Live preview (treats this contribution as added) */}
      {amt > 0 && (
        <div style={{ marginTop: 16, borderRadius: 16, padding: '13px 15px', background: goal.bg, border: `1.5px solid ${goal.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: COLOR.ink }}>
            <span>New total {inr(newSaved)}</span>
            <span style={{ color: goal.accent }}>{newPct}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 20, background: 'rgba(255,255,255,.75)', marginTop: 9, overflow: 'hidden' }}>
            <div style={{ width: `${newPct}%`, height: '100%', borderRadius: 20, background: goal.accent, transition: 'width .2s' }} />
          </div>
          <div style={{ marginTop: 9, fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.muted }}>Creates a pending {inr(amt)} debit on {acct?.name || 'the chosen account'} — confirm to finalize.</div>
        </div>
      )}

      <div onClick={(busy || overBalance) ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: overBalance ? '#e7e0f0' : 'linear-gradient(135deg,#2BC4B0,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: overBalance ? '#9b94a8' : '#fff', cursor: overBalance ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Adding…' : overBalance ? 'Insufficient balance' : 'Add money'}</div>

      {/* Activity log */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: COLOR.mutedSoft, letterSpacing: '.5px', margin: '22px 2px 11px' }}>ACTIVITY</div>
      {loadingActivity ? (
        <SkeletonRows count={2} />
      ) : activity.length === 0 ? (
        <div style={{ borderRadius: 16, padding: '16px', background: '#FBF8F4', border: '1.5px dashed #efe9f6', textAlign: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft }}>
          No contributions yet. Add money to start saving.
        </div>
      ) : (
        <div style={{ borderRadius: 18, background: '#fff', border: '1.5px solid #f1ecf6', overflow: 'hidden' }}>
          {activity.map((a, i) => {
            const pending = a.status === 'needs_review';
            return (
              <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderTop: i ? '1px solid #f6f2fa' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: pending ? '#FFF4DB' : '#EAF7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{pending ? '⏳' : '✓'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{inr(a.amount)}</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{a.accountName} · {dayMonth(a.occurredAt)}</div>
                </div>
                <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 9.5, letterSpacing: '.4px', padding: '3px 9px', borderRadius: 11, background: pending ? '#FFF4DB' : '#EAF7EF', color: pending ? '#9b7d12' : '#1FAE63' }}>{pending ? 'PENDING' : 'CONFIRMED'}</span>
              </div>
            );
          })}
        </div>
      )}

      <div onClick={onClose} style={{ marginTop: 14, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Close</div>
    </Sheet>
  );
}
