'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR, CARD } from '../../common/theme/tokens.js';
import { inr, dayMonth } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { SkeletonRows } from '../../common/ui/Skeleton.jsx';
import Sheet from '../../common/ui/Sheet.jsx';
import AddLoanSheet from './AddLoanSheet.jsx';
import RepaySheet from './RepaySheet.jsx';

const pctSettled = (l) => Math.min(100, Math.round(((l.principal - l.outstanding) / l.principal) * 100));

/**
 * Loans / debts tracker — a focused view reached from a Home card (mirrors how
 * Reports is reached). Shows "You owe" / "Owed to you" totals, an Add-loan sheet,
 * and the loan list with a balance-guarded "Record repayment" action.
 */
export default function Loans({ onBack }) {
  const loans = useApi(api.getLoans, []);
  const [addOpen, setAddOpen] = useState(false);
  const [repayTarget, setRepayTarget] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => { await loans.refetch(); };

  const data = loans.data || { loans: [], totals: { youOwe: 0, owedToYou: 0 } };
  const list = data.loans || [];
  const totals = data.totals || { youOwe: 0, owedToYou: 0 };
  const openLoans = list.filter((l) => l.status === 'open');
  const settledLoans = list.filter((l) => l.status === 'settled');

  async function confirmDelete() {
    if (!delTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteLoan(delTarget._id);
      setDelTarget(null);
      await refresh();
    } catch { /* keep modal open */ } finally { setDeleting(false); }
  }

  function loanCard(l) {
    const borrowed = l.direction === 'borrowed';
    const settled = l.status === 'settled';
    const accent = borrowed ? '#FF6B5E' : '#1FAE63';
    const pct = pctSettled(l);
    return (
      <div key={l._id} style={{ borderRadius: 22, padding: '15px 17px', background: settled ? '#F7FBF8' : '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.06)', border: `1.5px solid ${settled ? '#d8efe1' : '#f1ecf6'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: borrowed ? '#FFEDE9' : '#EAF7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{borrowed ? '🫳' : '🫴'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14.5, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.counterpartyName}</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: borrowed ? '#d6483b' : '#13795f' }}>
              {borrowed ? 'You owe' : 'Owes you'}{l.startDate ? ` · since ${dayMonth(l.startDate)}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {settled ? (
              <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 10, letterSpacing: '.3px', padding: '3px 9px', borderRadius: 11, background: '#EAF7EF', color: '#1FAE63' }}>✓ SETTLED</span>
            ) : (
              <>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: accent, letterSpacing: '-.3px' }}>{inr(l.outstanding)}</div>
                <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10, color: COLOR.mutedSoft }}>of {inr(l.principal)}</div>
              </>
            )}
          </div>
        </div>
        {/* progress (repaid) */}
        <div style={{ height: 8, borderRadius: 20, background: '#f1ecf6', marginTop: 12, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 20, background: accent, transition: 'width .25s' }} />
        </div>
        {l.note ? <div style={{ marginTop: 9, fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>📝 {l.note}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 }}>
          {!settled && (
            <div onClick={() => setRepayTarget(l)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 13, background: accent, fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#fff', cursor: 'pointer' }}>
              {borrowed ? '↑ Record repayment' : '↓ Record received'}
            </div>
          )}
          <div onClick={() => setDelTarget(l)} style={{ padding: '10px 14px', borderRadius: 13, background: '#fff5f4', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: COLOR.expense, cursor: 'pointer' }}>Delete</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '4px 0 16px' }}>
        <div onClick={onBack} style={{ width: 34, height: 34, borderRadius: 12, background: '#fff', border: '1.5px solid #f1ecf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: COLOR.ink }}>‹</div>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 25, color: COLOR.ink, letterSpacing: '-.6px' }}>Loans & debts 🤝</div>
      </div>

      {/* two totals */}
      <div style={{ display: 'flex', gap: 11 }}>
        <div style={{ flex: 1, borderRadius: 20, padding: '15px 16px', background: 'linear-gradient(135deg,#FFEFEC,#FFE0DA)', border: '1.5px solid #ffd3ca' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: '#d6483b' }}>🫳 You owe</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 21, color: '#d6483b', marginTop: 4, letterSpacing: '-.5px' }}>{inr(totals.youOwe)}</div>
        </div>
        <div style={{ flex: 1, borderRadius: 20, padding: '15px 16px', background: 'linear-gradient(135deg,#E9FBF3,#D3F4E4)', border: '1.5px solid #c5efdc' }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: '#1FAE63' }}>🫴 Owed to you</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 21, color: '#13795f', marginTop: 4, letterSpacing: '-.5px' }}>{inr(totals.owedToYou)}</div>
        </div>
      </div>

      {/* add loan */}
      <div onClick={() => setAddOpen(true)} style={{ marginTop: 14, padding: 14, borderRadius: 18, background: '#2a2733', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', boxShadow: '0 10px 22px rgba(42,39,51,.22)' }}>
        <span style={{ fontSize: 16 }}>＋</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#fff' }}>Add loan</span>
      </div>

      {/* loading / error / empty / list */}
      {loans.loading && !loans.data ? (
        <div style={{ marginTop: 18 }}><SkeletonRows count={3} /></div>
      ) : loans.error ? (
        <div style={{ marginTop: 18 }}><ErrorState error={loans.error} onRetry={refresh} /></div>
      ) : list.length === 0 ? (
        <div style={{ marginTop: 18, borderRadius: 22, padding: '28px 20px', ...CARD, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🤝</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: COLOR.ink, marginTop: 8 }}>No loans tracked yet</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 5, lineHeight: 1.5 }}>Record money you borrowed from or lent to someone — it updates your balance and tracks what's left to settle.</div>
        </div>
      ) : (
        <>
          {openLoans.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: COLOR.mutedSoft, letterSpacing: '.5px', margin: '0 4px 12px' }}>ACTIVE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{openLoans.map(loanCard)}</div>
            </div>
          )}
          {settledLoans.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 4px 12px' }}>
                <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: '#1FAE63', letterSpacing: '.5px' }}>✓ SETTLED</span>
                <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 10.5, color: '#fff', background: '#1FAE63', padding: '1px 8px', borderRadius: 10 }}>{settledLoans.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{settledLoans.map(loanCard)}</div>
            </div>
          )}
        </>
      )}

      <AddLoanSheet open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <RepaySheet open={!!repayTarget} loan={repayTarget} onClose={() => setRepayTarget(null)} onSaved={refresh} />

      {/* delete loan confirm */}
      <Sheet open={!!delTarget} onClose={() => (deleting ? null : setDelTarget(null))}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🗑️</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, marginTop: 10 }}>Delete this loan?</div>
          {delTarget && (
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 6, lineHeight: 1.5 }}>
              {delTarget.direction === 'borrowed' ? `Loan from ${delTarget.counterpartyName}` : `Loan to ${delTarget.counterpartyName}`} · {inr(delTarget.principal)}.
              <br />This reverses its balance effect (and any repayments) on your accounts.
            </div>
          )}
        </div>
        <div onClick={deleting ? undefined : confirmDelete} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>{deleting ? 'Deleting…' : 'Delete loan'}</div>
        <div onClick={() => (deleting ? null : setDelTarget(null))} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
      </Sheet>
    </div>
  );
}
