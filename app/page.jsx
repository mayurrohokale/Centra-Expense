'use client';
import { useCallback, useEffect, useState } from 'react';
import MobileFrame from '@/common/ui/MobileFrame';
import Header from '@/common/ui/Header';
import Logo from '@/common/ui/Logo';
import BottomNav from '@/common/ui/BottomNav';
import Dashboard from '@/features/dashboard/Dashboard';
import Transactions from '@/features/transactions/Transactions';
import EmailConnect from '@/features/email-connect/EmailConnect';
import Investments from '@/features/investments/Investments';
import Discover from '@/features/discover/Discover';
import Profile from '@/features/profile/Profile';
import OnboardingWizard from '@/features/onboarding/OnboardingWizard';
import AuthFlow from '@/features/auth/AuthFlow';
import { AuthProvider } from '@/features/auth/AuthContext';
import { api } from '@/common/lib/api.js';
import { FONT, COLOR } from '@/common/theme/tokens.js';

// Gate: ask /api/auth/me on load. Unauthenticated → auth flow; authenticated →
// the existing 5-tab app, bound to the real user.
export default function Page() {
  const [status, setStatus] = useState('loading'); // loading | anon | authed
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('home');
  const [view, setView] = useState('app'); // app | profile

  const checkSession = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.data);
      setStatus('authed');
    } catch {
      setUser(null);
      setStatus('anon');
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const onAuthed = (u) => { setUser(u); setTab('home'); setView('app'); setStatus('authed'); };

  // Profile navigation + live user refresh shared via AuthContext.
  const openProfile = useCallback(() => setView('profile'), []);
  const closeProfile = useCallback(() => setView('app'), []);
  const refreshUser = useCallback(async () => {
    try { const res = await api.me(); setUser(res.data); } catch { /* ignore */ }
  }, []);

  // Deep-link support: after the Gmail OAuth redirect (/?tab=email&gmail=...)
  // open the requested tab. Runs once when a session becomes active.
  useEffect(() => {
    if (status !== 'authed' || typeof window === 'undefined') return;
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (wanted && ['home', 'txns', 'email', 'invest', 'discover'].includes(wanted)) {
      setTab(wanted);
    }
  }, [status]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
    setView('app');
    setStatus('anon');
  }, []);

  if (status === 'loading') {
    return (
      <MobileFrame>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Logo size={56} round={18} />
          <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.mutedSoft }}>Loading Centra…</div>
        </div>
      </MobileFrame>
    );
  }

  if (status === 'anon') {
    return (
      <MobileFrame>
        <AuthFlow onAuthed={onAuthed} />
      </MobileFrame>
    );
  }

  const inProfile = view === 'profile';
  // Only genuinely-new signups carry onboarding.completed === false. Legacy/demo
  // users have no onboarding field (undefined) and skip the wizard.
  const needsOnboarding = user?.onboarding?.completed === false && !user?.onboarding?.skipped;

  if (needsOnboarding) {
    return (
      <AuthProvider
        user={user}
        logout={logout}
        openProfile={openProfile}
        closeProfile={closeProfile}
        refreshUser={refreshUser}
      >
        <MobileFrame>
          <OnboardingWizard />
        </MobileFrame>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider
      user={user}
      logout={logout}
      openProfile={openProfile}
      closeProfile={closeProfile}
      refreshUser={refreshUser}
    >
      <MobileFrame>
        <Header />
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: inProfile ? 28 : 96 }}>
          {inProfile ? (
            <Profile />
          ) : (
            <>
              {tab === 'home' && <Dashboard onTab={setTab} />}
              {tab === 'txns' && <Transactions />}
              {tab === 'email' && <EmailConnect />}
              {tab === 'invest' && <Investments />}
              {tab === 'discover' && <Discover />}
            </>
          )}
        </div>
        {!inProfile && <BottomNav tab={tab} onTab={setTab} />}
      </MobileFrame>
    </AuthProvider>
  );
}
