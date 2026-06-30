'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { signedInr } from '../../common/lib/format.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { EmailConnectSkeleton } from '../../common/ui/Skeleton.jsx';
import CategoryPickerSheet from '../transactions/CategoryPickerSheet.jsx';

const FLASH = {
  connected: { tone: 'ok', text: 'Gmail connected ✅ — scanning your bank emails.' },
  failed: { tone: 'err', text: "Couldn't connect Gmail. Please try again." },
  save_failed: { tone: 'err', text: 'Connected to Google, but saving the inbox failed. Check the server log and try again.' },
  denied: { tone: 'err', text: 'Gmail access was declined.' },
  unconfigured: { tone: 'warn', text: 'Gmail connection not configured yet — try Simulate fetch below.' },
  no_refresh: { tone: 'warn', text: 'Please reconnect Gmail to grant offline access.' },
};

function fmtSynced(ts) {
  if (!ts) return 'Not synced yet';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Synced ${hrs} hr ago`;
  return `Synced ${new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
}

const STATUS_BADGE = {
  connected: { bg: '#EEF7F1', fg: '#1FAE63', text: 'Connected' },
  error: { bg: '#FEECEC', fg: '#D8483B', text: 'Needs reconnect' },
  pending: { bg: '#FFF6E6', fg: '#B57A12', text: 'Pending' },
};

export default function EmailConnect() {
  const accounts = useApi(api.getAccounts, []);
  const connections = useApi(api.getConnections, []);
  const review = useApi(api.getNeedsReview, []);
  const categories = useApi(api.getCategories, []);
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState('');     // global action: 'sim' | 'syncall'
  const [busyId, setBusyId] = useState(''); // per-account: `${id}:sync` | `${id}:disc`
  const [delId, setDelId] = useState('');   // draft id pending inline delete confirm
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null);

  // Surface the ?gmail=... flag set by the OAuth callback, then clean the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const f = new URLSearchParams(window.location.search).get('gmail');
    if (f && FLASH[f]) {
      setFlash(FLASH[f]);
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url);
    }
  }, []);

  const loading = accounts.loading || connections.loading || review.loading;
  const error = accounts.error || connections.error || review.error;
  if (loading) return <EmailConnectSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => { accounts.refetch(); connections.refetch(); review.refetch(); }} />;

  const conns = connections.data || [];
  // Every connected (or errored) Gmail inbox — a user can link many.
  const gmailAccounts = conns.filter((c) => c.kind === 'gmail' && c.status !== 'revoked');
  const hasGmail = gmailAccounts.length > 0;
  const anyBusy = !!busy || !!busyId;
  const acctByName = Object.fromEntries((accounts.data || []).map((a) => [a.name, a]));
  // key → {emoji,label} so review cards can show the auto-assigned category.
  const catByKey = Object.fromEntries((categories.data || []).map((c) => [c.key, c]));

  function refetchAll() { connections.refetch(); review.refetch(); accounts.refetch(); }

  function connectGmail() { window.location.href = api.gmailConnectUrl; }

  async function syncOne(id) {
    setBusyId(`${id}:sync`); setResult(null);
    try {
      const res = await api.syncConnection(id);
      setResult(res.data);
      refetchAll();
    } catch (e) {
      setResult({ error: e.message });
    } finally { setBusyId(''); }
  }

  async function syncAll() {
    setBusy('syncall'); setResult(null);
    try {
      const res = await api.syncAllConnections();
      setResult(res.data);
      refetchAll();
    } catch (e) {
      setResult({ error: e.message });
    } finally { setBusy(''); }
  }

  async function simulate() {
    setBusy('sim'); setResult(null);
    try {
      const res = await api.simulateGmail();
      setResult(res.data);
      refetchAll();
    } catch (e) {
      setResult({ error: e.message });
    } finally { setBusy(''); }
  }

  async function disconnect(id) {
    setBusyId(`${id}:disc`);
    try { await api.revokeConnection(id); refetchAll(); }
    finally { setBusyId(''); }
  }

  // refetchAll includes accounts so the bank balance visibly updates on confirm.
  async function confirm(id) { await api.confirmTransaction(id); refetchAll(); }

  // Delete a DRAFT only (drafts never touched the balance). Inline-confirmed —
  // no browser dialog.
  async function deleteDraft(id) {
    try { await api.deleteTransaction(id); }
    finally { setDelId(''); refetchAll(); }
  }

  // Auto-detected = email-sourced needs_review txns, grouped by bank/inbox.
  const emailReview = (review.data || []).filter((r) => r.source === 'email');
  const groups = Object.values(
    emailReview.reduce((acc, r) => {
      (acc[r.accountName] ||= { name: r.accountName, items: [] }).items.push(r);
      return acc;
    }, {})
  );

  // High-confidence = auto-categorized by a merchant rule or AI (not the bare
  // 'other' default). These can be bulk-approved keeping their auto category.
  const isAuto = (r) => r.categorySource === 'merchant-rule' || r.categorySource === 'ai';
  const autoCount = emailReview.filter(isAuto).length;

  async function confirmAllAuto() {
    setBusy('confirmAuto');
    try {
      // Confirm keeping each row's already-assigned category (no override).
      await Promise.all(emailReview.filter(isAuto).map((r) => api.confirmTransaction(r._id)));
      refetchAll();
    } finally { setBusy(''); }
  }

  const resultText = result && !result.error
    ? `${result.created} new · ${result.duplicate} already saved${result.failed ? ` · ${result.failed} skipped` : ''}${result.errors ? ` · ${result.errors} need reconnect` : ''}`
    : null;

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 25, color: COLOR.ink, margin: '6px 4px 6px', letterSpacing: '-.6px' }}>Auto-track ✉️</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.muted, lineHeight: 1.5, margin: '0 4px 18px' }}>Connect every inbox where your banks send transaction alerts, so we can auto-track those transactions.</div>

      {flash && (
        <div style={{
          margin: '0 0 14px', padding: '11px 14px', borderRadius: 14,
          fontFamily: FONT.inter, fontWeight: 700, fontSize: 12,
          background: flash.tone === 'ok' ? '#EEF7F1' : flash.tone === 'warn' ? '#FFF6E6' : '#FEECEC',
          color: flash.tone === 'ok' ? '#1FAE63' : flash.tone === 'warn' ? '#B57A12' : '#D8483B',
        }}>{flash.text}</div>
      )}

      {hasGmail ? (
        <>
          {/* ---- One card per connected Gmail inbox ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gmailAccounts.map((g) => {
              const badge = STATUS_BADGE[g.status] || STATUS_BADGE.connected;
              const syncing = busyId === `${g._id}:sync`;
              const disc = busyId === `${g._id}:disc`;
              return (
                <div key={g._id} style={{ borderRadius: 24, padding: '18px 18px', background: '#fff', boxShadow: '0 12px 28px rgba(90,70,130,.09)', border: '1.5px solid #f1ecf6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#FF6B5E,#FF8A7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📧</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15.5, color: COLOR.ink }}>Gmail</div>
                      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.label || g.emailAddress || 'Connected inbox'}
                      </div>
                    </div>
                    <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, padding: '5px 11px', borderRadius: 14, background: badge.bg, color: badge.fg }}>{badge.text}</div>
                  </div>

                  <div style={{ marginTop: 13, padding: '11px 13px', borderRadius: 14, background: '#F2FBF6', display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontSize: 15 }}>🔒</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, color: '#7a8a82' }}>Read-only · we only scan bank emails</div>
                      <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#13795f' }}>{fmtSynced(g.lastSyncedAt)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <div onClick={anyBusy ? undefined : () => syncOne(g._id)} style={{ flex: 1, textAlign: 'center', padding: 11, borderRadius: 14, background: 'linear-gradient(135deg,#A78BFA,#C8A2FF)', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', opacity: anyBusy ? 0.6 : 1, boxShadow: '0 7px 16px rgba(167,139,250,.3)' }}>{syncing ? 'Syncing…' : '🔄 Sync now'}</div>
                    <div onClick={anyBusy ? undefined : () => disconnect(g._id)} style={{ padding: '11px 14px', textAlign: 'center', borderRadius: 14, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#9b94a8', cursor: 'pointer', opacity: anyBusy ? 0.6 : 1 }}>{disc ? '…' : 'Disconnect'}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---- Connect another inbox + sync all ---- */}
          <div onClick={anyBusy ? undefined : connectGmail} style={{ marginTop: 12, padding: 13, borderRadius: 16, background: '#fff', border: '1.5px dashed #d9c9f5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', opacity: anyBusy ? 0.6 : 1 }}>
            <span style={{ fontSize: 15 }}>➕</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#A78BFA' }}>Connect another Gmail</span>
          </div>

          {gmailAccounts.length > 1 && (
            <div onClick={anyBusy ? undefined : syncAll} style={{ marginTop: 9, textAlign: 'center', padding: 12, borderRadius: 16, background: 'linear-gradient(135deg,#A78BFA,#C8A2FF)', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', opacity: anyBusy ? 0.6 : 1, boxShadow: '0 7px 16px rgba(167,139,250,.3)' }}>{busy === 'syncall' ? 'Syncing all…' : `🔄 Sync all ${gmailAccounts.length} inboxes`}</div>
          )}

          <div onClick={anyBusy ? undefined : simulate} style={{ marginTop: 9, textAlign: 'center', padding: 10, borderRadius: 13, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12, color: '#A78BFA', cursor: 'pointer', opacity: anyBusy ? 0.6 : 1 }}>{busy === 'sim' ? 'Fetching…' : '🧪 Simulate fetch (dev)'}</div>

          {result && (
            <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 12, background: result.error ? '#FEECEC' : '#EEF7F1', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: result.error ? '#D8483B' : '#1FAE63' }}>
              {result.error ? result.error : (result.created > 0 ? `${result.created} new transaction${result.created > 1 ? 's' : ''} found · ${resultText}` : `No new transactions · ${resultText}`)}
            </div>
          )}
        </>
      ) : (
        /* ---- Empty state: first Gmail connect ---- */
        <div style={{ borderRadius: 24, padding: '18px 18px', background: '#fff', boxShadow: '0 12px 28px rgba(90,70,130,.09)', border: '1.5px solid #f1ecf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#FF6B5E,#FF8A7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📧</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15.5, color: COLOR.ink }}>Gmail</div>
              <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>Not linked</div>
            </div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, padding: '5px 11px', borderRadius: 14, background: '#F1EEF6', color: '#9b94a8' }}>Not linked</div>
          </div>

          <div onClick={anyBusy ? undefined : connectGmail} style={{ marginTop: 13, padding: 13, borderRadius: 14, background: 'linear-gradient(135deg,#A78BFA,#C8A2FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 7px 16px rgba(167,139,250,.32)', opacity: anyBusy ? 0.6 : 1 }}>
            <span style={{ fontSize: 15 }}>📧</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff' }}>Connect Gmail</span>
          </div>
          {/* Outlook — coming soon (this milestone is Gmail-only). */}
          <div style={{ marginTop: 9, padding: 13, borderRadius: 14, background: '#F7F5FA', border: '1.5px dashed #e6e0ef', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'not-allowed' }}>
            <span style={{ fontSize: 15, opacity: 0.5 }}>📨</span><span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#b3acc0' }}>Connect Outlook · coming soon</span>
          </div>
          <div onClick={anyBusy ? undefined : simulate} style={{ marginTop: 11, textAlign: 'center', padding: 11, borderRadius: 14, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12.5, color: '#A78BFA', cursor: 'pointer', opacity: anyBusy ? 0.6 : 1 }}>{busy === 'sim' ? 'Fetching…' : '🧪 Simulate fetch (dev)'}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft, textAlign: 'center', marginTop: 12 }}>🔒 Read-only access · we only scan bank emails</div>

          {result && (
            <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 12, background: result.error ? '#FEECEC' : '#EEF7F1', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: result.error ? '#D8483B' : '#1FAE63' }}>
              {result.error ? result.error : (result.created > 0 ? `${result.created} new transaction${result.created > 1 ? 's' : ''} found · ${resultText}` : `No new transactions · ${resultText}`)}
            </div>
          )}
        </div>
      )}

      <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 12, color: COLOR.mutedSoft, letterSpacing: '.6px', margin: '26px 4px 4px' }}>AUTO-DETECTED TRANSACTIONS</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft, margin: '0 4px 14px' }}>Auto-categorized from the merchant · review before saving ✨</div>

      {autoCount > 0 && (
        <div onClick={busy ? undefined : confirmAllAuto} style={{ margin: '0 0 14px', textAlign: 'center', padding: 12, borderRadius: 16, background: 'linear-gradient(135deg,#2BC4B0,#34D39E)', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, color: '#fff', cursor: 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 7px 16px rgba(43,196,176,.3)' }}>
          {busy === 'confirmAuto' ? 'Confirming…' : `✅ Confirm ${autoCount} auto-categorized`}
        </div>
      )}

      {groups.length === 0 && (
        <div style={{ borderRadius: 20, padding: '22px 18px', background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6', textAlign: 'center' }}>
          <div style={{ fontSize: 26 }}>📭</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink, marginTop: 6 }}>No transactions to review</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft, marginTop: 3 }}>{hasGmail ? 'Hit Sync now, or Simulate a fetch to see it work.' : 'Connect Gmail or Simulate a fetch to get started.'}</div>
        </div>
      )}

      {groups.map((g) => {
        const acct = acctByName[g.name] || { name: g.name, color: '#A78BFA', logo: g.name?.[0] || '•' };
        return (
          <div key={g.name} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 4px 11px' }}>
              <div style={{ width: 26, height: 26, borderRadius: 9, background: acct.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 11, color: '#fff' }}>{acct.logo}</div>
              <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{g.name}</div>
              <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 10.5, color: '#A78BFA' }}>· {g.items.length} to review</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {g.items.map((d) => (
                <div key={d._id} style={{ borderRadius: 22, padding: '15px 17px', background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: d.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{d.icon}</div>
                    <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{d.merchant}</div><div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>📧 Auto-detected · {d.dateLabel}</div></div>
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: d.direction === 'credit' ? '#1FAE63' : '#FF6B5E', letterSpacing: '-.3px' }}>{signedInr(d.amount, d.direction)}</div>
                  </div>
                  {/* Auto-assigned category (pre-filled, tap to change) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
                    <div onClick={() => setPicker(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 12, background: '#F7F4FC', border: '1.5px solid #eee6f3', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13 }}>{(catByKey[d.categoryKey]?.emoji) || d.icon}</span>
                      <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: '#5a5366' }}>{(catByKey[d.categoryKey]?.label) || d.categoryKey}</span>
                      <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: '#A78BFA' }}>⌄</span>
                    </div>
                    {isAuto(d) && (
                      <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 9.5, letterSpacing: '.4px', padding: '4px 8px', borderRadius: 9, background: '#EAF7EF', color: '#1FAE63' }}>{d.categorySource === 'ai' ? 'AI' : 'AUTO'}</span>
                    )}
                  </div>
                  {/* Drafts (needs_review) only — delete control + inline confirm. */}
                  {delId === d._id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
                      <span style={{ flex: 1, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>Delete this draft?</span>
                      <div onClick={() => deleteDraft(d._id)} style={{ padding: '10px 14px', borderRadius: 13, background: '#FF6B5E', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer' }}>Delete</div>
                      <div onClick={() => setDelId('')} style={{ padding: '10px 14px', borderRadius: 13, background: '#f1eef6', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#9b94a8', cursor: 'pointer' }}>Cancel</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
                      <div onClick={() => confirm(d._id)} style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, background: '#2BC4B0', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer' }}>Confirm</div>
                      <div onClick={() => setPicker(d)} style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13, color: '#A78BFA', cursor: 'pointer' }}>Edit category</div>
                      <div onClick={() => setDelId(d._id)} title="Delete draft" style={{ padding: '10px 12px', textAlign: 'center', borderRadius: 13, background: '#FEECEC', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#d6483b', cursor: 'pointer' }}>🗑</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <CategoryPickerSheet
        open={!!picker}
        txn={picker}
        confirmOnPick
        onClose={() => setPicker(null)}
        onSaved={() => review.refetch()}
      />
    </div>
  );
}
