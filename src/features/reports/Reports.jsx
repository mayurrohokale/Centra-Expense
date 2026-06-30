'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR, CARD } from '../../common/theme/tokens.js';
import { inr, inrCompact, dayMonth } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { ReportsSkeleton } from '../../common/ui/Skeleton.jsx';

const PERIODS = [
  ['this_month', 'This month'],
  ['last_month', 'Last month'],
  ['last_3_months', '3 months'],
  ['this_year', 'This year'],
  ['custom', 'Custom'],
];

/** Build a conic-gradient donut from ranked category slices. */
function donutGradient(slices) {
  if (!slices.length) return '#eee6f3';
  let acc = 0;
  const stops = slices.map((s) => {
    const start = acc * 3.6;
    acc += s.pct;
    return `${s.color} ${start}deg ${Math.min(acc, 100) * 3.6}deg`;
  });
  // pad remainder so rounding gaps don't show a seam
  if (acc < 100) stops.push(`#eee6f3 ${acc * 3.6}deg 360deg`);
  return `conic-gradient(${stops.join(',')})`;
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Reports({ onBack }) {
  const [period, setPeriod] = useState('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);

  // Only send from/to for custom (and only once both are chosen).
  const customReady = period === 'custom' && from && to;
  const rep = useApi(
    () => api.getReport(period === 'custom'
      ? (customReady ? { period, from, to } : { period: 'this_month' })
      : { period }),
    [period, customReady ? from : '', customReady ? to : '']
  );

  // Salary status (current month only) — surfaced so the income figure is
  // clearly attributed. Loaded independently; never blocks the report.
  const salary = useApi(api.getSalaryStatus, []);

  if (rep.loading && !rep.data) return <ReportsSkeleton />;
  if (rep.error) return <ErrorState error={rep.error} onRetry={rep.refetch} />;

  const d = rep.data || {};
  const sum = d.summary || { spent: 0, received: 0, net: 0, count: 0, spendDeltaPct: 0 };
  const byCategory = d.byCategory || [];
  const topMerchants = d.topMerchants || [];
  const trend = d.trend || [];
  const byAccount = d.byAccount || [];
  const periodLabel = d.period?.label || 'This month';

  // Donut shows the top 6 categories; the rest fold into a grey "Other" slice.
  const TOP = 6;
  const donutSlices = byCategory.slice(0, TOP);
  const restPct = byCategory.slice(TOP).reduce((s, c) => s + c.pct, 0);
  const slices = restPct > 0 ? [...donutSlices, { color: '#cfc7da', pct: restPct }] : donutSlices;

  const trendMax = Math.max(1, ...trend.map((t) => t.amount));
  const up = sum.spendDeltaPct >= 0;
  const empty = sum.count === 0;

  const chip = (active) => ({
    flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12,
    padding: '8px 14px', borderRadius: 18, transition: 'all .15s',
    ...(active ? { background: '#2a2733', color: '#fff', border: '1.5px solid #2a2733' } : { background: '#fff', color: '#5a5366', border: '1.5px solid #eee6f3' }),
  });

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      {/* header + back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 4px 14px' }}>
        {onBack && (
          <div onClick={onBack} style={{ width: 34, height: 34, borderRadius: 12, background: '#fff', border: '1.5px solid #f1ecf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: COLOR.ink }}>‹</div>
        )}
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 25, color: COLOR.ink, letterSpacing: '-.6px' }}>Reports 📊</div>
      </div>

      {/* period selector */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -18px 4px', padding: '2px 18px 8px' }}>
        {PERIODS.map(([k, l]) => (<div key={k} onClick={() => setPeriod(k)} style={chip(period === k)}>{l}</div>))}
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, margin: '0 2px 5px', letterSpacing: '.4px' }}>FROM</div>
            <input type="date" value={from} max={to || todayInput()} onChange={(e) => setFrom(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.ink, outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, margin: '0 2px 5px', letterSpacing: '.4px' }}>TO</div>
            <input type="date" value={to} min={from} max={todayInput()} onChange={(e) => setTo(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.ink, outline: 'none' }} />
          </div>
        </div>
      )}

      {/* headline summary */}
      <div style={{ borderRadius: 26, padding: 22, ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, letterSpacing: '.6px' }}>SPENT · {periodLabel.toUpperCase()}</span>
          {!empty && (
            <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 11.5, padding: '4px 10px', borderRadius: 12, background: up ? '#FEECEC' : '#EAF7EF', color: up ? '#d6483b' : '#1FAE63' }}>
              {up ? '▲' : '▼'} {Math.abs(sum.spendDeltaPct)}% vs prev
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 34, color: COLOR.ink, marginTop: 6, letterSpacing: '-.8px' }}>{inr(sum.spent)}</div>
        <div style={{ display: 'flex', gap: 11, marginTop: 16 }}>
          <div style={{ flex: 1, borderRadius: 16, padding: '11px 13px', background: 'linear-gradient(135deg,#E9FBF3,#D3F4E4)', border: '1.5px solid #c5efdc' }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: '#1FAE63' }}>💚 Received</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#13795f', marginTop: 3, letterSpacing: '-.3px' }}>{inr(sum.received)}</div>
          </div>
          <div style={{ flex: 1, borderRadius: 16, padding: '11px 13px', background: sum.net >= 0 ? 'linear-gradient(135deg,#FFF6DB,#FFEFC2)' : 'linear-gradient(135deg,#FFEFEC,#FFE0DA)', border: sum.net >= 0 ? '1.5px solid #f3e2ad' : '1.5px solid #ffd3ca' }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: sum.net >= 0 ? '#8a6d12' : '#d6483b' }}>{sum.net >= 0 ? '🎯 Net saved' : '⚠️ Net spent'}</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: sum.net >= 0 ? '#8a6d12' : '#d6483b', marginTop: 3, letterSpacing: '-.3px' }}>{inr(Math.abs(sum.net))}</div>
          </div>
          <div style={{ flex: 1, borderRadius: 16, padding: '11px 13px', background: '#F4ECFF', border: '1.5px solid #e7daf9' }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: '#7a5fc0' }}>🧾 Txns</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#6c4fb0', marginTop: 3, letterSpacing: '-.3px' }}>{sum.count}</div>
          </div>
        </div>
      </div>

      {/* Salary attribution (current month only) */}
      {period === 'this_month' && salary.data?.configured && (
        <div style={{ marginTop: 12, borderRadius: 18, padding: '13px 16px', background: salary.data.credited ? 'linear-gradient(120deg,#E9FBF3,#D6F5E8)' : '#fff', border: `1.5px solid ${salary.data.credited ? '#c5efdc' : '#f1ecf6'}`, display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ fontSize: 18 }}>💼</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>
              {salary.data.credited ? `Salary received · ${inr(salary.data.creditedAmount)}` : `Salary pending · ${inr(salary.data.expectedAmount)}`}
            </div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedSoft, marginTop: 1 }}>
              {salary.data.credited
                ? `Included in income${salary.data.creditedDate ? ` · ${dayMonth(salary.data.creditedDate)}` : ''}`
                : 'Not yet counted in this month’s income'}
            </div>
          </div>
          <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 9.5, letterSpacing: '.3px', padding: '3px 9px', borderRadius: 11, background: salary.data.credited ? '#fff' : '#FFF4DB', color: salary.data.credited ? '#1FAE63' : '#9b7d12' }}>
            {salary.data.credited ? '✅ RECEIVED' : 'PENDING'}
          </span>
        </div>
      )}

      {empty ? (
        <div style={{ ...CARD, borderRadius: 24, padding: '34px 20px', textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 38 }}>🗒️</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, marginTop: 10 }}>No transactions {periodLabel.toLowerCase()}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 5, lineHeight: 1.5 }}>Confirm some transactions or pick another period to see where your money went.</div>
        </div>
      ) : (
        <>
          {/* spending by category — donut + ranked list (tap to expand merchants) */}
          <div style={{ borderRadius: 26, padding: 22, ...CARD, marginTop: 16 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>🍩 Where it went</div>
            {byCategory.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
                <div style={{ position: 'relative', flex: '0 0 auto', width: 120, height: 120, borderRadius: '50%', background: donutGradient(slices) }}>
                  <div style={{ position: 'absolute', inset: 18, background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9, color: COLOR.mutedSoft, letterSpacing: '.5px' }}>SPENT</div>
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: COLOR.ink, letterSpacing: '-.3px' }}>{inrCompact(sum.spent)}</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byCategory.slice(0, 4).map((c) => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: '0 0 auto' }} />
                      <span style={{ flex: 1, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: COLOR.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.emoji} {c.label}</span>
                      <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, color: COLOR.mutedSoft }}>{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
              {byCategory.map((c) => {
                const open = expandedCat === c.key;
                return (
                  <div key={c.key}>
                    <div onClick={() => setExpandedCat(open ? null : c.key)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 10, background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{c.emoji}</div>
                        <span style={{ flex: 1, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{c.label}</span>
                        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13.5, color: COLOR.ink }}>{inr(c.amount)}</span>
                        <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: COLOR.mutedSoft, width: 34, textAlign: 'right' }}>{c.pct}%</span>
                      </div>
                      <div style={{ height: 9, borderRadius: 20, background: '#f2eef7', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(2, c.pct)}%`, height: '100%', borderRadius: 20, background: c.color }} />
                      </div>
                    </div>
                    {open && (
                      <div style={{ marginTop: 10, marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(c.topMerchants || []).length === 0 && (
                          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>No merchant detail</div>
                        )}
                        {(c.topMerchants || []).map((m) => (
                          <div key={m.merchant} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ flex: 1, fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.merchant} <span style={{ color: COLOR.mutedFaint }}>· {m.count}×</span></span>
                            <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12, color: COLOR.ink }}>{inr(m.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* spending trend */}
          {trend.length > 0 && (
            <div style={{ borderRadius: 26, padding: 22, ...CARD, marginTop: 16 }}>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>📈 Spending over time</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: trend.length > 16 ? 2 : 6, height: 120, marginTop: 18 }}>
                {trend.map((t) => (
                  <div key={t.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <div title={inr(t.amount)} style={{ width: '100%', maxWidth: 22, height: `${Math.max(3, (t.amount / trendMax) * 92)}px`, borderRadius: 6, background: 'linear-gradient(180deg,#C8A2FF,#A78BFA)' }} />
                    {(trend.length <= 16 || Number(t.label) % 5 === 0) && (
                      <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 8.5, color: COLOR.mutedSoft }}>{t.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* top merchants */}
          {topMerchants.length > 0 && (
            <>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, margin: '24px 4px 13px', letterSpacing: '-.2px' }}>🏷️ Top merchants</div>
              <div style={{ ...CARD, borderRadius: 24, overflow: 'hidden' }}>
                {topMerchants.map((m, i) => (
                  <div key={m.merchant} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 17px', borderBottom: i < topMerchants.length - 1 ? '1.5px solid #f6f2fa' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 10, background: '#F4ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 12, color: '#7a5fc0' }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.merchant}</div>
                      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{m.count} transaction{m.count > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, color: COLOR.ink, letterSpacing: '-.3px' }}>{inr(m.amount)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* by account / bank */}
          {byAccount.length > 0 && (
            <>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, margin: '24px 4px 13px', letterSpacing: '-.2px' }}>🏦 Spent by account</div>
              <div style={{ ...CARD, borderRadius: 24, padding: '6px 17px 10px' }}>
                {byAccount.map((a) => (
                  <div key={a.accountId || 'unlinked'} style={{ padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 9, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 11, color: '#fff' }}>{a.logo}</div>
                      <span style={{ flex: 1, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>{a.name}</span>
                      <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, color: COLOR.ink }}>{inr(a.amount)}</span>
                      <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: COLOR.mutedSoft, width: 34, textAlign: 'right' }}>{a.pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 20, background: '#f2eef7', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(2, a.pct)}%`, height: '100%', borderRadius: 20, background: a.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* income vs expense */}
          <div style={{ borderRadius: 26, padding: 22, ...CARD, marginTop: 22 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>💚 Income vs 🧡 Expense</div>
            {(() => {
              const inc = d.incomeVsExpense?.income || 0;
              const exp = d.incomeVsExpense?.expense || 0;
              const mx = Math.max(1, inc, exp);
              return (
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>Income</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#16a34a' }}>{inr(inc)}</span></div>
                    <div style={{ height: 14, borderRadius: 20, background: '#eef7f0', overflow: 'hidden' }}><div style={{ width: `${(inc / mx) * 100}%`, height: '100%', borderRadius: 20, background: 'linear-gradient(90deg,#2BC4B0,#34D39E)' }} /></div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>Expense</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#FF6B5E' }}>{inr(exp)}</span></div>
                    <div style={{ height: 14, borderRadius: 20, background: '#fdeeec', overflow: 'hidden' }}><div style={{ width: `${(exp / mx) * 100}%`, height: '100%', borderRadius: 20, background: 'linear-gradient(90deg,#FF8A7A,#FF6B5E)' }} /></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
