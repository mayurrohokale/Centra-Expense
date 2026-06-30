'use client';
import { FONT, COLOR } from '../theme/tokens.js';

export function Loading({ label = 'Loading…' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const isDb = error?.status === 503;
  return (
    <div style={{ textAlign: 'center', padding: '40px 22px' }}>
      <div style={{ fontSize: 38 }}>{isDb ? '🔌' : '⚠️'}</div>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, marginTop: 10 }}>
        {isDb ? 'Backend has no database yet' : 'Something went wrong'}
      </div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, marginTop: 6, lineHeight: 1.5 }}>
        {isDb
          ? 'Set MONGODB_URI in .env.local and run `npm run seed`, then retry.'
          : error?.message || 'Please try again.'}
      </div>
      {onRetry && (
        <div
          onClick={onRetry}
          style={{ marginTop: 18, display: 'inline-block', padding: '10px 18px', borderRadius: 14, background: '#2a2733', color: '#fff', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          Retry
        </div>
      )}
    </div>
  );
}
