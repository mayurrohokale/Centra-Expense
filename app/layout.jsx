import './globals.css';

export const metadata = {
  title: 'Centra Expense',
  description: 'Mobile-first personal-finance app for India — three data pipes, one ledger.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Extend under the notch / home indicator so env(safe-area-inset-*) is
  // non-zero and the header/bottom-nav can pad themselves into the safe area.
  viewportFit: 'cover',
};

// Fonts loaded via Google Fonts <link> so the exact family names
// ('Plus Jakarta Sans' / 'Inter') referenced in the design tokens resolve.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
