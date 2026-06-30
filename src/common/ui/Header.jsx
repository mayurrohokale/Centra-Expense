'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT, COLOR, GRADIENT } from '@/common/theme/tokens.js';
import { useAuth } from '@/features/auth/AuthContext';
import Logo from '@/common/ui/Logo';

// Initials from a name ("Aditya Sharma" -> "AS"), falling back to the email.
function initialsOf(user) {
  const name = (user?.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
  return (user?.email?.[0] || '?').toUpperCase();
}

// Professional app header shown across every tab: brand wordmark on the left,
// an initials avatar on the right that opens a profile menu with Log out.
export default function Header() {
  const { user, logout, openProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const initials = initialsOf(user);

  return (
    <header
      className="safe-pad-top"
      style={{
        position: 'relative',
        zIndex: 30,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // top padding comes from .safe-pad-top (12px + safe-area inset); keep
        // horizontal + bottom here. (No inline paddingTop — it would beat the class.)
        paddingLeft: 18,
        paddingRight: 18,
        paddingBottom: 12,
        background: 'rgba(255,255,255,.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1.5px solid #f0ebf5',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ borderRadius: 10, boxShadow: '0 6px 14px rgba(255,111,165,.38)', lineHeight: 0 }}>
          <Logo size={30} round={10} />
        </div>
        <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.4px' }}>
          Centra
        </span>
      </div>

      {/* Avatar + menu */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Profile menu"
          style={{
            width: 38, height: 38, borderRadius: '50%', border: '2px solid #fff',
            background: GRADIENT.brand, color: '#fff', cursor: 'pointer',
            fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13.5, letterSpacing: '.3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(167,139,250,.4)', padding: 0,
          }}
        >
          {initials}
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute', top: 48, right: 0, width: 230, zIndex: 50,
              background: '#fff', borderRadius: 16, overflow: 'hidden',
              border: '1.5px solid #f1ecf6', boxShadow: '0 18px 40px rgba(90,70,130,.18)',
            }}
          >
            {/* Identity block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px', borderBottom: '1px solid #f4effa' }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: GRADIENT.brand,
                  color: '#fff', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Your account'}
                </div>
                <div style={{ fontFamily: FONT.inter, fontWeight: 500, fontSize: 11.5, color: COLOR.mutedSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email || ''}
                </div>
              </div>
            </div>

            {/* View profile */}
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); openProfile(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: FONT.inter, fontWeight: 700, fontSize: 13.5, color: COLOR.ink, textAlign: 'left',
                borderBottom: '1px solid #f4effa',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#faf7ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 15 }}>👤</span> View profile
            </button>

            {/* Log out */}
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); logout(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: FONT.inter, fontWeight: 700, fontSize: 13.5, color: COLOR.expense, textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 15 }}>↪</span> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
