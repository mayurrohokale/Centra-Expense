'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr } from '../../common/lib/format.js';
import { GOAL_SUGGESTIONS } from '../../modules/goals/goalThemes.js';
import { GoalsSkeleton } from '../../common/ui/Skeleton.jsx';
import Sheet from '../../common/ui/Sheet.jsx';
import GoalSheet from './GoalSheet.jsx';
import ContributeSheet from './ContributeSheet.jsx';

const pctOf = (g) => Math.min(100, Math.round((g.saved / g.target) * 100));

export default function GoalsSection() {
  const goals = useApi(api.getGoals, []);
  const [editor, setEditor] = useState({ open: false, goal: null, prefill: null });
  const [contribute, setContribute] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const list = goals.data || [];
  const refresh = async () => { await goals.refetch(); };

  // Suggestions not already added (match by name, case-insensitive).
  const takenNames = new Set(list.map((g) => g.name.toLowerCase()));
  const suggestions = GOAL_SUGGESTIONS.filter((s) => !takenNames.has(s.name.toLowerCase()));

  async function confirmRemove() {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await api.deleteGoal(removeTarget._id);
      await goals.refetch();
      setRemoveTarget(null);
    } catch { /* leave open */ } finally { setRemoving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 13px' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, letterSpacing: '-.2px' }}>🎯 Your goals</div>
        <div onClick={() => setEditor({ open: true, goal: null, prefill: null })} style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.purple, cursor: 'pointer' }}>+ New goal</div>
      </div>

      {/* Loading skeleton (first load, before any data) */}
      {goals.loading && !goals.data && <GoalsSkeleton count={3} />}

      {/* Goal cards */}
      {!(goals.loading && !goals.data) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {list.map((g) => {
          const pct = pctOf(g);
          const done = pct >= 100;
          return (
            <div key={g._id} style={{ borderRadius: 24, padding: 18, background: g.bg, border: `1.5px solid ${g.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 46, height: 46, borderRadius: 15, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, boxShadow: '0 6px 14px rgba(90,70,130,.10)' }}>{g.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink }}>{g.name}</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: COLOR.muted }}>{inr(g.saved)} of {inr(g.target)}</div>
                </div>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: g.accent }}>{pct}%</div>
              </div>
              <div style={{ height: 11, borderRadius: 20, background: 'rgba(255,255,255,.7)', marginTop: 14, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 20, background: g.accent, transition: 'width .25s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <div onClick={() => setContribute(g)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 13, background: g.accent, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer' }}>{done ? '✓ Add more' : '+ Add money'}</div>
                <div onClick={() => setEditor({ open: true, goal: g, prefill: null })} style={{ padding: '10px 14px', borderRadius: 13, background: 'rgba(255,255,255,.7)', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.muted, cursor: 'pointer' }}>Edit</div>
                <div onClick={() => setRemoveTarget(g)} style={{ padding: '10px 14px', borderRadius: 13, background: 'rgba(255,255,255,.7)', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.expense, cursor: 'pointer' }}>✕</div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Empty state */}
      {!goals.loading && list.length === 0 && (
        <div style={{ borderRadius: 24, padding: '24px 20px', background: '#fff', border: '1.5px dashed #e4d8fb', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🎯</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: COLOR.ink, marginTop: 8 }}>Set your first goal</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 5, lineHeight: 1.5 }}>Save for what matters. Pick a suggestion below or create your own.</div>
        </div>
      )}

      {/* Quick-add suggestions */}
      {!(goals.loading && !goals.data) && suggestions.length > 0 && (
        <>
          <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: COLOR.mutedSoft, letterSpacing: '.5px', margin: '18px 4px 11px' }}>SUGGESTED · TAP TO ADD</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -18px', padding: '2px 18px 6px' }}>
            {suggestions.map((s) => (
              <div key={s.name} onClick={() => setEditor({ open: true, goal: null, prefill: s })} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 15px', borderRadius: 18, background: '#fff', border: '1.5px solid #f1ecf6', boxShadow: '0 8px 18px rgba(90,70,130,.05)', cursor: 'pointer' }}>
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <div>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.ink, whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedSoft }}>Target {inr(s.target)}</div>
                </div>
                <span style={{ marginLeft: 4, fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: COLOR.purple }}>+</span>
              </div>
            ))}
          </div>
        </>
      )}

      <GoalSheet open={editor.open} goal={editor.goal} prefill={editor.prefill} onClose={() => setEditor({ open: false, goal: null, prefill: null })} onSaved={refresh} />
      <ContributeSheet open={!!contribute} goal={contribute} onClose={() => setContribute(null)} onSaved={refresh} />

      <Sheet open={!!removeTarget} onClose={() => (removing ? null : setRemoveTarget(null))}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🗑️</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, marginTop: 10 }}>Remove {removeTarget?.name}?</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 6 }}>This deletes the goal and its progress.</div>
        </div>
        <div onClick={removing ? undefined : confirmRemove} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: removing ? 0.7 : 1 }}>{removing ? 'Removing…' : 'Remove goal'}</div>
        <div onClick={() => (removing ? null : setRemoveTarget(null))} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
      </Sheet>
    </div>
  );
}
