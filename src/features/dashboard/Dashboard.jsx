'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONT, COLOR, GRADIENT, CARD } from '../../common/theme/tokens.js';
import { inr, inrCompact } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { DashboardSkeleton } from '../../common/ui/Skeleton.jsx';
import TxnSheet from '../transactions/TxnSheet.jsx';
import CashSheet from '../transactions/CashSheet.jsx';
import AccountEditSheet from './AccountEditSheet.jsx';

const INVEST_COLORS = { mutual_fund: '#2BC4B0', crypto: '#A78BFA', fd: '#FFC247' };

// How a bank balance was last set — shown as a small badge on the account card.
const BALANCE_SOURCE = {
  email: { emoji: '📧', label: 'Synced', color: '#1FAE63', bg: '#EAF7EF' },
  computed: { emoji: '🧮', label: 'Auto', color: '#7a5fc0', bg: '#F2ECFC' },
  manual: { emoji: '✍️', label: 'Manual', color: '#9b7d12', bg: '#FFF4DB' },
};

function relTime(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function conicFromAllocation(alloc) {
  // Order matches the design donut: MF → Crypto → FD.
  const order = ['mutual_fund', 'crypto', 'fd'];
  let acc = 0;
  const stops = order.map((k) => {
    const start = acc * 3.6;
    acc += alloc[k] || 0;
    const end = acc * 3.6;
    return `${INVEST_COLORS[k]} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${stops.join(',')})`;
}

export default function Dashboard({ onTab }) {
  const { openProfile } = useAuth();
  const me = useApi(api.getMe, []);
  const accounts = useApi(api.getAccounts, []);
  const portfolio = useApi(api.getPortfolio, []);
  const summary = useApi(api.getSummary, []);

  const [expanded, setExpanded] = useState(null);
  const [txnSheet, setTxnSheet] = useState(null); // null | 'expense' | 'income'
  const [cashOpen, setCashOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);

  const loading = me.loading || accounts.loading || portfolio.loading || summary.loading;
  const error = me.error || accounts.error || portfolio.error || summary.error;
  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => { me.refetch(); accounts.refetch(); portfolio.refetch(); summary.refetch(); }} />;

  const refreshAccounts = () => { accounts.refetch(); summary.refetch(); };

  const banks = (accounts.data || []).filter((a) => a.type === 'bank');
  const cash = (accounts.data || []).find((a) => a.type === 'cash');
  const bankTotal = banks.reduce((s, b) => s + b.balance, 0);
  const cashBalance = cash?.balance || 0;
  // Overall total now INCLUDES cash on hand (shown distinctly below).
  const totalBalance = bankTotal + cashBalance;
  const port = portfolio.data || { current: 0, invested: 0, allocation: {} };
  const netWorth = bankTotal + cashBalance + port.current;
  const sum = summary.data || { income: 0, expenses: 0, savings: 0 };
  const firstName = (me.data?.name || 'there').split(' ')[0];
  const spendPct = sum.income > 0 ? Math.min(100, Math.round((sum.expenses / sum.income) * 100)) : 0;

  // Zero-state flags: a brand-new user has no banks / no holdings. We hide the
  // illustrative trend stats (they aren't real data yet) until there's data.
  const hasBanks = banks.length > 0;
  const hasInvest = port.current > 0;
  const investTypes = ['mutual_fund', 'crypto', 'fd'].filter((k) => (port.allocation?.[k] || 0) > 0).length;
  const skippedSetup = me.data?.onboarding?.skipped === true;

  const invSegs = [
    { key: 'mutual_fund', label: 'Mutual Funds' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'fd', label: 'Fixed Deposits' },
  ];

  const quickActions = [
    { label: 'Add Expense', emoji: '💸', bg: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', shadow: 'rgba(255,107,94,.4)', run: () => setTxnSheet('expense') },
    { label: 'Add Income', emoji: '💰', bg: 'linear-gradient(135deg,#2BC4B0,#34D39E)', shadow: 'rgba(43,196,176,.4)', run: () => setTxnSheet('income') },
    { label: 'Connect Email', emoji: '✉️', bg: 'linear-gradient(135deg,#A78BFA,#C8A2FF)', shadow: 'rgba(167,139,250,.4)', run: () => onTab('email') },
    { label: 'View Reports', emoji: '📊', bg: 'linear-gradient(135deg,#FFB23E,#FF9F1C)', shadow: 'rgba(255,159,28,.4)', run: () => onTab('reports') },
  ];

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      {/* HERO */}
      <div style={{ position: 'relative', borderRadius: 30, padding: '24px 24px 26px', background: GRADIENT.brand, boxShadow: '0 18px 38px rgba(255,111,165,.38)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, color: 'rgba(255,255,255,.96)', fontSize: 16 }}>Hi {firstName} 👋</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 500, color: 'rgba(255,255,255,.8)', fontSize: 12.5, marginTop: 3 }}>here's your money today</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <span style={{ fontFamily: FONT.inter, fontWeight: 700, color: 'rgba(255,255,255,.85)', fontSize: 11, letterSpacing: '.8px' }}>TOTAL BALANCE</span>
            <span style={{ background: 'rgba(255,255,255,.22)', color: '#fff', fontFamily: FONT.jakarta, fontWeight: 600, fontSize: 10.5, padding: '2px 8px', borderRadius: 20 }}>{banks.length} accounts</span>
          </div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, color: '#fff', fontSize: 42, lineHeight: 1.02, marginTop: 6, letterSpacing: '-1.2px', textShadow: '0 4px 14px rgba(120,40,90,.25)' }}>{inr(totalBalance)}</div>
          {cashBalance > 0 && (
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: 'rgba(255,255,255,.82)', marginTop: 4 }}>incl. {inr(cashBalance)} cash</div>
          )}
          {hasBanks || cashBalance > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 20, padding: '4px 11px', fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: '#fff' }}>🏦 {inr(bankTotal)} bank</span>
              {cash && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 20, padding: '4px 11px', fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: '#fff' }}>👛 {inr(cashBalance)} cash</span>
              )}
            </div>
          ) : (
            <div onClick={openProfile} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.95)', color: '#d6483b', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, padding: '9px 15px', borderRadius: 20, cursor: 'pointer' }}>+ Add your first account</div>
          )}
        </div>
      </div>

      {/* Finish-setup nudge for users who skipped onboarding */}
      {skippedSetup && (!hasBanks || !(me.data?.salary?.amount > 0)) && (
        <div onClick={openProfile} style={{ marginTop: 16, borderRadius: 20, padding: '14px 16px', background: 'linear-gradient(120deg,#F8F3FF,#FBF7FF)', border: '1.5px solid #e4d8fb', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>Finish setting up your account</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>Add your accounts and salary in your profile</div>
          </div>
          <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 13, color: COLOR.purple }}>Set up ›</span>
        </div>
      )}

      {/* BANK CARDS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 4px 12px' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Your accounts</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.purple }}>See all</div>
      </div>
      <div style={{ display: 'flex', gap: 13, overflowX: 'auto', padding: '4px 18px 8px', margin: '0 -18px' }}>
        {banks.map((b) => {
          const isOpen = expanded === b._id;
          return (
            <div key={b._id} onClick={() => setExpanded(isOpen ? null : b._id)} style={{ flex: '0 0 auto', width: 165, borderRadius: 24, padding: 16, background: '#fff', boxShadow: '0 10px 24px rgba(90,70,130,.10)', border: '1.5px solid #f1ecf6', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, color: '#fff', fontSize: 16 }}>{b.logo}</div>
                <div>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{b.name}</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 11, color: COLOR.mutedSoft }}>•••• {b.last4}</div>
                </div>
              </div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, marginTop: 14, letterSpacing: '-.5px' }}>{inr(b.balance)}</div>
              {(() => {
                const m = BALANCE_SOURCE[b.balanceSource] || BALANCE_SOURCE.manual;
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 9px', borderRadius: 11, background: m.bg }}>
                    <span style={{ fontSize: 10 }}>{m.emoji}</span>
                    <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9.5, color: m.color }}>{m.label}{b.balanceUpdatedAt ? ` · ${relTime(b.balanceUpdatedAt)}` : ''}</span>
                  </div>
                );
              })()}
              {isOpen ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1.5px dashed #efe9f6', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.muted }}><span>{b.subtype}</span><span style={{ color: COLOR.ink }}>{b.tier}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.muted }}><span>Last activity</span><span style={{ color: COLOR.ink }}>{b.lastActivity}</span></div>
                  <div onClick={(e) => { e.stopPropagation(); setEditAccount(b); }} style={{ marginTop: 4, textAlign: 'center', padding: '7px 0', borderRadius: 11, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, color: '#7a5fc0', cursor: 'pointer' }}>Edit ›</div>
                </div>
              ) : (
                <div style={{ marginTop: 8, fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: b.color }}>Tap for details ›</div>
              )}
            </div>
          );
        })}
        {cash && (
          <div onClick={() => setCashOpen(true)} style={{ flex: '0 0 auto', width: 165, borderRadius: 24, padding: 16, background: GRADIENT.cash, boxShadow: '0 10px 24px rgba(31,174,99,.30)', cursor: 'pointer', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -22, right: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👛</div>
                <div>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14 }}>Cash</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: 'rgba(255,255,255,.85)' }}>in hand</div>
                </div>
              </div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, marginTop: 14, letterSpacing: '-.5px' }}>{inr(cash.balance)}</div>
              <div style={{ marginTop: 8, fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.9)' }}>Spent {inr(cash.spentThisMonth)} · Edit ›</div>
            </div>
          </div>
        )}
      </div>

      {/* INVESTED BALANCE + DONUT — shown once there are holdings */}
      {hasInvest && (
      <div style={{ marginTop: 20, borderRadius: 28, padding: 22, ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>💎 Invested balance</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: COLOR.mutedSoft }}>{investTypes} {investTypes === 1 ? 'type' : 'types'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
          <div style={{ position: 'relative', flex: '0 0 auto', width: 128, height: 128, borderRadius: '50%', background: conicFromAllocation(port.allocation || {}) }}>
            <div style={{ position: 'absolute', inset: 19, background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: COLOR.mutedSoft, letterSpacing: '.5px' }}>TOTAL</div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>{inrCompact(port.current)}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
            {invSegs.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 11, height: 11, borderRadius: 4, background: INVEST_COLORS[s.key] }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: COLOR.ink }}>{s.label}</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{(port.allocation?.[s.key] || 0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* NET WORTH STRIP — shown once there's a balance or holdings */}
      {netWorth > 0 && (
      <div style={{ marginTop: 16, borderRadius: 26, padding: '20px 22px', background: GRADIENT.teal, boxShadow: '0 14px 30px rgba(43,196,176,.30)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.92)', letterSpacing: '.8px' }}>NET WORTH</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 31, color: '#fff', marginTop: 3, letterSpacing: '-.8px' }}>{inr(netWorth)}</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: 'rgba(255,255,255,.94)', marginTop: 4 }}>bank + investments</div>
          </div>
          {hasInvest && (
            <svg width="84" height="50" viewBox="0 0 84 50" fill="none" style={{ opacity: 0.95 }}>
              <polyline points="2,42 16,34 30,38 44,24 58,28 72,10 82,4" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="82" cy="4" r="4" fill="#fff" />
            </svg>
          )}
        </div>
      </div>
      )}

      {/* THIS MONTH */}
      <div style={{ marginTop: 16, borderRadius: 28, padding: 22, ...CARD }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>📅 This month</div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>💚 Income</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#16a34a' }}>{inr(sum.income)}</span></div>
            <div style={{ height: 14, borderRadius: 20, background: '#eef7f0', overflow: 'hidden' }}><div style={{ width: '100%', height: '100%', borderRadius: 20, background: 'linear-gradient(90deg,#2BC4B0,#34D39E)' }} /></div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>🧡 Spending</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#FF6B5E' }}>{inr(sum.expenses)}</span></div>
            <div style={{ height: 14, borderRadius: 20, background: '#fdeeec', overflow: 'hidden' }}><div style={{ width: `${spendPct}%`, height: '100%', borderRadius: 20, background: 'linear-gradient(90deg,#FF8A7A,#FF6B5E)' }} /></div>
          </div>
        </div>
        <div style={{ marginTop: 18, background: 'linear-gradient(120deg,#FFF6DB,#FFEFC2)', borderRadius: 18, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: '#8a6d12' }}>You're saving {inr(sum.savings)} this month!</span>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 18, color: COLOR.ink, margin: '0 4px 14px', letterSpacing: '-.3px' }}>Quick actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {quickActions.map((qa) => (
            <div key={qa.label} onClick={qa.run} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{ width: 58, height: 58, borderRadius: 20, background: qa.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: `0 8px 18px ${qa.shadow}` }}>{qa.emoji}</div>
              <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: '#5a5366', textAlign: 'center', lineHeight: 1.2 }}>{qa.label}</div>
            </div>
          ))}
        </div>
      </div>

      <TxnSheet
        open={!!txnSheet}
        initialMode={txnSheet || 'expense'}
        accounts={accounts.data || []}
        onClose={() => setTxnSheet(null)}
        onDone={() => { setTxnSheet(null); refreshAccounts(); }}
      />
      <CashSheet open={cashOpen} onClose={() => setCashOpen(false)} cash={cash} onDone={() => { setCashOpen(false); refreshAccounts(); }} />
      <AccountEditSheet open={!!editAccount} account={editAccount} onClose={() => setEditAccount(null)} onDone={refreshAccounts} />
    </div>
  );
}
