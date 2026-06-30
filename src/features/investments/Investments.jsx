'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR, GRADIENT } from '../../common/theme/tokens.js';
import { inr } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { InvestmentsSkeleton } from '../../common/ui/Skeleton.jsx';
import Sheet from '../../common/ui/Sheet.jsx';
import ConsentView from './ConsentView.jsx';
import AddHoldingSheet from './AddHoldingSheet.jsx';

const SECTIONS = [
  { type: 'mutual_fund', emoji: '📊', title: 'Mutual Funds' },
  { type: 'crypto', emoji: '🪙', title: 'Crypto' },
  { type: 'fd', emoji: '🏦', title: 'Fixed Deposits' },
];

const ALLOC_LEGEND = [
  { key: 'mutual_fund', label: 'Mutual Funds', color: '#34D39E' },
  { key: 'fd', label: 'Fixed Dep.', color: '#FFD166' },
  { key: 'crypto', label: 'Crypto', color: '#FF9FC4' },
];

function HoldingRow({ h }) {
  const pl = h.currentValue - h.investedValue;
  const up = pl >= 0;
  const pct = h.investedValue > 0 ? ((pl / h.investedValue) * 100).toFixed(1) : '0.0';
  const plColor = up ? '#16a34a' : '#FF6B5E';
  const plBg = up ? '#E6F8F1' : '#FFE9E5';
  return (
    <div style={{ borderRadius: 22, padding: '15px 17px', background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: h.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, color: '#fff' }}>{h.tag}</div>
        <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{h.name}</div><div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{h.subtitle}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, letterSpacing: '-.3px' }}>{inr(h.currentValue)}</div><div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: plColor }}>{up ? '+' : ''}{pct}%</div></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1.5px dashed #f1ecf6' }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>Invested {inr(h.investedValue)}</span>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, padding: '3px 10px', borderRadius: 12, background: plBg, color: plColor }}>{up ? '+' : '-'}{inr(Math.abs(pl))}</span>
      </div>
    </div>
  );
}

