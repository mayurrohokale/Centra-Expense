'use client';
import { NAV } from '../theme/tokens.js';

export default function BottomNav({ tab, onTab }) {
  return (
    <div
      className="safe-pad-bottom"
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1.5px solid #f0ebf5',
        // bottom padding comes from .safe-pad-bottom (22px + safe-area inset);
        // keep top + horizontal here (no inline paddingBottom — it'd beat the class).
        paddingTop: 10, paddingLeft: 12, paddingRight: 12,
        display: 'flex', justifyContent: 'space-around', zIndex: 35,
      }}
    >
      {NAV.map((n) => {
        const active = tab === n.key;
        return (
          <div
            key={n.key}
            onClick={() => onTab(n.key)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}
          >
            <div
              style={{
                width: 42, height: 34, borderRadius: 14, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 19, transition: 'all .2s',
                ...(active
                  ? { background: n.color, boxShadow: `0 6px 14px ${n.color}55` }
                  : { background: 'transparent', filter: 'grayscale(.25)', opacity: 0.55 }),
              }}
            >
              {n.emoji}
            </div>
            <div style={{ fontFamily: "'Inter'", fontWeight: 800, fontSize: 10, color: active ? n.color : '#a8a2b4' }}>
              {n.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
