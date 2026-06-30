'use client';
import { useId } from 'react';
import { COLOR } from '@/common/theme/tokens.js';

// Centra logomark: an open "C" ring (a hub where money centralizes) with an
// upward growth arrow rising out of the opening. Brand coral→pink→purple
// gradient. Scales cleanly from favicon size to the auth splash.
//
// Props:
//   size  — pixel size of the square mark (default 32)
//   bg    — render the gradient squircle behind the mark (default true)
//   round — corner radius in viewBox units when bg is on (default 14)
export default function Logo({ size = 32, bg = true, round = 14, style }) {
  const gid = useId().replace(/:/g, '');
  const grad = `centra-grad-${gid}`;
  // On the gradient square the mark is white; standalone it uses the gradient.
  const mark = bg ? '#fff' : `url(#${grad})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Centra"
      style={style}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF8A7A" />
          <stop offset="0.55" stopColor="#FF6FA5" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {bg && <rect width="48" height="48" rx={round} fill={`url(#${grad})`} />}

      {/* Open "C" ring — gap in the upper-right where the arrow emerges */}
      <circle
        cx="24"
        cy="24"
        r="13"
        fill="none"
        stroke={mark}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeDasharray="60.4 21.3"
      />

      {/* Upward growth arrow rising through the opening */}
      <path
        d="M24 25 L33 15 M28.2 15 L33 15 L33 19.8"
        stroke={mark}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Logomark + "Centra" wordmark in a row (used in the header).
export function LogoWordmark({ size = 30, fontSize = 18, gap = 9 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      <Logo size={size} round={size * 0.32} />
      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize, color: COLOR.ink, letterSpacing: '-.4px' }}>
        Centra
      </span>
    </div>
  );
}
