'use client';
import { useMemo, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONT, COLOR, CARD } from '../../common/theme/tokens.js';
import { inr, signedInr, nextPayDate, dayMonth } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { TransactionsSkeleton } from '../../common/ui/Skeleton.jsx';
import SourceBadge from '../../common/ui/SourceBadge.jsx';
import Sheet from '../../common/ui/Sheet.jsx';
import CategoryBars from './CategoryBars.jsx';
import CashSheet from './CashSheet.jsx';
import TxnSheet from './TxnSheet.jsx';
import CategoryPickerSheet from './CategoryPickerSheet.jsx';

const SEGMENTS = [['all', 'All'], ['in', 'Income'], ['out', 'Expenses']];
const SOURCE_CHIPS = [['all', 'All sources'], ['email', '📧 Email'], ['aa_sync', '🏦 Sync'], ['cash', '💵 Cash'], ['manual', '✍️ Manual']];

function groupByDate(txns) {
  const groups = [];
  const idx = new Map();
  for (const t of txns) {
    const label = t.dateLabel || new Date(t.occurredAt).toDateString();
    if (!idx.has(label)) { idx.set(label, groups.length); groups.push({ date: label, items: [] }); }
    groups[idx.get(label)].items.push(t);
  }
  return groups;
}

export default function Transactions() {
  const { user, openProfile } = useAuth();
  const [segment, setSegment] = useState('all');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [cashOpen, setCashOpen] = useState(false);
  const [txnSheet, setTxnSheet] = useState(null); // null | 'expense' | 'income'
  const [picker, setPicker] = useState(null); // { txn, confirmOnPick }
  const [delId, setDelId] = useState(''); // draft id pending inline delete confirm
  const [delTxn, setDelTxn] = useState(null); // confirmed txn pending modal delete confirm
  const [deleting, setDeleting] = useState(false);
  const [recurringOnly, setRecurringOnly] = useState(false); // "Monthly bills" filter

  const summary = useApi(api.getSummary, []);
  const review = useApi(api.getNeedsReview, []);
  const cats = useApi(api.getCategoryBreakdown, []);
  const accounts = useApi(api.getAccounts, []);
  const txns = useApi(
    () => api.getTransactions({ segment, source, q: search.trim() || undefined }),
    [segment, source, search]
  );

  const visibleTxns = useMemo(
    () => (recurringOnly ? (txns.data || []).filter((t) => t.recurring) : (txns.data || [])),
    [txns.data, recurringOnly]
  );
  const groups = useMemo(() => groupByDate(visibleTxns), [visibleTxns]);

  const loading = summary.loading || review.loading || accounts.loading;
  const error = summary.error || review.error || accounts.error || txns.error;
  if (loading && !summary.data) return <TransactionsSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => { summary.refetch(); review.refetch(); txns.refetch(); accounts.refetch(); cats.refetch(); }} />;

  const sum = summary.data || { income: 0, expenses: 0, savings: 0 };
  const cash = (accounts.data || []).find((a) => a.type === 'cash');

  // Upcoming-salary card is driven by the user's profile salary setting.
  const salary = user?.salary;
  const hasSalary = salary?.amount > 0 && salary?.payDay;
  const salaryDate = hasSalary ? nextPayDate(salary.payDay) : null;
  const salaryBank = (accounts.data || []).find((a) => a.type === 'bank');

  const refreshAll = () => { summary.refetch(); review.refetch(); txns.refetch(); accounts.refetch(); cats.refetch(); };

  async function confirm(id) {
    await api.confirmTransaction(id);
    refreshAll();
  }

  // Delete a DRAFT (drafts never moved the balance). Lightweight inline confirm.
  async function deleteDraft(id) {
    try { await api.deleteTransaction(id); }
    finally { setDelId(''); refreshAll(); }
  }

  // Delete a CONFIRMED transaction (gated by the modal). The server reverses the
  // balance effect, so we refetch transactions AND accounts after.
  async function deleteConfirmed() {
    if (!delTxn || deleting) return;
    setDeleting(true);
    try {
      await api.deleteTransaction(delTxn._id);
      setDelTxn(null);
      refreshAll();
    } catch { /* keep modal open on failure */ } finally { setDeleting(false); }
  }

  // Phrase the balance-reversal effect for the confirmation modal. A draft never
  // moved a balance, so deleting it has no reversal effect.
  function reversalNote(tx) {
    if (!tx) return '';
    if (tx.status !== 'confirmed' || !tx.balanceApplied) {
      return 'This draft hasn’t affected any balance yet.';
    }
    if (tx.direction === 'transfer') {
      return `This will undo the transfer — refund ${inr(tx.amount)} to ${tx.accountName || 'the source'} and remove it from ${tx.toAccountName || 'the destination'}.`;
    }
    const where = tx.accountName || 'the account';
    return tx.direction === 'debit'
      ? `This will add ${inr(tx.amount)} back to ${where}.`
      : `This will subtract ${inr(tx.amount)} from ${where}.`;
  }
  // Amount label for the delete modal (transfers are neutral, not signed).
  const delAmountLabel = (tx) => (tx?.direction === 'transfer' ? inr(tx.amount) : signedInr(tx?.amount || 0, tx?.direction));

  const segStyle = (active) => ({
    flex: 1, textAlign: 'center', padding: 9, borderRadius: 13, cursor: 'pointer',
    fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, transition: 'all .15s',
    ...(active ? { background: '#fff', color: COLOR.ink, boxShadow: '0 4px 10px rgba(90,70,130,.12)' } : { background: 'transparent', color: COLOR.mutedSoft }),
  });
  const chipStyle = (active) => ({
    flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12,
    padding: '8px 14px', borderRadius: 18, transition: 'all .15s',
    ...(active ? { background: '#2a2733', color: '#fff', border: '1.5px solid #2a2733' } : { background: '#fff', color: '#5a5366', border: '1.5px solid #eee6f3' }),
  });

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 25, color: COLOR.ink, margin: '6px 4px 16px', letterSpacing: '-.6px' }}>Transactions 💳</div>

      {/* in / out overview */}
      <div style={{ borderRadius: 26, padding: 20, ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>June</span>
          <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: COLOR.mutedSoft }}>▾ this month</span>
        </div>
        <div style={{ display: 'flex', gap: 11 }}>
          <div style={{ flex: 1, borderRadius: 18, padding: '13px 14px', background: 'linear-gradient(135deg,#E9FBF3,#D3F4E4)', border: '1.5px solid #c5efdc' }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: '#1FAE63' }}>💚 Money in</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: '#13795f', marginTop: 4, letterSpacing: '-.5px' }}>{inr(sum.income)}</div>
          </div>
          <div style={{ flex: 1, borderRadius: 18, padding: '13px 14px', background: 'linear-gradient(135deg,#FFEFEC,#FFE0DA)', border: '1.5px solid #ffd3ca' }}>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: '#FF6B5E' }}>🧡 Money out</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 19, color: '#d6483b', marginTop: 4, letterSpacing: '-.5px' }}>{inr(sum.expenses)}</div>
          </div>
        </div>
        <div style={{ marginTop: 13, background: 'linear-gradient(120deg,#FFF6DB,#FFEFC2)', borderRadius: 14, padding: '10px 13px', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#8a6d12' }}>Net +{inr(sum.savings)} this month 🎉</div>
      </div>

      {/* quick add row */}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div onClick={() => setTxnSheet('expense')} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 16, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', boxShadow: '0 8px 18px rgba(255,107,94,.28)' }}>💸 Expense</div>
        <div onClick={() => setTxnSheet('income')} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 16, background: 'linear-gradient(135deg,#34D39E,#1FAE63)', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', boxShadow: '0 8px 18px rgba(31,174,99,.28)' }}>💰 Income</div>
        <div onClick={() => setCashOpen(true)} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 16, background: '#fff', border: '1.5px solid #f1ecf6', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.ink, cursor: 'pointer' }}>👛 Cash</div>
        <div onClick={() => setTxnSheet('transfer')} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 16, background: '#fff', border: '1.5px solid #f1ecf6', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: COLOR.ink, cursor: 'pointer' }}>🔁 Transfer</div>
      </div>

      {/* search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: '12px 15px', borderRadius: 18, background: '#fff', border: '1.5px solid #f1ecf6', boxShadow: '0 8px 18px rgba(90,70,130,.05)' }}>
        <span style={{ fontSize: 15 }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchant or category" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.ink }} />
      </div>

      {/* segment */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, background: '#f2eef7', borderRadius: 16, padding: 4 }}>
        {SEGMENTS.map(([k, l]) => (<div key={k} onClick={() => setSegment(k)} style={segStyle(segment === k)}>{l}</div>))}
      </div>

      {/* source chips + monthly-recurring filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '13px -18px 2px', padding: '2px 18px 6px' }}>
        {SOURCE_CHIPS.map(([k, l]) => (<div key={k} onClick={() => setSource(k)} style={chipStyle(source === k)}>{l}</div>))}
        <div onClick={() => setRecurringOnly((v) => !v)} style={chipStyle(recurringOnly)}>🔁 Monthly bills</div>
      </div>

      {/* upcoming salary — driven by the user's profile salary setting */}
      {hasSalary ? (
        <div style={{ marginTop: 10, borderRadius: 20, padding: '14px 16px', background: 'linear-gradient(120deg,#E9FBF3,#D6F5E8)', border: '1.5px solid #c5efdc', display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#2BC4B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>💼</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: '#13795f' }}>Upcoming · Salary {dayMonth(salaryDate)}</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: '#3a8a74' }}>
              {salaryBank ? `Credit to ${salaryBank.name}${salaryBank.last4 ? ` •••• ${salaryBank.last4}` : ''}` : 'Monthly salary credit'}
            </div>
          </div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: '#13795f', letterSpacing: '-.3px' }}>{inr(salary.amount)}</div>
        </div>
      ) : (
        <div onClick={openProfile} style={{ marginTop: 10, borderRadius: 20, padding: '14px 16px', background: '#fff', border: '1.5px dashed #cdbff0', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#F1EEF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>💼</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>Set up your salary</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>Add it in your profile to see upcoming pay</div>
          </div>
          <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 13, color: COLOR.purple }}>Set up ›</span>
        </div>
      )}

      {/* needs review */}
      {(review.data || []).length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '24px 4px 11px' }}>
            <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 12, color: '#8b5cf6', letterSpacing: '.6px' }}>NEEDS REVIEW</span>
            <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 10.5, color: '#fff', background: '#A78BFA', padding: '1px 8px', borderRadius: 10 }}>{review.data.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {review.data.map((r) => (
              <div key={r._id} style={{ borderRadius: 22, padding: '15px 17px', background: 'linear-gradient(150deg,#F8F3FF,#FBF7FF)', border: '1.5px solid #e4d8fb', boxShadow: '0 8px 20px rgba(167,139,250,.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: r.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{r.icon}</div>
                  <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{r.merchant}</div><div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: '#8b5cf6', marginTop: 1 }}>{r.direction === 'transfer' ? `🔁 transfer · ${r.dateLabel}` : r.source === 'email' ? `📧 from ${r.accountName} email · ${r.dateLabel}` : `✍️ ${r.accountName || 'manual'} · ${r.dateLabel}`}</div></div>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: r.direction === 'transfer' ? COLOR.ink : '#FF6B5E', letterSpacing: '-.3px' }}>{r.direction === 'transfer' ? inr(r.amount) : signedInr(r.amount, r.direction)}</div>
                </div>
                {/* Drafts only — delete control + inline confirm (no browser dialog). */}
                {delId === r._id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 }}>
                    <span style={{ flex: 1, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>Delete this draft?</span>
                    <div onClick={() => deleteDraft(r._id)} style={{ padding: '10px 14px', borderRadius: 13, background: '#FF6B5E', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer' }}>Delete</div>
                    <div onClick={() => setDelId('')} style={{ padding: '10px 14px', borderRadius: 13, background: '#f1eef6', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#9b94a8', cursor: 'pointer' }}>Cancel</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 }}>
                    <div onClick={() => confirm(r._id)} style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, background: '#2BC4B0', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer' }}>Confirm</div>
                    <div onClick={() => setPicker({ txn: r, confirmOnPick: true })} style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#A78BFA', cursor: 'pointer' }}>Edit category</div>
                    <div onClick={() => setDelId(r._id)} title="Delete draft" style={{ padding: '10px 12px', textAlign: 'center', borderRadius: 13, background: '#FEECEC', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#d6483b', cursor: 'pointer' }}>🗑</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* grouped list */}
      {groups.map((grp) => (
        <div key={grp.date} style={{ marginTop: 22 }}>
          <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 12, color: COLOR.mutedSoft, letterSpacing: '.6px', margin: '0 4px 10px' }}>{grp.date}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {grp.items.map((tx) => (
              <div key={tx._id} onClick={() => setPicker({ txn: tx, confirmOnPick: false })} style={{ borderRadius: 22, background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.06)', border: '1.5px solid #f1ecf6', padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: tx.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{tx.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.merchant}</span>
                      {tx.recurring && <span title="Monthly recurring" style={{ flexShrink: 0, fontFamily: FONT.inter, fontWeight: 800, fontSize: 9, letterSpacing: '.3px', padding: '2px 7px', borderRadius: 9, background: '#F2ECFC', color: '#7a5fc0' }}>🔁 MONTHLY</span>}
                    </div>
                    <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{tx.direction === 'transfer' ? 'Transfer' : tx.accountName}</div>
                  </div>
                  {tx.direction === 'transfer' ? (
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, letterSpacing: '-.3px' }}>{inr(tx.amount)}</div>
                  ) : (
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: tx.direction === 'credit' ? '#16a34a' : '#FF6B5E', letterSpacing: '-.3px' }}>{signedInr(tx.amount, tx.direction)}</div>
                  )}
                </div>
                <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SourceBadge source={tx.source} accountName={tx.accountName} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: COLOR.mutedFaint }}>Edit ›</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); setDelTxn(tx); }}
                      title="Delete transaction"
                      style={{ fontSize: 14, lineHeight: 1, cursor: 'pointer' }}
                    >🗑</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, marginTop: 10 }}>No transactions found</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 4 }}>Try a different filter or search</div>
        </div>
      )}

      {/* where it went */}
      <CategoryBars data={cats.data || []} />

      {/* FAB → add transaction */}
      <div onClick={() => setTxnSheet('expense')} style={{ position: 'absolute', right: 20, bottom: 110, width: 60, height: 60, borderRadius: 22, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', boxShadow: '0 12px 26px rgba(255,107,94,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 500, fontSize: 34, color: '#fff', zIndex: 30, cursor: 'pointer' }}>+</div>

      <TxnSheet
        open={!!txnSheet}
        initialMode={txnSheet || 'expense'}
        accounts={accounts.data || []}
        onClose={() => setTxnSheet(null)}
        onDone={() => { setTxnSheet(null); refreshAll(); }}
      />
      <CategoryPickerSheet
        open={!!picker}
        txn={picker?.txn}
        confirmOnPick={picker?.confirmOnPick}
        onClose={() => setPicker(null)}
        onSaved={refreshAll}
      />
      <CashSheet open={cashOpen} onClose={() => setCashOpen(false)} cash={cash} onDone={() => { setCashOpen(false); refreshAll(); }} />

      {/* Confirmed-delete confirmation modal (in-app, never a browser dialog). */}
      <Sheet open={!!delTxn} onClose={() => (deleting ? null : setDelTxn(null))}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🗑️</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, marginTop: 10 }}>Delete this transaction?</div>
          {delTxn && (
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 6, lineHeight: 1.5 }}>
              <span style={{ color: COLOR.ink, fontWeight: 700 }}>{delTxn.merchant}</span> · {delAmountLabel(delTxn)}
              <br />{reversalNote(delTxn)}
            </div>
          )}
        </div>
        <div onClick={deleting ? undefined : deleteConfirmed} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>{deleting ? 'Deleting…' : 'Delete'}</div>
        <div onClick={() => (deleting ? null : setDelTxn(null))} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
      </Sheet>
    </div>
  );
}
