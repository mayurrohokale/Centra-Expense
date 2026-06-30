/**
 * Default India-friendly categories. Used both by the seed script (for the
 * demo user) and by signup provisioning (so a brand-new user's app isn't empty
 * and the "Where it went" chart / category pickers work immediately).
 */
export const DEFAULT_CATEGORIES = [
  { key: 'food', label: 'Food & Dining', emoji: '🍔', color: '#FF6B5E', kind: 'expense', order: 1 },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#A78BFA', kind: 'expense', order: 2 },
  { key: 'bills', label: 'Bills & Utilities', emoji: '⚡', color: '#FFB23E', kind: 'expense', order: 3 },
  { key: 'transport', label: 'Transport', emoji: '🚕', color: '#2BC4B0', kind: 'expense', order: 4 },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬', color: '#FF6FA5', kind: 'expense', order: 5 },
  { key: 'health', label: 'Health', emoji: '🩺', color: '#34D39E', kind: 'expense', order: 6 },
  { key: 'services', label: 'Services', emoji: '🧾', color: '#6C5CE7', kind: 'expense', order: 7 },
  { key: 'income', label: 'Income', emoji: '💰', color: '#16a34a', kind: 'income', order: 8 },
  { key: 'other', label: 'Other', emoji: '🏷️', color: '#9b94a8', kind: 'expense', order: 9 },
];
