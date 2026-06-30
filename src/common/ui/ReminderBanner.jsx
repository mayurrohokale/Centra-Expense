'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { FONT, COLOR } from '../theme/tokens.js';

// localStorage key for "dismissed for this day" — keyed by user + YYYY-MM-DD so
// dismissing hides the banner only for the rest of the current day.
function todayKey(userId) {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `centra.reminderDismissed.${userId || 'me'}.${ymd}`;
}

// Is the current local time at/after the user's reminder time ("HH:MM")?
function pastReminderTime(reminderTime) {
  const [h, m] = String(reminderTime || '21:00').split(':').map(Number);
  const now = new Date();
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

/**
 * In-app end-of-day reminder to add transactions. Shows a dismissible banner
 * when ALL of:
 *  - the user enabled the reminder (profile setting)
 *  - the current local time is past their reminderTime
 *  - they haven't logged any transaction today (summary.addedToday === 0)
 *  - they haven't already dismissed it today (localStorage)
 * "Add now" routes to the Transactions tab (quick-add lives there); dismiss
 * hides it for the rest of the day. No push/email — purely in-app.
 */
export default function ReminderBanner({ onAdd }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  const enabled = user?.reminderEnabled === true;
  const reminderTime = user?.reminderTime || '21:00';

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') { setShow(false); return; }
    if (!pastReminderTime(reminderTime)) { setShow(false); return; }
    // Already dismissed today?
    let dismissed = false;
    try { dismissed = localStorage.getItem(todayKey(user?._id)) === '1'; } catch { /* ignore */ }
    if (dismissed) { setShow(false); return; }

    let active = true;
    api.getSummary()
      .then((r) => { if (active && (r.data?.addedToday || 0) === 0) setShow(true); })
      .catch(() => { /* never block the app on this */ });
    return () => { active = false; };
  }, [enabled, reminderTime, user?._id]);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(todayKey(user?._id), '1'); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div style={{ margin: '12px 18px 0', borderRadius: 20, padding: '14px 16px', background: 'linear-gradient(120deg,#FFF6DB,#FFEFC2)', border: '1.5px solid #f3e3a8', display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 40, height: 40, borderRadius: 13, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📝</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13.5, color: '#8a6d12' }}>Don't forget today's transactions</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: '#a9851f' }}>You haven't logged anything today. Add it before you forget.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div onClick={() => { dismiss(); onAdd?.(); }} style={{ padding: '7px 13px', borderRadius: 12, background: '#8a6d12', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 12, color: '#fff', cursor: 'pointer', textAlign: 'center' }}>Add now</div>
        <div onClick={dismiss} style={{ padding: '5px 13px', borderRadius: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: '#a9851f', cursor: 'pointer', textAlign: 'center' }}>Later</div>
      </div>
    </div>
  );
}
