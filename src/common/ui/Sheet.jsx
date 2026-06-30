'use client';
// Bottom sheet with scrim, matching the prototype's sheetUp animation.
//
// Mobile-safe layout: the sheet is ANCHORED to the bottom and capped at
// `max-height: 90dvh`, with a fixed grab-handle and a scrollable body. This
// guarantees every field (amount, merchant, account, category, date, the submit
// button…) is reachable even when the on-screen keyboard shrinks the viewport —
// the body scrolls instead of the top fields being pushed off-screen. Bottom
// padding includes the safe-area inset so the last control clears the home
// indicator / keyboard.
export default function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(30,22,46,.42)', zIndex: 50, animation: 'fadeIn .2s ease' }}
      />
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 51,
          background: '#fff', borderRadius: '30px 30px 0 0',
          boxShadow: '0 -12px 40px rgba(40,30,70,.2)', animation: 'sheetUp .28s cubic-bezier(.2,.8,.2,1)',
          // Cap to the dynamic viewport so the sheet never grows past the top of
          // the screen; the body below scrolls for anything taller.
          maxHeight: '90dvh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Fixed grab-handle (stays put while the body scrolls). */}
        <div style={{ flexShrink: 0, padding: '14px 0 4px' }}>
          <div style={{ width: 42, height: 5, borderRadius: 5, background: '#e7e0f0', margin: '0 auto' }} />
        </div>
        {/* Scrollable content. Horizontal + bottom padding (incl. safe area) so
            inputs and the submit button clear the keyboard / home indicator. */}
        <div
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '14px 22px',
            paddingBottom: 'calc(30px + env(safe-area-inset-bottom))',
            overscrollBehavior: 'contain', // don't chain scroll to the page behind
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
