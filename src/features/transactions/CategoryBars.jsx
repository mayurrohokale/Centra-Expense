'use client';
import { FONT, COLOR, CARD } from '../../common/theme/tokens.js';

// Category display meta (matches seeded categories).
const CAT_META = {
  food: { emoji: '🍔', color: 'linear-gradient(180deg,#FF8A7A,#FF6B5E)' },
  shopping: { emoji: '🛍️', color: 'linear-gradient(180deg,#C8A2FF,#A78BFA)' },
  bills: { emoji: '⚡', color: 'linear-gradient(180deg,#FFD166,#FFB23E)' },
  transport: { emoji: '🚕', color: 'linear-gradient(180deg,#4ECDC4,#2BC4B0)' },
  entertainment: { emoji: '🎬', color: 'linear-gradient(180deg,#FF9FC4,#FF6FA5)' },
  health: { emoji: '🩺', color: 'linear-gradient(180deg,#7BE3C9,#34D39E)' },
  services: { emoji: '🧾', color: 'linear-gradient(180deg,#A78BFA,#6C5CE7)' },
  other: { emoji: '🏷️', color: 'linear-gradient(180deg,#cdbfe4,#9b94a8)' },
  income: { emoji: '💰', color: 'linear-gradient(180deg,#34D39E,#1FAE63)' },
};

function compact(n) {
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// "Where it went" bar chart — top spend categories, data-driven heights.
export default function CategoryBars({ data }) {
  const top = [...data].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const max = top.length ? top[0].amount : 1;

  return (
    <div style={{ marginTop: 24, borderRadius: 28, padding: 22, ...CARD }}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>Where it went · June</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, height: 120, marginTop: 20 }}>
        {top.map((c) => {
          const meta = CAT_META[c._id] || CAT_META.other;
          const h = Math.max(12, Math.round((c.amount / max) * 100));
          return (
            <div key={c._id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 10, color: COLOR.muted }}>{compact(c.amount)}</div>
              <div style={{ width: '100%', maxWidth: 34, height: `${h}%`, borderRadius: 12, background: meta.color }} />
              <div style={{ fontSize: 16 }}>{meta.emoji}</div>
            </div>
          );
        })}
        {top.length === 0 && (
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft }}>No spending yet</div>
        )}
      </div>
    </div>
  );
}
