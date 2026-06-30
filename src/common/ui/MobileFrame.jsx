'use client';
// Mobile-width screen container (no device chrome/bezel).
// Caps width at the design's 390px and centers on larger viewports.
export default function MobileFrame({ children }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 390,
        height: '100dvh',
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
