'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONT, COLOR, GRADIENT, CARD } from '../../common/theme/tokens.js';
import { inr, inrBalance, ordinal } from '../../common/lib/format.js';
import { Loading, ErrorState } from '../../common/ui/States.jsx';
import Sheet from '../../common/ui/Sheet.jsx';
import EditProfileSheet from './EditProfileSheet.jsx';
import SalarySheet from './SalarySheet.jsx';
import AccountFormSheet from './AccountFormSheet.jsx';
import ChangePasswordSheet from './ChangePasswordSheet.jsx';

function initialsOf(user) {
  const name = (user?.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return (user?.email?.[0] || '?').toUpperCase();
}

function memberSince(user) {
  if (!user?.createdAt) return null;
  return new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

const sectionTitle = { fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 15, color: COLOR.ink, letterSpacing: '-.2px' };
const rowLabel = { fontFamily: FONT.inter, fontWeight: 700, fontSize: 13.5, color: COLOR.ink };

export default function Profile() {
  const { user, logout, closeProfile, refreshUser } = useAuth();
  const accounts = useApi(api.getAccounts, []);

  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ open: false, account: null });
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const initials = initialsOf(user);
  const since = memberSince(user);
  const avatarBg = user?.avatarColor || GRADIENT.brand;

  const salary = user?.salary;
  const hasSalary = salary?.amount > 0 && salary?.payDay;

  // In-app daily reminder preferences (persisted via PATCH /api/auth/me).
  const reminderEnabled = user?.reminderEnabled === true;
  const reminderTime = user?.reminderTime || '21:00';
  const [savingReminder, setSavingReminder] = useState(false);
  async function saveReminder(patch) {
    if (savingReminder) return;
    setSavingReminder(true);
    try { await api.updateProfile(patch); await refreshUser(); }
    catch { /* surfaced by no-op; keep UI responsive */ } finally { setSavingReminder(false); }
  }

  const list = accounts.data || [];
  const banks = list.filter((a) => a.type === 'bank');
  const cash = list.filter((a) => a.type === 'cash');
  const orderedAccounts = [...banks, ...cash];

  const refreshProfile = async () => { await refreshUser(); };
  const refreshAccounts = async () => { await accounts.refetch(); };

  async function confirmRemove() {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await api.deleteAccount(removeTarget._id);
      await accounts.refetch();
      setRemoveTarget(null);
    } catch {
      /* keep the sheet open; error surfaced inline below */
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div style={{ padding: '8px 18px 28px' }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
        <button
          type="button"
          onClick={closeProfile}
          aria-label="Back"
          style={{ width: 38, height: 38, borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', cursor: 'pointer', fontSize: 18, color: COLOR.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(90,70,130,.06)' }}
        >
          ‹
        </button>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 22, color: COLOR.ink, letterSpacing: '-.5px' }}>Profile</div>
      </div>

      {/* Identity */}
      <div style={{ borderRadius: 28, padding: '24px 22px', background: GRADIENT.brand, boxShadow: '0 16px 34px rgba(255,111,165,.32)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{ width: 66, height: 66, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,.22)', border: '2.5px solid rgba(255,255,255,.6)', color: '#fff', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 24, letterSpacing: '.5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 21, color: '#fff', letterSpacing: '-.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Your account'}</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 12.5, color: 'rgba(255,255,255,.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            {since && <div style={{ marginTop: 7, display: 'inline-block', background: 'rgba(255,255,255,.22)', color: '#fff', fontFamily: FONT.inter, fontWeight: 600, fontSize: 10.5, padding: '3px 9px', borderRadius: 20 }}>Member since {since}</div>}
          </div>
        </div>
        <div onClick={() => setEditOpen(true)} style={{ position: 'relative', marginTop: 18, padding: '11px 0', borderRadius: 15, background: 'rgba(255,255,255,.95)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13.5, color: '#d6483b', cursor: 'pointer' }}>✏️ Edit profile</div>
      </div>

      {/* Contact details summary */}
      <div style={{ marginTop: 16, borderRadius: 22, padding: '6px 18px', ...CARD }}>
        {[['Phone', user?.phone || 'Not set'], ['Currency', user?.currency || 'INR']].map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: i ? '1px solid #f4effa' : 'none' }}>
            <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>{k}</span>
            <span style={rowLabel}>{v}</span>
          </div>
        ))}
      </div>

      {/* Salary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 4px 12px' }}>
        <div style={sectionTitle}>💼 Salary</div>
        {hasSalary && <div onClick={() => setSalaryOpen(true)} style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.purple, cursor: 'pointer' }}>Edit</div>}
      </div>
      {hasSalary ? (
        <div style={{ borderRadius: 22, padding: 18, background: 'linear-gradient(120deg,#E9FBF3,#D6F5E8)', border: '1.5px solid #c5efdc' }}>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: '#13795f', letterSpacing: '-.6px' }}>{inr(salary.amount)}</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: '#3a8a74', marginTop: 3 }}>Paid on the {ordinal(salary.payDay)} of every month</div>
          {(() => {
            const acct = (accounts.data || []).find((a) => String(a._id) === String(salary.accountId));
            return (
              <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: '#13795f', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.6)', borderRadius: 12, padding: '4px 10px' }}>
                🏦 {acct ? `${acct.name}${acct.last4 ? ` ••${acct.last4}` : ''}` : 'No account set — tap Edit'}
              </div>
            );
          })()}
        </div>
      ) : (
        <div onClick={() => setSalaryOpen(true)} style={{ borderRadius: 22, padding: 18, ...CARD, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: '#EAF7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>💼</div>
          <div style={{ flex: 1 }}>
            <div style={rowLabel}>Set up your salary</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft, marginTop: 1 }}>Powers your upcoming-salary reminder</div>
          </div>
          <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 13, color: COLOR.purple }}>Add ›</span>
        </div>
      )}

      {/* Preferences — in-app reminder */}
      <div style={{ margin: '24px 4px 12px', ...sectionTitle }}>🔔 Reminders</div>
      <div style={{ borderRadius: 22, padding: '16px 18px', ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#FFF4DB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>📝</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={rowLabel}>Daily reminder to add transactions</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft, marginTop: 1 }}>An in-app nudge if you haven't logged anything</div>
          </div>
          {/* Toggle */}
          <div
            onClick={() => saveReminder({ reminderEnabled: !reminderEnabled })}
            style={{ width: 46, height: 28, borderRadius: 16, flexShrink: 0, background: reminderEnabled ? '#2BC4B0' : '#e4dff0', position: 'relative', cursor: savingReminder ? 'default' : 'pointer', transition: 'background .18s', opacity: savingReminder ? 0.7 : 1 }}
          >
            <div style={{ position: 'absolute', top: 3, left: reminderEnabled ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.18)', transition: 'left .18s' }} />
          </div>
        </div>
        {reminderEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f4effa' }}>
            <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.muted }}>⏰ Remind me at</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => saveReminder({ reminderTime: e.target.value })}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 13, border: '1.5px solid #f1ecf6', background: '#fff', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.ink, outline: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Accounts */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 4px 12px' }}>
        <div style={sectionTitle}>🏦 Your accounts</div>
        <div onClick={() => setAccountForm({ open: true, account: null })} style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: COLOR.purple, cursor: 'pointer' }}>+ Add</div>
      </div>

      {accounts.loading && !accounts.data ? (
        <Loading />
      ) : accounts.error ? (
        <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {orderedAccounts.map((a) => (
            <div key={a._id} style={{ borderRadius: 20, padding: '14px 16px', ...CARD, display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: a.type === 'cash' ? GRADIENT.cash : a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: a.type === 'cash' ? 20 : 16, color: '#fff' }}>{a.logo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>
                  {a.type === 'cash' ? 'Cash wallet' : [a.institution, a.last4 ? `•••• ${a.last4}` : null].filter(Boolean).join(' · ') || 'Bank account'}
                </div>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, marginTop: 4, letterSpacing: '-.3px' }}>{inrBalance(a.balance)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div onClick={() => setAccountForm({ open: true, account: a })} style={{ padding: '6px 12px', borderRadius: 11, background: '#f4eefb', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, color: '#7a5fc0', cursor: 'pointer', textAlign: 'center' }}>Edit</div>
                {a.type !== 'cash' && (
                  <div onClick={() => setRemoveTarget(a)} style={{ padding: '6px 12px', borderRadius: 11, background: '#fff5f4', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 11.5, color: COLOR.expense, cursor: 'pointer', textAlign: 'center' }}>Remove</div>
                )}
              </div>
            </div>
          ))}
          {orderedAccounts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 10px', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft }}>No accounts yet. Add your first one above.</div>
          )}
        </div>
      )}

      {/* Security + logout */}
      <div style={{ margin: '24px 4px 12px', ...sectionTitle }}>🔒 Security</div>
      <div onClick={() => setPwOpen(true)} style={{ borderRadius: 20, padding: '15px 16px', ...CARD, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
        <div style={{ width: 40, height: 40, borderRadius: 13, background: '#F1EEF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔑</div>
        <div style={{ flex: 1 }}><div style={rowLabel}>Change password</div></div>
        <span style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 14, color: COLOR.mutedFaint }}>›</span>
      </div>

      <div onClick={logout} style={{ marginTop: 16, padding: 15, borderRadius: 18, background: '#fff', border: '1.5px solid #ffd9d4', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14.5, color: COLOR.expense, cursor: 'pointer' }}>↪ Log out</div>

      {/* Sheets */}
      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} user={user} onSaved={refreshProfile} />
      <SalarySheet open={salaryOpen} onClose={() => setSalaryOpen(false)} user={user} onSaved={refreshProfile} />
      <AccountFormSheet open={accountForm.open} account={accountForm.account} onClose={() => setAccountForm({ open: false, account: null })} onSaved={refreshAccounts} />
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />

      {/* Remove confirm */}
      <Sheet open={!!removeTarget} onClose={() => (removing ? null : setRemoveTarget(null))}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🗑️</div>
          <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, marginTop: 10 }}>Remove {removeTarget?.name}?</div>
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, marginTop: 6, lineHeight: 1.5 }}>This hides the account from your lists. Past transactions stay intact.</div>
        </div>
        <div onClick={removing ? undefined : confirmRemove} style={{ marginTop: 20, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#FF8A7A,#FF6B5E)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: removing ? 0.7 : 1 }}>{removing ? 'Removing…' : 'Remove account'}</div>
        <div onClick={() => (removing ? null : setRemoveTarget(null))} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
      </Sheet>
    </div>
  );
}
