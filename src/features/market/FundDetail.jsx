'use client';
import { useMemo, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr } from '../../common/lib/format.js';

const RANGES = ['1M', '6M', '1Y', '3Y', 'MAX'];

// Inline SVG area+line chart with a real (time) x-axis. points = {t, c}.
function NavChart({ points, up }) {
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
  const gid = `mf_${up ? 'up' : 'dn'}`;
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

function axisLabels(points) {
  if (!points?.length) return [];
  const fmt = (t) => new Date(t).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return [fmt(points[0].t), fmt(points[Math.floor(points.length / 2)].t), fmt(points[points.length - 1].t)];
}

function pctLabel(n) {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${n}%`;
}

/**
 * Compute SIP outcome. Uses the future-value-of-a-series formula with a monthly
 * rate derived from an annual expected-return %. Returns invested / value / gain.
 *   FV = P * [ ((1+i)^n - 1) / i ] * (1+i)
 */
function sipResult(monthly, years, annualPct) {
  const n = Math.round(years * 12);
  const P = Number(monthly) || 0;
  const invested = P * n;
  const i = (Number(annualPct) || 0) / 100 / 12;
  let value;
  if (i === 0) value = invested;
  else value = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  return { invested, value: Math.round(value), gain: Math.round(value - invested) };
}

/**
 * Trending mutual-fund detail: NAV chart (date axis) with range tabs, latest NAV
 * + date, trailing returns (1Y/3Y/5Y), and a SIP calculator. Data from MFAPI.in
 * (keyless). Skeleton while loading; on a failed refresh keeps cached data and
 * shows a subtle note. `schemeCode` + `name` come from the trending list.
 */
export default function FundDetail({ schemeCode, name, onBack }) {
  const [range, setRange] = useState('1Y');
  const hist = useApi(() => api.getFundHistory(schemeCode, range), [schemeCode, range]);
  const d = hist.data;
  const up = (d?.windowChangePct ?? 0) >= 0;
  const staleAfterError = hist.error && d;
  const labels = axisLabels(d?.points);

  // SIP calculator state. Expected return defaults to the fund's historical
  // 3Y CAGR (fallback 1Y, then 12%); user can override.
  const [sipAmount, setSipAmount] = useState('5000');
  const [sipYears, setSipYears] = useState('5');
  const [expReturn, setExpReturn] = useState('');
  const defaultReturn = useMemo(() => {
    const r = d?.return3y ?? d?.return1y ?? 12;
    return Number.isFinite(r) ? r : 12;
  }, [d]);
  const effReturn = expReturn.trim() === '' ? defaultReturn : parseFloat(expReturn) || 0;
  const sip = useMemo(
    () => sipResult(parseFloat(sipAmount) || 0, parseFloat(sipYears) || 0, effReturn),
    [sipAmount, sipYears, effReturn]
  );

  return (
    <div style={{ padding: '8px 18px 28px' }}>
      {/* Back + identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '4px 0 16px' }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', cursor: 'pointer', fontSize: 18, color: COLOR.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(90,70,130,.06)' }}>‹</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 17, color: COLOR.ink, letterSpacing: '-.3px', lineHeight: 1.25 }}>{d?.name || name || `Scheme ${schemeCode}`}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>{d?.fundHouse || 'Mutual fund'}{d?.category ? ` · ${d.category}` : ''}</div>
        </div>
      </div>

      {/* NAV + window change */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '0 2px 14px' }}>
        <div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 32, color: COLOR.ink, letterSpacing: '-1px' }}>{d?.nav != null ? `₹${d.nav}` : '—'}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft, marginTop: 2 }}>NAV{d?.date ? ` · ${d.date}` : ''}</div>
        </div>
        {d?.windowChangePct != null && (
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: up ? '#16a34a' : '#FF6B5E' }}>{up ? '▲' : '▼'} {pctLabel(d.windowChangePct)} <span style={{ color: COLOR.mutedSoft }}>· {range}</span></div>
        )}
      </div>

      {staleAfterError && (
        <div style={{ marginBottom: 10, fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: '#9b7d12', background: '#FFF4DB', borderRadius: 11, padding: '6px 11px' }}>
          Couldn't refresh — showing the last known NAVs.
        </div>
      )}

      {/* Chart */}
      <div style={{ borderRadius: 24, padding: '16px 12px 10px', background: '#fff', boxShadow: '0 12px 28px rgba(90,70,130,.09)', border: '1.5px solid #f1ecf6', minHeight: 200 }}>
        {hist.loading && !d ? (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>Loading NAV history…</div>
        ) : d && d.points?.length > 1 ? (
          <>
            <NavChart points={d.points} up={up} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px 0' }}>
              {labels.map((l, i) => (<span key={i} style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10, color: COLOR.mutedFaint }}>{l}</span>))}
            </div>
          </>
        ) : (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>NAV history unavailable for this range.</div>
        )}
      </div>

      {/* Range tabs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, background: '#f2eef7', borderRadius: 16, padding: 4 }}>
        {RANGES.map((r) => {
          const active = r === range;
          return (
            <div key={r} onClick={() => setRange(r)} style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 13, cursor: 'pointer', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, ...(active ? { background: '#fff', color: COLOR.ink, boxShadow: '0 4px 10px rgba(90,70,130,.12)' } : { background: 'transparent', color: COLOR.mutedSoft }) }}>{r}</div>
          );
        })}
      </div>

      {/* Trailing returns */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {[['1Y', d?.return1y], ['3Y', d?.return3y], ['5Y', d?.return5y]].map(([k, v]) => {
          const pos = (v ?? 0) >= 0;
          return (
            <div key={k} style={{ flex: 1, borderRadius: 16, padding: '12px 10px', background: '#fff', boxShadow: '0 8px 18px rgba(90,70,130,.06)', border: '1.5px solid #f1ecf6', textAlign: 'center' }}>
              <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: COLOR.mutedSoft }}>{k} {k === '1Y' ? 'return' : 'CAGR'}</div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: v == null ? COLOR.mutedSoft : pos ? '#16a34a' : '#FF6B5E', marginTop: 3 }}>{pctLabel(v)}</div>
            </div>
          );
        })}
      </div>

      {/* SIP calculator */}
      <div style={{ marginTop: 18, borderRadius: 22, padding: 20, background: 'linear-gradient(135deg,#F4ECFF,#FBF7FF)', border: '1.5px solid #e4d8fb' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: COLOR.ink }}>🧮 SIP calculator</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft, marginTop: 3 }}>Estimate using this fund's historical return (editable).</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, margin: '0 2px 5px', letterSpacing: '.4px' }}>MONTHLY SIP (₹)</div>
            <input value={sipAmount} onChange={(e) => setSipAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" style={{ width: '100%', padding: '11px 12px', borderRadius: 13, border: '1.5px solid #e4d8fb', background: '#fff', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, outline: 'none' }} />
          </div>
          <div style={{ width: 78 }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, margin: '0 2px 5px', letterSpacing: '.4px' }}>YEARS</div>
            <input value={sipYears} onChange={(e) => setSipYears(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" style={{ width: '100%', padding: '11px 12px', borderRadius: 13, border: '1.5px solid #e4d8fb', background: '#fff', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, outline: 'none' }} />
          </div>
          <div style={{ width: 88 }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, margin: '0 2px 5px', letterSpacing: '.4px' }}>RETURN %</div>
            <input value={expReturn} onChange={(e) => setExpReturn(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder={String(defaultReturn)} style={{ width: '100%', padding: '11px 12px', borderRadius: 13, border: '1.5px solid #e4d8fb', background: '#fff', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, outline: 'none' }} />
          </div>
        </div>

        <div style={{ marginTop: 14, borderRadius: 16, background: '#fff', border: '1.5px solid #efe9f6', overflow: 'hidden' }}>
          {[
            ['You invest', inr(sip.invested)],
            [`Est. value (@ ${effReturn}% p.a.)`, inr(sip.value)],
            ['Estimated gains', `${sip.gain >= 0 ? '+' : ''}${inr(sip.gain)}`],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderTop: i ? '1px solid #f4effa' : 'none' }}>
              <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft }}>{k}</span>
              <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, color: i === 2 ? '#16a34a' : COLOR.ink }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontFamily: FONT.inter, fontWeight: 500, fontSize: 10, color: COLOR.mutedFaint, lineHeight: 1.5 }}>
          Projection only — actual returns vary. Past performance isn't a guarantee. Data via MFAPI.in.
        </div>
      </div>
    </div>
  );
}
