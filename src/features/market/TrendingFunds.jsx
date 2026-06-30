'use client';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import LiveBadge from './LiveBadge.jsx';

// Trending mutual funds with live-computed 1Y / 3Y returns (MFAPI).
// Tapping a card opens the fund detail (chart + returns + SIP calc) via onOpen.
export default function TrendingFunds({ onOpen }) {
  const { data, loading } = useApi(api.getTrendingFunds, []);
  const funds = data || [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '26px 4px 13px' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, letterSpacing: '-.2px' }}>📊 Trending mutual funds</div>
        <LiveBadge />
      </div>

      {funds.length === 0 ? (
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, padding: '4px 4px 0' }}>
          {loading ? 'Loading live returns…' : 'Returns unavailable right now.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {funds.map((m) => {
            const headline = m.return3y != null ? m.return3y : m.return1y;
            const headlineLabel = m.return3y != null ? '3Y CAGR' : '1Y return';
            const up = (headline ?? 0) >= 0;
            return (
              <div key={m.schemeCode} onClick={() => onOpen?.(m.schemeCode, m.name)} style={{ borderRadius: 22, padding: 17, background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6', cursor: onOpen ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, lineHeight: 1.3 }}>{m.name}</div>
                    <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft, marginTop: 2 }}>{m.fundHouse}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: up ? '#16a34a' : '#FF6B5E', letterSpacing: '-.3px' }}>{headline != null ? `${headline > 0 ? '+' : ''}${headline}%` : '—'}</div>
                    <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft }}>{headlineLabel}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 }}>
                  <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, padding: '4px 11px', borderRadius: 14, background: m.riskBg, color: m.riskFg }}>{m.risk}</span>
                  <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.muted }}>{m.category}</span>
                  {m.return1y != null && <span style={{ marginLeft: 'auto', fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft }}>1Y {m.return1y > 0 ? '+' : ''}{m.return1y}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
