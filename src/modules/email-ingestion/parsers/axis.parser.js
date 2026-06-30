import {
  parseAmount, parseLast4, parseDirection, parseDate, matchMerchant, prettifyMerchant,
} from './parseHelpers.js';

/**
 * Axis Bank alerts (alerts@axisbank.com).
 * Handles card spends ("Spent Card no. XX3320 INR 3000 ... Croma ...") and
 * account debits ("Debit INR 1400.00 A/c no. XX3320 ... Apollo Pharmacy").
 */
export function parse({ subject = '', body = '' } = {}) {
  const text = `${subject}\n${body}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  if (!amount || !direction) return null;

  const rawMerchant = matchMerchant(text, [
    /(?:at|towards|to|for)\s+([A-Za-z0-9&'._ -]+?)\s*(?:on|\.|Ref|Avl|Info|$)/i,
    /(?:info|merchant)[:\-]\s*([A-Za-z0-9&'._ -]+)/i,
    /VPA\s+([^\s]+@[^\s]+)/i,
  ]);

  return {
    amount,
    direction,
    merchant: prettifyMerchant(rawMerchant) || 'Axis transaction',
    occurredAt: parseDate(text),
    last4: parseLast4(text),
  };
}
