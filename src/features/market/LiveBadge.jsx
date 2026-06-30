'use client';
import { FONT } from '../../common/theme/tokens.js';

// Small pulsing "LIVE" pill used on realtime market sections.
export default function LiveBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#EAF7EF', color: '#1FAE63', fontFamily: FONT.inter, fontWeight: 800, fontSize: 9.5, letterSpacing: '.5px', padding: '3px 8px', borderRadius: 12 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1FAE63', animation: 'pulse 1.4s ease-in-out infinite' }} />
      LIVE
    </span>
  );
}
