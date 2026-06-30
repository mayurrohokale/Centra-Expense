'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { GOAL_EMOJIS } from '../../modules/goals/goalThemes.js';
import Sheet from '../../common/ui/Sheet.jsx';

const labelStyle = {
  fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft,
  margin: '16px 2px 7px', letterSpacing: '.4px',
};

/**
 * Create or edit a goal. `goal` null → create; `prefill` (from a suggestion)
 * seeds the fields for a fast "tap to add" flow.
 */
export default function GoalSheet({ open, onClose, goal, prefill, onSaved }) {
  const editing = !!goal;
  const [emoji, setEmoji] = useState('🎯');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const src = goal || prefill;
    setEmoji(src?.emoji || '🎯');
    setName(src?.name || '');
    setTarget(src?.target ? String(src.target) : '');
    setErr('');
  }, [open, goal, prefill]);

  if (!open) return null;

  async function submit() {
    if (busy) return;
    setErr('');
    if (!name.trim()) { setErr('Give your goal a name.'); return; }
    const tgt = parseFloat(target);
    if (Number.isNaN(tgt) || tgt < 1) { setErr('Enter a target amount.'); return; }
    setBusy(true);
    try {
      if (editing) {
        await api.updateGoal(goal._id, { name: name.trim(), emoji, target: tgt });
      } else {
        await api.createGoal({ name: name.trim(), emoji, target: tgt, theme: prefill?.theme });
      }
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
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.3px' }}>{editing ? 'Edit goal' : 'New goal'}</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, marginTop: 3 }}>Set what you're saving for and the target.</div>

      {err && <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      <div style={labelStyle}>ICON</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {GOAL_EMOJIS.map((e) => (
          <div key={e} onClick={() => setEmoji(e)} style={{ width: 42, height: 42, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', background: emoji === e ? '#2a2733' : '#FBF8F4', border: `1.5px solid ${emoji === e ? '#2a2733' : '#f1ecf6'}` }}>{e}</div>
        ))}
      </div>

      <div style={labelStyle}>GOAL NAME</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goa trip" style={{ width: '100%', padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6', outline: 'none', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink }} />

      <div style={labelStyle}>TARGET AMOUNT</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink }}>₹</span>
        <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="150000" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, minWidth: 0 }} />
      </div>

      <div onClick={busy ? undefined : submit} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create goal'}</div>
      <div onClick={onClose} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
