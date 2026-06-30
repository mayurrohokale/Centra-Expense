'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';

const QUICK = [500, 1000, 2500, 5000];

// Add money toward a goal, with quick-amount chips and a live progress preview.
export default function ContributeSheet({ open, onClose, goal, onSaved }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (open) { setAmount(''); setErr(''); } }, [open]);

  if (!open || !goal) return null;

  const amt = parseFloat(amount) || 0;
  const newSaved = goal.saved + amt;
  const newPct = Math.min(100, Math.round((newSaved / goal.target) * 100));

  async function submit() {
    if (busy) return;
    setErr('');
    if (amt <= 0) { setErr('Enter an amount to add.'); return; }
    setBusy(true);
    try {
      await api.updateGoal(goal._id, { addAmount: amt });
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
        <div style={{ width: 46, height: 46, borderRadius: 15, background: goal.bg, border: `1.5px solid ${goal.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{goal.emoji}</div>
        <div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Add to {goal.name}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>{inr(goal.saved)} of {inr(goal.target)} saved</div>
        </div>
      </div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

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

      {amt > 0 && (
        <div style={{ marginTop: 16, borderRadius: 16, padding: '13px 15px', background: goal.bg, border: `1.5px solid ${goal.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: COLOR.ink }}>
            <span>New total {inr(newSaved)}</span>
            <span style={{ color: goal.accent }}>{newPct}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 20, background: 'rgba(255,255,255,.75)', marginTop: 9, overflow: 'hidden' }}>
            <div style={{ width: `${newPct}%`, height: '100%', borderRadius: 20, background: goal.accent, transition: 'width .2s' }} />
          </div>
          {newPct >= 100 && <div style={{ marginTop: 9, fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, color: goal.accent }}>🎉 Goal reached!</div>}
        </div>
      )}

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#2BC4B0,#1FAE63)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Adding…' : 'Add money'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
