'use client';
import { SOURCE_BADGE, sourceBadgeText } from '../theme/tokens.js';

// Renders the per-transaction source badge (email / aa_sync / cash / manual).
export default function SourceBadge({ source, accountName }) {
  const palette = SOURCE_BADGE[source] || SOURCE_BADGE.manual;
  return (
    <span
      style={{
        fontFamily: "'Inter'", fontWeight: 700, fontSize: 10.5,
        padding: '4px 10px', borderRadius: 11,
        background: palette.bg, color: palette.fg,
      }}
    >
      {sourceBadgeText(source, accountName)}
    </span>
  );
}
