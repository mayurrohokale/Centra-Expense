'use client';
import { useEffect, useState } from 'react';
import Login from './Login.jsx';
import Signup from './Signup.jsx';
import Forgot from './Forgot.jsx';
import { Notice } from './authUI.jsx';

const GOOGLE_MESSAGES = {
  google_unconfigured: 'Google sign-in isn’t configured yet. Use email + password, or add Google OAuth credentials to enable it.',
  google_failed: 'Google sign-in didn’t complete. Please try again or use email + password.',
};

// Pre-app auth flow: login / signup / forgot. Calls onAuthed(user) on success.
export default function AuthFlow({ onAuthed }) {
  const [view, setView] = useState('login'); // login | signup | forgot
  const [googleMsg, setGoogleMsg] = useState('');

  // Surface ?auth=... messages from the Google redirect, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('auth');
    if (auth && GOOGLE_MESSAGES[auth]) {
      setGoogleMsg(GOOGLE_MESSAGES[auth]);
      params.delete('auth');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const onGoogle = () => { window.location.href = '/api/auth/google'; };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {googleMsg && (
        <div style={{ padding: '14px 26px 0' }}>
          <Notice tone="warn">{googleMsg}</Notice>
        </div>
      )}
      {view === 'login' && (
        <Login onAuthed={onAuthed} goSignup={() => setView('signup')} goForgot={() => setView('forgot')} onGoogle={onGoogle} />
      )}
      {view === 'signup' && (
        <Signup onAuthed={onAuthed} goLogin={() => setView('login')} onGoogle={onGoogle} />
      )}
      {view === 'forgot' && (
        <Forgot goLogin={() => setView('login')} />
      )}
    </div>
  );
}
