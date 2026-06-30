/**
 * Default India-friendly categories. Used both by the seed script (for the
 * demo user) and by signup provisioning (so a brand-new user's app isn't empty
 * and the "Where it went" chart / category pickers work immediately).
 */
export const DEFAULT_CATEGORIES = [
  { key: 'food', label: 'Food & Dining', emoji: '🍔', color: '#FF6B5E', kind: 'expense', order: 1 },
  { key: 'groceries', label: 'Groceries', emoji: '🛒', color: '#FF9F45', kind: 'expense', order: 2 },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#A78BFA', kind: 'expense', order: 3 },
  { key: 'fashion', label: 'Fashion', emoji: '👗', color: '#F472B6', kind: 'expense', order: 4 },
  { key: 'bills', label: 'Bills & Utilities', emoji: '⚡', color: '#FFB23E', kind: 'expense', order: 5 },
  { key: 'electricity', label: 'Electricity', emoji: '💡', color: '#FACC15', kind: 'expense', order: 6 },
  { key: 'recharge', label: 'Recharge & DTH', emoji: '📱', color: '#38BDF8', kind: 'expense', order: 7 },
  { key: 'transport', label: 'Transport', emoji: '🚕', color: '#2BC4B0', kind: 'expense', order: 8 },
  { key: 'fuel', label: 'Fuel', emoji: '⛽', color: '#F97316', kind: 'expense', order: 9 },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬', color: '#FF6FA5', kind: 'expense', order: 10 },
  { key: 'health', label: 'Health', emoji: '🩺', color: '#34D39E', kind: 'expense', order: 11 },
  { key: 'rent', label: 'Rent & Housing', emoji: '🏠', color: '#8B5CF6', kind: 'expense', order: 12 },
  { key: 'emi', label: 'Loan / EMI', emoji: '🏦', color: '#0EA5E9', kind: 'expense', order: 13 },
  { key: 'insurance', label: 'Insurance', emoji: '🛡️', color: '#0D9488', kind: 'expense', order: 14 },
  { key: 'investment', label: 'Investment / SIP', emoji: '📈', color: '#22C55E', kind: 'expense', order: 15 },
  { key: 'services', label: 'Services', emoji: '🧾', color: '#6C5CE7', kind: 'expense', order: 16 },
  { key: 'transfer', label: 'Transfer', emoji: '🔁', color: '#64748B', kind: 'expense', order: 17 },
  { key: 'loan', label: 'Loan / Debt', emoji: '🤝', color: '#0EA5E9', kind: 'expense', order: 18 },
  { key: 'income', label: 'Income', emoji: '💰', color: '#16a34a', kind: 'income', order: 19 },
  { key: 'other', label: 'Other', emoji: '🏷️', color: '#9b94a8', kind: 'expense', order: 20 },
];
