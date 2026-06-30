// Indian number/currency formatting (en-IN, ₹).

export function inr(n) {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN');
}

/**
 * Balance formatter that NEVER shows a negative figure — clamps the displayed
 * value at ₹0. The stored balance stays honest (an email-driven computed balance
 * could theoretically go negative if the starting balance was off); we only
 * clamp the DISPLAY so the UI never shows "-₹X". Use for account balances.
 */
export function inrBalance(n) {
  return inr(Math.max(0, Number(n || 0)));
}

/** Signed amount with ₹, e.g. credit → "+₹8,000", debit → "-₹420". */
export function signedInr(amount, direction) {
  const sign = direction === 'credit' ? '+' : '-';
  return sign + inr(Math.abs(amount));
}

/**
 * Next salary pay date from a day-of-month (1–31). If today is past this
 * month's pay day, rolls to next month; clamps to the month's last day
 * (e.g. payDay 31 in June → 30 Jun).
 */
export function nextPayDate(payDay, from = new Date()) {
  const clampDay = (y, m, day) => Math.min(day, new Date(y, m + 1, 0).getDate());
  let year = from.getFullYear();
  let month = from.getMonth();
  let day = clampDay(year, month, payDay);
  if (from.getDate() > day) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    day = clampDay(year, month, payDay);
  }
  return new Date(year, month, day);
}

/** Short day+month label, e.g. "1 Jul". */
export function dayMonth(date) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Ordinal suffix for a day number, e.g. 1 → "1st", 22 → "22nd". */
export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Format a market price with its currency symbol (₹ for INR, $ for USD). */
export function fmtPrice(value, currency = 'INR') {
  const v = Number(value || 0);
  if (currency === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: v < 100 ? 2 : 0 });
}

/** Signed percent, e.g. 2.31 → "+2.31%", -0.4 → "-0.40%". */
export function fmtPct(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

/** Compact lakh form for hero/donut, e.g. 780000 → "₹7.8L". */
export function inrCompact(n) {
  const v = Number(n || 0);
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2).replace(/\.00$/, '') + 'Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return inr(v);
}
