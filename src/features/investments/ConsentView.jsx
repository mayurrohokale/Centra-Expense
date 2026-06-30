'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';

const SCOPES = [
  { icon: '📊', bg: '#F4ECFF', title: 'Mutual Fund holdings', sub: 'Folios, units & current NAV' },
  { icon: '🏦', bg: '#E7F3FF', title: 'Deposits & FDs', sub: 'Balances, tenure & maturity' },
  { icon: '📈', bg: '#FFF1E6', title: 'Equities & ETFs', sub: 'Demat holdings & valuations' },
];
const TERMS = [
  { k: 'Purpose', v: 'Portfolio tracking' },
  { k: 'Data refresh', v: 'Daily' },
  { k: 'Consent valid for', v: '1 year' },
  { k: 'After expiry', v: 'Auto-revoked' },
];

// Account Aggregator consent handshake — "Powered by Finvu AA".
export default function ConsentView({ onDone }) {
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      await api.upsertConnection({
        kind: 'aa_finvu',
        label: 'Finvu AA · Investments',
        provider: 'Finvu AA',
        scopes: ['mutual_funds:read', 'deposits:read', 'equities:read'],
        // M1: real AA data fetch deferred; stub consent token shows encrypted-at-rest storage.
        tokens: { consent_id: 'stub-consent', data_session: 'stub-session' },
        consentExpiresAt: expires.toISOString(),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 18px' }}>
        <div onClick={onDone} style={{ width: 38, height: 38, borderRadius: 13, background: '#fff', border: '1.5px solid #f1ecf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, cursor: 'pointer' }}>‹</div>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: COLOR.ink, letterSpacing: '-.4px' }}>Link via Account Aggregator</div>
      </div>

      <div style={{ borderRadius: 26, padding: 22, background: 'linear-gradient(150deg,#EEE7FF,#F6EEFF)', border: '1.5px solid #e4d8fb', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: '#6C5CE7', boxShadow: '0 6px 14px rgba(108,92,231,.18)' }}>C</div>
          <div style={{ fontSize: 20, color: '#A78BFA' }}>⇄</div>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 6px 14px rgba(108,92,231,.18)' }}>🏦</div>
        </div>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, marginTop: 16 }}>Centra Expense requests access</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.muted, marginTop: 6, lineHeight: 1.5 }}>Securely fetch your investment holdings through your RBI-licensed Account Aggregator. We never see your login or password.</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 13, padding: '6px 12px', borderRadius: 14, background: '#fff' }}><span style={{ fontSize: 12 }}>🔐</span><span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: '#6C5CE7' }}>Powered by Finvu AA</span></div>
      </div>

      <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 12, color: COLOR.mutedSoft, letterSpacing: '.6px', margin: '22px 4px 11px' }}>WHAT WE'LL ACCESS</div>
      <div style={{ borderRadius: 22, background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6', overflow: 'hidden' }}>
        {SCOPES.map((cs) => (
          <div key={cs.title} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: '1.5px solid #f6f2fa' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: cs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cs.icon}</div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{cs.title}</div><div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{cs.sub}</div></div>
            <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, padding: '4px 9px', borderRadius: 11, background: '#EEF7F1', color: '#1FAE63' }}>Read-only</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, borderRadius: 22, background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6', padding: '6px 16px' }}>
        {TERMS.map((ct) => (
          <div key={ct.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1.5px solid #f6f2fa' }}>
            <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.muted }}>{ct.k}</span>
            <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: COLOR.ink }}>{ct.v}</span>
          </div>
        ))}
      </div>

      <div onClick={busy ? undefined : approve} style={{ marginTop: 20, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', boxShadow: '0 12px 26px rgba(108,92,231,.4)', opacity: busy ? 0.7 : 1 }}>
        <span style={{ fontSize: 16 }}>✅</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff' }}>{busy ? 'Connecting…' : 'Approve & Connect'}</span>
      </div>
      <div onClick={onDone} style={{ marginTop: 10, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 8, cursor: 'pointer' }}>Cancel</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: COLOR.mutedFaint, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>You can revoke this consent anytime from Settings. Regulated by RBI under the NBFC-AA framework.</div>
    </div>
  );
}
