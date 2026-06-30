'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { fmtPrice, fmtPct } from '../../common/lib/format.js';

const RANGES = ['1W', '1M', '6M', '1Y', '5Y'];

// Lightweight SVG area+line chart (no chart library). Stretches to container.
function PriceChart({ points, up }) {
  const W = 320, H = 150, P = 8;
  const n = points.length;
  const vals = points.map((p) => p.c);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => (n === 1 ? 0 : (i / (n - 1)) * W);
  const y = (c) => H - P - ((c - min) / span) * (H - 2 * P);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const stroke = up ? '#16a34a' : '#FF6B5E';
  const gid = `g_${up ? 'up' : 'dn'}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 168, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Full-screen instrument detail: live price + historical chart with range tabs.
 * `symbol` is a Yahoo symbol (AAPL, RELIANCE.NS, BTC-USD). `name` is shown
 * immediately in the header while the chart loads.
 */
export default function InstrumentDetail({ symbol, name, onBack }) {
  const [range, setRange] = useState('1M');
  const hist = useApi(() => api.getStockHistory(symbol, range), [symbol, range]);
  const d = hist.data;
  const up = (d?.windowChangePct ?? 0) >= 0;

  return (
    <div style={{ padding: '8px 18px 28px' }}>
      {/* Back + identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '4px 0 18px' }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', cursor: 'pointer', fontSize: 18, color: COLOR.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(90,70,130,.06)' }}>‹</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d?.name || name || symbol}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>{symbol}</div>
        </div>
      </div>

      {/* Price + window change */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '0 2px 14px' }}>
        <div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 34, color: COLOR.ink, letterSpacing: '-1px' }}>
            {d?.price != null ? fmtPrice(d.price, d.currency) : '—'}
          </div>
          {d?.windowChangePct != null && (
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: up ? '#16a34a' : '#FF6B5E', marginTop: 2 }}>
              {up ? '▲' : '▼'} {fmtPct(d.windowChangePct)} <span style={{ color: COLOR.mutedSoft }}>· past {range}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ borderRadius: 24, padding: '16px 12px 10px', background: '#fff', boxShadow: '0 12px 28px rgba(90,70,130,.09)', border: '1.5px solid #f1ecf6', minHeight: 200 }}>
        {hist.loading && !d ? (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>Loading chart…</div>
        ) : d && d.points?.length > 1 ? (
          <>
            <PriceChart points={d.points} up={up} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px 0' }}>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint }}>Low {fmtPrice(d.low, d.currency)}</span>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint }}>High {fmtPrice(d.high, d.currency)}</span>
            </div>
          </>
        ) : (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>Chart data unavailable for this range.</div>
        )}
      </div>

      {/* Range tabs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, background: '#f2eef7', borderRadius: 16, padding: 4 }}>
        {RANGES.map((r) => {
          const active = r === range;
          return (
            <div key={r} onClick={() => setRange(r)} style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 13, cursor: 'pointer', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, transition: 'all .15s', ...(active ? { background: '#fff', color: COLOR.ink, boxShadow: '0 4px 10px rgba(90,70,130,.12)' } : { background: 'transparent', color: COLOR.mutedSoft }) }}>{r}</div>
          );
        })}
      </div>

      {/* Stats */}
      {d && (
        <div style={{ marginTop: 16, borderRadius: 20, padding: '4px 18px', background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.06)', border: '1.5px solid #f1ecf6' }}>
          {[
            ['Current price', d.price != null ? fmtPrice(d.price, d.currency) : '—'],
            [`${range} high`, fmtPrice(d.high, d.currency)],
            [`${range} low`, fmtPrice(d.low, d.currency)],
            ['Currency', d.currency],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: i ? '1px solid #f4effa' : 'none' }}>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>{k}</span>
              <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 500, fontSize: 10.5, color: COLOR.mutedFaint, textAlign: 'center', lineHeight: 1.5 }}>
        Prices via Yahoo Finance · delayed. For information only, not investment advice.
      </div>
    </div>
  );
}
