'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr, dayMonth, ordinal } from '../../common/lib/format.js';
import { Skeleton, SkeletonText } from '../../common/ui/Skeleton.jsx';
import Sheet from '../../common/ui/Sheet.jsx';

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * "This month" salary status card for Home. States:
 *  - loading        → skeleton
 *  - not configured → gentle prompt to set up salary (opens Profile)
 *  - credited       → ✅ received ₹X on <date> (auto/manual badge)
 *  - pending        → expected ₹X on the Nth; once we're at/after the credit
 *                     window, a "Mark credited" action opens an editable-amount
 *                     confirm that posts a CONFIRMED salary credit.
 * `onChanged` lets the parent refetch balances/summary after a credit lands.
 */
export default function SalaryCard({ onChanged }) {
  const { openProfile } = useAuth();
  const { data, loading, refetch } = useApi(api.getSalaryStatus, []);
  const [markOpen, setMarkOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInput());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const s = data || {};

  useEffect(() => {
    if (markOpen) { setAmount(s.expectedAmount ? String(s.expectedAmount) : ''); setDate(todayInput()); setErr(''); }
  }, [markOpen, s.expectedAmount]);

  if (loading && !data) {
    return (
      <div style={{ marginTop: 16, borderRadius: 22, padding: '16px 18px', background: '#fff', border: '1.5px solid #f1ecf6' }}>
        <SkeletonText w="40%" h={12} />
        <div style={{ marginTop: 12 }}><Skeleton w={150} h={22} r={8} /></div>
        <div style={{ marginTop: 12 }}><Skeleton h={40} r={13} /></div>
      </div>
    );
  }

  // Not configured → gentle setup prompt.
  if (!s.configured) {
    return (
      <div onClick={openProfile} style={{ marginTop: 16, borderRadius: 22, padding: '15px 16px', background: 'linear-gradient(120deg,#F0FBF5,#E3F7EC)', border: '1.5px dashed #bfe8d2', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: '#13795f' }}>Track your salary</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: '#3a8a74' }}>Pick your salary account & amount to track each month</div>
        </div>
        <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 13, color: '#1FAE63' }}>Set up ›</span>
      </div>
    );
  }

  async function markCredited() {
    if (busy) return;
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Enter the amount credited.'); return; }
    setBusy(true);
    try {
      await api.markSalaryCredited({ amount: amt, date: new Date(date + 'T08:00:00').toISOString() });
      setMarkOpen(false);
      await refetch();
      onChanged?.();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const credited = s.credited;
  const accentBg = credited ? 'linear-gradient(120deg,#E9FBF3,#D6F5E8)' : '#fff';
  const accentBorder = credited ? '#c5efdc' : '#f1ecf6';

  return (
    <>
      <div style={{ marginTop: 16, borderRadius: 22, padding: '16px 18px', background: accentBg, border: `1.5px solid ${accentBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11, color: credited ? '#13795f' : COLOR.mutedSoft, letterSpacing: '.6px' }}>💼 SALARY · THIS MONTH</span>
          {credited && (
            <span style={{ marginLeft: 'auto', fontFamily: FONT.inter, fontWeight: 800, fontSize: 9.5, letterSpacing: '.3px', padding: '2px 8px', borderRadius: 10, background: '#fff', color: '#1FAE63' }}>
              {s.autoDetected ? '📧 AUTO-DETECTED' : '✍️ MARKED'}
            </span>
          )}
        </div>

        {credited ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: '#13795f', letterSpacing: '-.5px' }}>✅ Received {inr(s.creditedAmount)}</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: '#3a8a74', marginTop: 3 }}>
              into {s.accountName || 'your account'}{s.creditedDate ? ` on ${dayMonth(s.creditedDate)}` : ''}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 20, color: COLOR.ink, letterSpacing: '-.4px' }}>Pending · {inr(s.expectedAmount)}</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft, marginTop: 3 }}>
              Expected in {s.accountName || 'your account'}{s.payDay ? ` on the ${ordinal(s.payDay)}` : ''}
            </div>
            {s.canMarkCredited ? (
              <div onClick={() => setMarkOpen(true)} style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'linear-gradient(135deg,#2BC4B0,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13.5, color: '#fff', cursor: 'pointer' }}>✅ Salary credited this month</div>
            ) : (
              <div style={{ marginTop: 10, fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint }}>We'll auto-detect it from your bank email, or you can mark it from around the {ordinal(Math.min(s.payDay || 25, 25))}.</div>
            )}
          </div>
        )}
      </div>

      {/* Mark-credited confirm (editable amount + date) */}
      <Sheet open={markOpen} onClose={() => (busy ? null : setMarkOpen(false))}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: '#2BC4B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💼</div>
          <div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Salary credited</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>Adds income to {s.accountName || 'your salary account'}</div>
          </div>
        </div>

        {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

        <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '18px 2px 7px', letterSpacing: '.4px' }}>AMOUNT CREDITED</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
          <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder={String(s.expectedAmount || '')} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
        </div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint, margin: '6px 2px 0' }}>Edit if your actual salary differed this month.</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.muted }}>📅 Credited on</span>
          <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.ink, outline: 'none' }} />
        </div>

        <div onClick={busy ? undefined : markCredited} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#2BC4B0,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Confirm salary credit'}</div>
        <div onClick={() => (busy ? null : setMarkOpen(false))} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
      </Sheet>
    </>
  );
}
