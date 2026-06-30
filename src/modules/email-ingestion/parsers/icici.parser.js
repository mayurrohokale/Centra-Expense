import {
  parseAmount, parseLast4, parseDirection, parseDate, matchMerchant, prettifyMerchant,
} from './parseHelpers.js';

/**
 * ICICI Bank alerts (alerts@icicibank.com).
 * Handles "Acct XX9013 debited with Rs 420.00 on 29-Jun-26; Swiggy credited.
 * UPI:..." and credit ("account XX9013 has been credited with INR 8,000").
 */
export function parse({ subject = '', body = '' } = {}) {
  const text = `${subject}\n${body}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  if (!amount || !direction) return null;

  const rawMerchant = matchMerchant(text, [
    /;\s*([A-Za-z0-9&'._ -]+?)\s+credited/i,         // payee in a debit alert
    /(?:Info|towards|to|at)\s*[:\-]?\s*([A-Za-z0-9&'._ -]+?)\s+(?:on|UPI|Ref)\b/i,
    /from\s+([A-Za-z0-9&'._ -]+?)\.?\s*(?:UPI|Ref|$)/i, // sender in a credit alert
    /VPA\s+([^\s]+@[^\s]+)/i,
  ]);

  return {
    amount,
    direction,
    merchant: prettifyMerchant(rawMerchant) || 'ICICI transaction',
    occurredAt: parseDate(text),
    last4: parseLast4(text),
  };
}
