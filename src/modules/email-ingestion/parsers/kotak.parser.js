import {
  parseAmount, parseLast4, parseDirection, parseDate, matchMerchant, prettifyMerchant,
} from './parseHelpers.js';

/**
 * Kotak Mahindra Bank alerts (@kotak.com).
 * Handles "Sent Rs.3000.00 from Kotak Bank AC X1198 to Urban Company on
 * 19-06-26 ..." and "Received Rs.X in AC X1198 from <sender>".
 */
export function parse({ subject = '', body = '' } = {}) {
  const text = `${subject}\n${body}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  if (!amount || !direction) return null;

  const rawMerchant = matchMerchant(text, [
    /\bto\s+([A-Za-z0-9&'._ -]+?)\s+on\b/i,
    /\bfrom\s+([A-Za-z0-9&'._ -]+?)\s+on\b/i,
    /(?:at|towards)\s+([A-Za-z0-9&'._ -]+?)\s*(?:on|\.|Ref|$)/i,
    /VPA\s+([^\s]+@[^\s]+)/i,
  ]);

  return {
    amount,
    direction,
    merchant: prettifyMerchant(rawMerchant) || 'Kotak transaction',
    occurredAt: parseDate(text),
    last4: parseLast4(text),
  };
}
