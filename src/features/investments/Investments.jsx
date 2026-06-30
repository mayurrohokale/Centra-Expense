'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR, GRADIENT } from '../../common/theme/tokens.js';
import { inr, fmtPrice, dayMonth } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { InvestmentsSkeleton } from '../../common/ui/Skeleton.jsx';
import Sheet from '../../common/ui/Sheet.jsx';
import ConsentView from './ConsentView.jsx';
import AddHoldingSheet from './AddHoldingSheet.jsx';

// Currency-aware money format for a holding (crypto = $, else ₹).
const money = (h, v) => (h?.currency === 'USD' ? fmtPrice(v, 'USD') : inr(v));

const SECTIONS = [
  { type: 'mutual_fund', emoji: '📊', title: 'Mutual Funds' },
  { type: 'crypto', emoji: '🪙', title: 'Crypto' },
  { type: 'fd', emoji: '🏦', title: 'Fixed Deposits' },
];

// Friendly labels for instrument types (used in the manual investments list).
const TYPE_LABEL = {
  mutual_fund: 'Mutual Fund', crypto: 'Crypto', fd: 'Fixed Deposit',
  stocks: 'Stocks', gold: 'Gold', other: 'Other',
};

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
  const [editHolding, setEditHolding] = useState(null); // manual holding being edited
  const [delHolding, setDelHolding] = useState(null); // manual holding pending delete
  const [deleting, setDeleting] = useState(false);
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
  const manual = all.filter((h) => h.source === 'manual');
  // Header total sums only ₹ holdings (crypto is in USD and shown per-card) to
  // avoid a misleading mixed-currency sum. The portfolio card has the full ₹ rollup.
  const manualHasCrypto = manual.some((h) => h.currency === 'USD');
  const manualCurrentInr = manual.filter((h) => h.currency !== 'USD').reduce((s, h) => s + h.currentValue, 0);

  const refreshHoldings = () => { holdings.refetch(); portfolio.refetch(); };

  async function confirmDeleteHolding() {
    if (!delHolding || deleting) return;
    setDeleting(true);
    try {
      await api.deleteHolding(delHolding._id);
      setDelHolding(null);
      refreshHoldings();
    } catch { /* keep modal open */ } finally { setDeleting(false); }
  }

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

      {/* holdings sections — auto-synced (AA / CAS / market) holdings grouped by type */}
      {SECTIONS.map((sec) => {
        const items = all.filter((h) => h.instrumentType === sec.type && h.source !== 'manual');
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

      {/* MANUAL INVESTMENTS — user-entered holdings (any type), editable + deletable */}
      <div style={{ marginTop: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 12px' }}>
          <span style={{ fontSize: 18 }}>✍️</span>
          <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, letterSpacing: '-.2px' }}>Manual investments</span>
          {manual.length > 0 && <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, marginLeft: 'auto', letterSpacing: '-.2px' }}>{inr(manualCurrentInr)}{manualHasCrypto ? ' + crypto' : ''}</span>}
        </div>

        {manual.length === 0 ? (
          <div style={{ borderRadius: 22, padding: '22px 18px', background: '#fff', border: '1.5px dashed #e4d8fb', textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>✍️</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, marginTop: 7 }}>No manual investments yet</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, marginTop: 5, lineHeight: 1.5 }}>Add stocks, gold, FDs or anything you track yourself.</div>
            <div onClick={() => { setEditHolding(null); setAddOpen(true); }} style={{ marginTop: 14, display: 'inline-block', padding: '10px 18px', borderRadius: 14, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, color: '#fff', cursor: 'pointer' }}>+ Add investment</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {manual.map((h) => {
              const isCrypto = h.instrumentType === 'crypto';
              const isFd = h.instrumentType === 'fd';
              const pl = h.currentValue - h.investedValue;
              const up = pl >= 0;
              const plColor = up ? '#16a34a' : '#FF6B5E';
              const plPct = h.investedValue > 0 ? ((pl / h.investedValue) * 100).toFixed(1) : null;
              const hasPL = (isCrypto || (h.currentValue != null && h.currentValue !== h.investedValue));
              return (
                <div key={h._id} style={{ borderRadius: 22, padding: '15px 17px', background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: h.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, color: '#fff' }}>{h.tag}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9.5, letterSpacing: '.3px', padding: '2px 8px', borderRadius: 10, background: '#F2ECFC', color: '#7a5fc0' }}>{TYPE_LABEL[h.instrumentType] || 'Other'}</span>
                        {isCrypto && <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9.5, letterSpacing: '.3px', padding: '2px 8px', borderRadius: 10, background: h.priceStale ? '#FFF4DB' : '#EAF7EF', color: h.priceStale ? '#9b7d12' : '#1FAE63' }}>{h.priceStale ? 'PRICE STALE' : '$ LIVE'}</span>}
                        {isFd && h.maturedCredited && <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9.5, letterSpacing: '.3px', padding: '2px 8px', borderRadius: 10, background: '#EAF7EF', color: '#1FAE63' }}>✓ MATURED · CREDITED</span>}
                        {!isCrypto && !isFd && <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9.5, letterSpacing: '.3px', padding: '2px 8px', borderRadius: 10, background: '#FFF4DB', color: '#9b7d12' }}>✍️ Manual</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, letterSpacing: '-.3px' }}>{money(h, h.currentValue)}</div>
                      {hasPL && <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: plColor }}>{up ? '+' : '-'}{money(h, Math.abs(pl))}{plPct != null ? ` (${up ? '+' : ''}${plPct}%)` : ''}</div>}
                    </div>
                  </div>
                  {/* Type-specific detail line */}
                  {isCrypto && (
                    <div style={{ marginTop: 10, fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedSoft }}>
                      {h.units} {h.tag} · cost {fmtPrice(h.investedValue, 'USD')}{h.spotUsd != null ? ` · spot ${fmtPrice(h.spotUsd, 'USD')}` : ''}{h.purchaseDate ? ` · since ${dayMonth(h.purchaseDate)}` : ''}
                    </div>
                  )}
                  {isFd && (
                    <div style={{ marginTop: 10, fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedSoft }}>
                      Principal {inr(h.principal || h.investedValue)} · {h.interestRate}% p.a.{h.fdStartDate ? ` · ${dayMonth(h.fdStartDate)}` : ''}{h.maturityDate ? ` → ${dayMonth(h.maturityDate)}` : ''} · matures ≈ {inr(h.maturityValue || h.currentValue)}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1.5px dashed #f1ecf6' }}>
                    <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{isFd ? 'Deposited' : 'Invested'} {money(h, h.investedValue)}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span onClick={() => { setEditHolding(h); setAddOpen(true); }} style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, color: '#7a5fc0', cursor: 'pointer' }}>Edit</span>
                      <span onClick={() => setDelHolding(h)} style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, color: COLOR.expense, cursor: 'pointer' }}>Delete</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div onClick={() => { setEditHolding(null); setAddOpen(true); }} style={{ textAlign: 'center', padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px dashed #ddd4ea', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#7a5fc0', cursor: 'pointer' }}>+ Add investment</div>
          </div>
        )}
      </div>

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

      <AddHoldingSheet open={addOpen} holding={editHolding} onClose={() => { setAddOpen(false); setEditHolding(null); }} onDone={refreshHoldings} />

      {/* Delete manual holding confirmation */}
      <Sheet open={!!delHolding} onClose={() => (deleting ? null : setDelHolding(null))}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🗑️</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, marginTop: 10 }}>Delete {delHolding?.name}?</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 6, lineHeight: 1.5 }}>This removes the manual investment from your portfolio.</div>
        </div>
        <div onClick={deleting ? undefined : confirmDeleteHolding} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>{deleting ? 'Deleting…' : 'Delete'}</div>
        <div onClick={() => (deleting ? null : setDelHolding(null))} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
      </Sheet>

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
