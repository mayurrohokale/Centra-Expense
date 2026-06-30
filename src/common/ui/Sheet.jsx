'use client';
// Bottom sheet with scrim, matching the prototype's sheetUp animation.
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
          background: '#fff', borderRadius: '30px 30px 0 0', padding: '24px 22px 30px',
          boxShadow: '0 -12px 40px rgba(40,30,70,.2)', animation: 'sheetUp .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ width: 42, height: 5, borderRadius: 5, background: '#e7e0f0', margin: '0 auto 18px' }} />
        {children}
      </div>
    </>
  );
}