export default function Investments() {
  const [view, setView] = useState('list'); // list | consent
  const [addOpen, setAddOpen] = useState(false);
  const [casOpen, setCasOpen] = useState(false);
  const holdings = useApi(api.getHoldings, []);
  const portfolio = useApi(api.getPortfolio, []);

  if (view === 'consent') {
    return <ConsentView onDone={() => { setView('list'); }} />;
  }

  const loading = holdings.loading || portfolio.loading;
  const error = holdings.error || portfolio.error;
  if (loading) return <InvestmentsSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => { holdings.refetch(); portfolio.refetch(); }} />;

  const all = holdings.data || [];
  const port = portfolio.data || { current: 0, invested: 0, returns: 0, allocation: {} };

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 4px 14px' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 25, color: COLOR.ink, letterSpacing: '-.6px' }}>Investments 📈</div>
      </div>

      {/* auto-synced banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 18, background: 'linear-gradient(120deg,#E9FBF3,#DCF6EA)', border: '1.5px solid #c5efdc' }}>
        <span style={{ fontSize: 15 }}>✅</span>
        <div style={{ flex: 1, lineHeight: 1.25 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#13795f' }}>Synced via Account Aggregator</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: '#3a8a74' }}>updated 2 hrs ago</div>
        </div>
        <div onClick={() => { holdings.refetch(); portfolio.refetch(); }} style={{ width: 30, height: 30, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 10px rgba(43,196,176,.2)' }}>🔄</div>
      </div>

      {/* summary card */}
      <div style={{ marginTop: 16, borderRadius: 30, padding: 24, background: GRADIENT.invest, boxShadow: '0 18px 38px rgba(108,92,231,.36)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,.13)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.85)', letterSpacing: '.6px' }}>CURRENT VALUE</div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 38, marginTop: 3, letterSpacing: '-1px' }}>{inr(port.current)}</div>
            </div>
            <div style={{ position: 'relative', flex: '0 0 auto', width: 78, height: 78, borderRadius: '50%', background: 'conic-gradient(#34D39E 0deg 175.4deg,#FFD166 175.4deg 286.2deg,#FF9FC4 286.2deg 360deg)' }}>
              <div style={{ position: 'absolute', inset: 12, background: '#7e6ce0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 16, padding: 12 }}><div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,.82)' }}>Invested</div><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{inr(port.invested)}</div></div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 16, padding: 12 }}><div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,.82)' }}>Total returns</div><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, marginTop: 2, color: '#c8ffe1' }}>+{inr(port.returns)}</div></div>
            <div style={{ flex: '0 0 auto', background: 'rgba(255,255,255,.92)', borderRadius: 16, padding: '12px 13px', textAlign: 'center' }}><div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: '#6c5ce7' }}>XIRR</div><div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, marginTop: 2, color: '#16a34a' }}>18.6%</div></div>
          </div>
        </div>
      </div>

      {/* allocation legend */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {ALLOC_LEGEND.map((al) => (
          <div key={al.key} style={{ flex: 1, borderRadius: 16, padding: '11px 12px', background: '#fff', boxShadow: '0 8px 18px rgba(90,70,130,.06)', border: '1.5px solid #f1ecf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: al.color }} /><span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: COLOR.mutedSoft }}>{al.label}</span></div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, marginTop: 5, letterSpacing: '-.3px' }}>{port.allocation?.[al.key] || 0}%</div>
          </div>
        ))}
      </div>

      {/* link account */}
      <div onClick={() => setView('consent')} style={{ marginTop: 16, padding: 15, borderRadius: 18, background: '#2a2733', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', boxShadow: '0 10px 22px rgba(42,39,51,.28)' }}>
        <span style={{ fontSize: 16 }}>🔗</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#fff' }}>Link an account</span>
      </div>

      {/* holdings sections */}
      {SECTIONS.map((sec) => {
        const items = all.filter((h) => h.instrumentType === sec.type);
        if (!items.length) return null;
        const total = items.reduce((s, h) => s + h.currentValue, 0);
        return (
          <div key={sec.type} style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 12px' }}>
              <span style={{ fontSize: 18 }}>{sec.emoji}</span>
              <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, letterSpacing: '-.2px' }}>{sec.title}</span>
              <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, marginLeft: 'auto', letterSpacing: '-.2px' }}>{inr(total)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {items.map((h) => (<HoldingRow key={h._id} h={h} />))}
            </div>
          </div>
        );
      })}

      {/* secondary options */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div onClick={() => setCasOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 20, padding: '15px 16px', background: '#fff', border: '1.5px dashed #ddd4ea', cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#F4ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>📄</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>Import CAS statement</div><div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>Upload a CAMS/KFintech PDF</div></div>
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#A78BFA' }}>Upload</span>
        </div>
        <div onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 20, padding: '15px 16px', background: '#fff', border: '1.5px dashed #ddd4ea', cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>➕</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>Add manually</div><div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>For assets we can't auto-fetch (e.g. wallet)</div></div>
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#FF9F1C' }}>Add</span>
        </div>
      </div>

      <AddHoldingSheet open={addOpen} onClose={() => setAddOpen(false)} onDone={() => { holdings.refetch(); portfolio.refetch(); }} />

      <Sheet open={casOpen} onClose={() => setCasOpen(false)}>
        <div style={{ textAlign: 'center', padding: '4px 6px 6px' }}>
          <div style={{ fontSize: 38 }}>📄</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, marginTop: 10, letterSpacing: '-.3px' }}>CAS import — coming soon</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.muted, marginTop: 8, lineHeight: 1.55 }}>
            CAMS/KFintech PDF parsing arrives in a later milestone. For now, use “Add manually” or sync via Account Aggregator.
          </div>
          <div onClick={() => setCasOpen(false)} style={{ marginTop: 18, padding: 14, borderRadius: 16, background: '#2a2733', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#fff', cursor: 'pointer' }}>Got it</div>
        </div>
      </Sheet>
    </div>
  );
}
