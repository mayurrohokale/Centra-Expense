'use client';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { inr } from '../../common/lib/format.js';
import { Skeleton } from '../../common/ui/Skeleton.jsx';

/**
 * Home loans/debts summary card → opens the full Loans view (onOpen). Shows the
 * two headline totals (You owe / Owed to you). Hidden-content states: skeleton
 * while loading; a gentle "track a loan" prompt when there are none.
 */
export default function LoanCard({ onOpen }) {
  const { data, loading } = useApi(api.getLoans, []);
  const totals = data?.totals || { youOwe: 0, owedToYou: 0 };
  const count = (data?.loans || []).filter((l) => l.status === 'open').length;

  if (loading && !data) {
    return (
      <div style={{ marginTop: 16, borderRadius: 22, padding: '16px 18px', background: '#fff', border: '1.5px solid #f1ecf6' }}>
        <Skeleton w="40%" h={12} r={7} />
        <div style={{ marginTop: 12, display: 'flex', gap: 11 }}>
          <Skeleton h={44} r={14} style={{ flex: 1 }} /><Skeleton h={44} r={14} style={{ flex: 1 }} />
        </div>
      </div>
    );
  }

  // No loans → gentle prompt.
  if (!data || (data.loans || []).length === 0) {
    return (
      <div onClick={onOpen} style={{ marginTop: 16, borderRadius: 22, padding: '15px 16px', background: 'linear-gradient(120deg,#EFF6FF,#E0F2FE)', border: '1.5px dashed #bae0fb', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🤝</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: '#0b5cad' }}>Loans & debts</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: '#3a7bbf' }}>Track money you borrowed or lent to people</div>
        </div>
        <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 13, color: '#0EA5E9' }}>Track ›</span>
      </div>
    );
  }

  return (
    <div onClick={onOpen} style={{ marginTop: 16, borderRadius: 22, padding: '15px 17px', background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.06)', border: '1.5px solid #f1ecf6', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11, color: COLOR.mutedSoft, letterSpacing: '.6px' }}>🤝 LOANS & DEBTS</span>
        <span style={{ marginLeft: 'auto', fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.purple }}>{count} active ›</span>
      </div>
      <div style={{ display: 'flex', gap: 11 }}>
        <div style={{ flex: 1, borderRadius: 14, padding: '10px 13px', background: 'linear-gradient(135deg,#FFEFEC,#FFE0DA)' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: '#d6483b' }}>🫳 You owe</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 17, color: '#d6483b', marginTop: 2, letterSpacing: '-.3px' }}>{inr(totals.youOwe)}</div>
        </div>
        <div style={{ flex: 1, borderRadius: 14, padding: '10px 13px', background: 'linear-gradient(135deg,#E9FBF3,#D3F4E4)' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10, color: '#1FAE63' }}>🫴 Owed to you</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 17, color: '#13795f', marginTop: 2, letterSpacing: '-.3px' }}>{inr(totals.owedToYou)}</div>
        </div>
      </div>
    </div>
  );
}
