'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { usePoll } from '../../common/hooks/usePoll.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { fmtPrice, fmtPct } from '../../common/lib/format.js';
import LiveBadge from './LiveBadge.jsx';

// Product-spec ranges for crypto history (CoinGecko market_chart).
const RANGES = ['24h', '7d', '30d'];

/**
 * Inline SVG area+line chart with a real time axis. `points` are {t (ms), c}.
 * No chart dependency — pure SVG/CSS. X positions are spaced by timestamp so the
 * date axis is honest (gaps render as gaps).
 */
function PriceChart({ points, up }) {
  const W = 320, H = 150, P = 8;
  const vals = points.map((p) => p.c);
  const ts = points.map((p) => p.t);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const spanV = maxV - minV || 1;
  const minT = ts[0], maxT = ts[ts.length - 1];
  const spanT = maxT - minT || 1;
  const x = (t) => ((t - minT) / spanT) * W;
  const y = (c) => H - P - ((c - minV) / spanV) * (H - 2 * P);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const stroke = up ? '#16a34a' : '#FF6B5E';
  const gid = `cg_${up ? 'up' : 'dn'}`;
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

// Time-axis tick labels appropriate to the range.
function axisLabels(points, range) {
  if (!points?.length) return [];
  const first = points[0].t, last = points[points.length - 1].t;
  const mid = points[Math.floor(points.length / 2)].t;
  const fmt = (t) => {
    const d = new Date(t);
    if (range === '24h') return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  return [fmt(first), fmt(mid), fmt(last)];
}

function relTime(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Crypto instrument detail: live price + price-vs-date chart (CoinGecko), range
 * tabs 24h/7d/30d, % change for the range, and a last-updated timestamp. Polls
 * every 45s while visible (and on tab focus). On a failed refresh it keeps the
 * last cached values and shows a subtle "couldn't refresh" note — never crashes.
 *
 * `id` is a CoinGecko id or a symbol (BTC-USD / BTC). `name` shows immediately.
 */
export default function CryptoDetail({ id, name, onBack }) {
  const [range, setRange] = useState('7d');
  const hist = useApi(() => api.getCryptoHistory(id, range), [id, range]);
  // Realtime: refresh the chart+price every 45s while the view is open, and
  // immediately when the tab regains focus (usePoll handles visibility).
  usePoll(hist.refetch, 45000);

  const d = hist.data;
  const up = (d?.windowChangePct ?? 0) >= 0;
  const staleAfterError = hist.error && d; // showing cached data after a failed refresh
  const labels = axisLabels(d?.points, range);

  return (
    <div style={{ padding: '8px 18px 28px' }}>
      {/* Back + identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '4px 0 18px' }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', cursor: 'pointer', fontSize: 18, color: COLOR.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(90,70,130,.06)' }}>‹</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d?.name || name || id}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>Crypto · USD</div>
        </div>
        <LiveBadge />
      </div>

      {/* Price + window change */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '0 2px 14px' }}>
        <div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 34, color: COLOR.ink, letterSpacing: '-1px' }}>
            {d?.price != null ? fmtPrice(d.price, 'USD') : '—'}
          </div>
          {d?.windowChangePct != null && (
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: up ? '#16a34a' : '#FF6B5E', marginTop: 2 }}>
              {up ? '▲' : '▼'} {fmtPct(d.windowChangePct)} <span style={{ color: COLOR.mutedSoft }}>· past {range}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint }}>
          {d?.updatedAt ? `Updated ${relTime(d.updatedAt)}` : ''}
        </div>
      </div>

      {staleAfterError && (
        <div style={{ marginBottom: 10, fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: '#9b7d12', background: '#FFF4DB', borderRadius: 11, padding: '6px 11px' }}>
          Couldn't refresh — showing the last known prices.
        </div>
      )}

      {/* Chart */}
      <div style={{ borderRadius: 24, padding: '16px 12px 10px', background: '#fff', boxShadow: '0 12px 28px rgba(90,70,130,.09)', border: '1.5px solid #f1ecf6', minHeight: 200 }}>
        {hist.loading && !d ? (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>Loading chart…</div>
        ) : d && d.points?.length > 1 ? (
          <>
            <PriceChart points={d.points} up={up} />
            {/* Time (date) axis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px 0' }}>
              {labels.map((l, i) => (
                <span key={i} style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10, color: COLOR.mutedFaint }}>{l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px 0' }}>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint }}>Low {fmtPrice(d.low, 'USD')}</span>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint }}>High {fmtPrice(d.high, 'USD')}</span>
            </div>
          </>
        ) : (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>Chart data unavailable for this range.</div>
        )}
      </div>

      {/* Range tabs — 24h / 7d / 30d */}
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
            ['Current price', d.price != null ? fmtPrice(d.price, 'USD') : '—'],
            [`${range} change`, d.windowChangePct != null ? fmtPct(d.windowChangePct) : '—'],
            [`${range} high`, fmtPrice(d.high, 'USD')],
            [`${range} low`, fmtPrice(d.low, 'USD')],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: i ? '1px solid #f4effa' : 'none' }}>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>{k}</span>
              <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, fontFamily: FONT.inter, fontWeight: 500, fontSize: 10.5, color: COLOR.mutedFaint, textAlign: 'center', lineHeight: 1.5 }}>
        Prices via CoinGecko · refreshes automatically. For information only, not investment advice.
      </div>
    </div>
  );
}
