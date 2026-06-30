'use client';
// Mobile-width screen container (no device chrome/bezel).
// Caps width at the design's 390px and centers on larger viewports.
//
// It is a NON-scrolling flex column pinned to the full dynamic viewport height
// (`100dvh`, with `100vh` fallback). The document itself is locked (html/body
// overflow hidden in globals.css), so this frame never moves — only its content
// child scrolls. That keeps the Header (first flex child) and the BottomNav
// (absolute bottom, scoped to this relative frame) fixed on a real phone.
export default function MobileFrame({ children }) {
  // Height comes from the `.centra-frame` class (globals.css): 100vh with a
  // 100dvh upgrade via @supports. Kept in CSS (not inline) so the dvh fallback
  // actually applies — an inline height would override the class.
  return (
    <div
      className="centra-frame"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 390,
        margin: '0 auto',
        background: '#FBF8F4',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
