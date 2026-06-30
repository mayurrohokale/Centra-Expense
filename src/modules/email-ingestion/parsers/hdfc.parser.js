import {
  parseAmount, parseLast4, parseDirection, parseDate, matchMerchant, prettifyMerchant,
} from './parseHelpers.js';

/**
 * HDFC Bank alerts (alerts@hdfcbank.net).
 * Handles UPI/account debits ("debited from account XX4582 to VPA swiggy@..."),
 * credits ("credited to your account"), and credit-card spends ("Card ending
 * 4582 for Rs.1899 at Amazon").
 */
export function parse({ subject = '', body = '' } = {}) {
  const text = `${subject}\n${body}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  if (!amount || !direction) return null;

  const rawMerchant = matchMerchant(text, [
    /to VPA\s+([^\s]+@[^\s]+)/i,
    /towards\s+([A-Za-z0-9&'. -]+?)\s+on\b/i, // credit narration
    /\bat\s+([A-Za-z0-9&'._ -]+?)\s+on\b/i,   // card spend
    /;\s*([A-Za-z0-9&'._ -]+?)\s+credited/i,
    /info[:\-]\s*([A-Za-z0-9&'._ -]+)/i,
  ]);

  return {
    amount,
    direction,
    merchant: prettifyMerchant(rawMerchant) || 'HDFC transaction',
    occurredAt: parseDate(text),
    last4: parseLast4(text),
  };
}
