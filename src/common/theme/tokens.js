// Exact design tokens from Centra Expense.dc.html — single source of truth
// for inline styles used across feature screens.

export const FONT = {
  jakarta: "'Plus Jakarta Sans', sans-serif",
  inter: "'Inter', sans-serif",
};

export const COLOR = {
  ink: '#2a2733',
  muted: '#7a7387',
  mutedSoft: '#9b94a8',
  mutedFaint: '#b3acc0',
  appbg: '#FBF8F4',
  cardBorder: '#f1ecf6',
  purple: '#A78BFA',
  purpleDeep: '#6C5CE7',
  expense: '#FF6B5E',
  teal: '#2BC4B0',
  greenDark: '#16a34a',
  green: '#1FAE63',
  greenBright: '#34D39E',
  amber: '#FFB23E',
};

export const GRADIENT = {
  brand: 'linear-gradient(135deg,#FF8A7A,#FF6FA5 55%,#A78BFA)',
  teal: 'linear-gradient(120deg,#2BC4B0 0%,#4ECDC4 60%,#7BE3C9 100%)',
  invest: 'linear-gradient(140deg,#6C5CE7 0%,#A78BFA 55%,#C8A2FF 100%)',
  cash: 'linear-gradient(135deg,#34D39E,#1FAE63)',
};

// Card preset matching the recurring white card style in the design.
export const CARD = {
  background: '#fff',
  boxShadow: '0 12px 28px rgba(90,70,130,.09)',
  border: '1.5px solid #f1ecf6',
};

// Source badge palette. DB stores `aa_sync`; design renders it as `sync`.
export const SOURCE_BADGE = {
  email: { bg: '#F4ECFF', fg: '#8b5cf6', icon: '📧' },
  aa_sync: { bg: '#E7F3FF', fg: '#2B7FE0', icon: '🏦' },
  cash: { bg: '#EAF7EF', fg: '#1FAE63', icon: '💵' },
  manual: { bg: '#F1EEF6', fg: '#7a7387', icon: '✍️' },
};

export function sourceBadgeText(source, accountName) {
  switch (source) {
    case 'email': return `📧 Auto from ${accountName}`;
    case 'aa_sync': return `🏦 Bank sync · ${accountName}`;
    case 'cash': return '💵 Cash';
    default: return `✍️ Manual · ${accountName}`;
  }
}

// Bottom-nav definitions (active pill color per tab).
export const NAV = [
  { key: 'home', label: 'Home', emoji: '🏠', color: '#FF6B5E' },
  { key: 'txns', label: 'Txns', emoji: '💳', color: '#2BC4B0' },
  { key: 'email', label: 'Auto', emoji: '✉️', color: '#A78BFA' },
  { key: 'invest', label: 'Invest', emoji: '📈', color: '#FF9F1C' },
  { key: 'discover', label: 'Discover', emoji: '🔍', color: '#FF6FA5' },
];
