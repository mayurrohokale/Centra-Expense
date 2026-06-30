'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONT, COLOR, GRADIENT, CARD } from '../../common/theme/tokens.js';
import { inr, ordinal } from '../../common/lib/format.js';
import AccountFormSheet from '../profile/AccountFormSheet.jsx';
import SalarySheet from '../profile/SalarySheet.jsx';

const STEPS = ['welcome', 'accounts', 'salary', 'done'];

export default function OnboardingWizard() {
  const { user, refreshUser } = useAuth();
  const accounts = useApi(api.getAccounts, []);
  const [step, setStep] = useState(0);
  const [accountForm, setAccountForm] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const firstName = (user?.name || 'there').split(' ')[0];
  const banks = (accounts.data || []).filter((a) => a.type === 'bank');
  const salary = user?.salary;
  const hasSalary = salary?.amount > 0 && salary?.payDay;

  async function finish(action) {
    if (busy) return;
    setBusy(true);
    try {
      await api.finishOnboarding(action);
      await refreshUser(); // flips the gate in app/page.jsx → app renders
    } catch {
      setBusy(false); // stay on the wizard so the user can retry
    }
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const primaryBtn = (label, onClick, disabled) => (
    <div onClick={disabled ? undefined : onClick} style={{ padding: 16, borderRadius: 18, background: GRADIENT.brand, textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15.5, color: '#fff', cursor: 'pointer', boxShadow: '0 12px 26px rgba(255,111,165,.34)', opacity: disabled ? 0.7 : 1 }}>{label}</div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar: progress dots + skip */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 4px' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {STEPS.map((s, i) => (
            <span key={s} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 8, background: i <= step ? '#FF6FA5' : '#ece5f4', transition: 'all .2s' }} />
          ))}
        </div>
        {step < STEPS.length - 1 && (
          <button type="button" onClick={() => finish('skip')} disabled={busy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft }}>
            Skip for now
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 24px' }}>
        {/* STEP 0 — welcome */}
        {step === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 26 }}>
            <div style={{ width: 96, height: 96, margin: '0 auto', borderRadius: 30, background: GRADIENT.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46, boxShadow: '0 18px 38px rgba(255,111,165,.4)' }}>💸</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink, marginTop: 26, letterSpacing: '-.6px' }}>Welcome, {firstName}! 👋</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 14, color: COLOR.muted, marginTop: 10, lineHeight: 1.55, padding: '0 8px' }}>Let's set up your money in a couple of quick steps. You can always change these later in your profile.</div>
            <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 13, textAlign: 'left' }}>
              {[['🏦', 'Add your bank accounts', 'See all your balances in one place'], ['💼', 'Set your salary', 'Get reminders before payday'], ['📧', 'Auto-track later', 'Connect email anytime to auto-import']].map(([e, t, s]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 18, ...CARD }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: '#FBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{e}</div>
                  <div><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{t}</div><div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 11.5, color: COLOR.mutedSoft }}>{s}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — accounts */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 24, color: COLOR.ink, letterSpacing: '-.5px' }}>Add your accounts 🏦</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 13.5, color: COLOR.muted, marginTop: 8, lineHeight: 1.5 }}>Add a bank account to start tracking your balance. Add as many as you like.</div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {banks.map((a) => (
                <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 18, ...CARD }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: '#fff' }}>{a.logo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{a.name}</div>
                    <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{a.last4 ? `•••• ${a.last4}` : 'Bank account'}</div>
                  </div>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink }}>{inr(a.balance)}</div>
                </div>
              ))}
              <div onClick={() => setAccountForm(true)} style={{ padding: '15px 16px', borderRadius: 18, background: '#fff', border: '1.5px dashed #cdbff0', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#7a5fc0', cursor: 'pointer' }}>+ Add bank account</div>
            </div>
          </div>
        )}

        {/* STEP 2 — salary */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 24, color: COLOR.ink, letterSpacing: '-.5px' }}>Set your salary 💼</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 13.5, color: COLOR.muted, marginTop: 8, lineHeight: 1.5 }}>We'll remind you before payday and show upcoming income. Optional — you can skip this.</div>

            <div style={{ marginTop: 20 }}>
              {hasSalary ? (
                <div style={{ borderRadius: 20, padding: 18, background: 'linear-gradient(120deg,#E9FBF3,#D6F5E8)', border: '1.5px solid #c5efdc' }}>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: '#13795f', letterSpacing: '-.6px' }}>{inr(salary.amount)}</div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: '#3a8a74', marginTop: 3 }}>Paid on the {ordinal(salary.payDay)} of every month</div>
                  <div onClick={() => setSalaryOpen(true)} style={{ marginTop: 12, display: 'inline-block', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5, color: '#13795f', cursor: 'pointer' }}>Edit ›</div>
                </div>
              ) : (
                <div onClick={() => setSalaryOpen(true)} style={{ padding: '15px 16px', borderRadius: 18, background: '#fff', border: '1.5px dashed #cdbff0', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: '#7a5fc0', cursor: 'pointer' }}>+ Set monthly salary</div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — done */}
        {step === 3 && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ width: 96, height: 96, margin: '0 auto', borderRadius: 30, background: GRADIENT.cash, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46, boxShadow: '0 18px 38px rgba(31,174,99,.4)' }}>🎉</div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 26, color: COLOR.ink, marginTop: 26, letterSpacing: '-.6px' }}>You're all set!</div>
            <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 14, color: COLOR.muted, marginTop: 10, lineHeight: 1.55 }}>Your dashboard is ready. Add expenses, connect email, or explore investments whenever you like.</div>
            <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 16, ...CARD }}>
                <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.muted }}>🏦 Accounts added</span>
                <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, color: COLOR.ink }}>{banks.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 16, ...CARD }}>
                <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.muted }}>💼 Salary</span>
                <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14, color: COLOR.ink }}>{hasSalary ? inr(salary.amount) : 'Not set'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ flexShrink: 0, padding: '12px 22px calc(18px + env(safe-area-inset-bottom))', borderTop: '1.5px solid #f0ebf5', background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)' }}>
        {step === 0 && primaryBtn('Get started', next)}
        {(step === 1 || step === 2) && (
          <div style={{ display: 'flex', gap: 11 }}>
            <div onClick={back} style={{ flex: '0 0 auto', padding: '16px 22px', borderRadius: 18, background: '#f2eef7', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.muted, cursor: 'pointer' }}>Back</div>
            <div style={{ flex: 1 }}>{primaryBtn('Continue', next)}</div>
          </div>
        )}
        {step === 3 && primaryBtn(busy ? 'Finishing…' : 'Go to dashboard', () => finish('complete'), busy)}
      </div>

      <AccountFormSheet open={accountForm} account={null} onClose={() => setAccountForm(false)} onSaved={async () => { await accounts.refetch(); }} />
      <SalarySheet open={salaryOpen} user={user} onClose={() => setSalaryOpen(false)} onSaved={async () => { await refreshUser(); }} />
    </div>
  );
}
