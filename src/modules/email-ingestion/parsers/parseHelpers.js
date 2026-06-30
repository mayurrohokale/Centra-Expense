/**
 * Shared, bank-agnostic extraction helpers used by every per-bank parser.
 *
 * Parsers operate ONLY on the already-decoded subject + plain-text body that
 * the Gmail client hands over in memory. The raw email is never persisted.
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** First ₹/Rs/INR amount in the text → Number (handles Indian comma grouping). */
export function parseAmount(text) {
  const m = String(text).match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Available/closing balance from a bank alert → Number, or null.
 *
 * Matches the common Indian-alert phrasings: "Avl Bal: Rs. 42,500.00",
 * "Available Balance INR 42500", "Avbl Bal Rs.42,500", "Avl bal Rs.1,24,500.00",
 * "Closing Balance: 42500". The "bal" keyword is REQUIRED so we never grab a
 * credit-card "Avl Limit Rs.x" or a transaction amount by mistake.
 */
export function parseAvailableBalance(text) {
  const s = String(text);
  const patterns = [
    // avl/avbl/avail/available/closing + bal + (Rs|INR|₹) + number
    /(?:avl|avbl|avail(?:able)?|closing)\.?\s*bal(?:ance)?\.?\s*[:\-]?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    // same, but the currency token may be omitted ("Available Balance 42500")
    /(?:avl|avbl|avail(?:able)?|closing)\.?\s*bal(?:ance)?\.?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

/** Last 4 of the account/card, from common masking patterns. */
export function parseLast4(text) {
  const patterns = [
    /(?:a\/c|acct|account|ac|card)\s*(?:no\.?|number|ending|ending in|ending with)?\s*[:#]?\s*(?:x+|\*+)?\s*(\d{4})\b/i,
    /(?:x{2,}|\*{2,})\s*(\d{4})\b/i,
    /ending\s*(?:in|with)?\s*(\d{4})\b/i,
  ];
  for (const re of patterns) {
    const m = String(text).match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Direction from intent verbs. Debit verbs win when both appear because alert
 * copy often reads "debited ... ; <merchant> credited" (the payee, not you).
 */
export function parseDirection(text) {
  const t = String(text).toLowerCase();
  const debit = /\b(debited|spent|withdrawn|sent|paid|purchase|debit)\b/.test(t);
  const credit = /\b(credited|received|deposited|credit|added to)\b/.test(t);
  if (debit) return 'debit';
  if (credit) return 'credit';
  return null;
}

/** Parse the first recognizable date → Date (defaults to now if none found). */
export function parseDate(text) {
  const s = String(text);

  // DD-Mon-YY / DD Mon YYYY  e.g. 29-Jun-26, 29 Jun 2026
  let m = s.match(/\b(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]*(\d{2,4})\b/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) return mkDate(m[1], mon, m[3]);
  }

  // DD-MM-YYYY or DD/MM/YY (numeric)
  m = s.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (m) return mkDate(m[1], Number(m[2]) - 1, m[3]);

  return new Date();
}

function mkDate(day, monthIdx, year) {
  let y = Number(year);
  if (y < 100) y += 2000;
  const d = Number(day);
  return new Date(Date.UTC(y, monthIdx, d, 6, 0, 0));
}

/** Try an ordered list of merchant regexes; return the first clean capture. */
export function matchMerchant(text, patterns) {
  for (const re of patterns) {
    const m = String(text).match(re);
    if (m && m[1]) {
      const cleaned = m[1]
        .replace(/\s+/g, ' ')
        .replace(/[._-]+$/, '')
        .trim();
      if (cleaned && cleaned.length <= 60) return cleaned;
    }
  }
  return null;
}

/** Title-case a VPA handle or raw token into a display-friendly merchant. */
export function prettifyMerchant(raw) {
  if (!raw) return raw;
  let s = String(raw).split('@')[0]; // drop VPA suffix
  s = s.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return raw;
  return s
    .split(' ')
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(' ');
}
