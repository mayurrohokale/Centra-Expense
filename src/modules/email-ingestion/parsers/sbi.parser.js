import {
  parseAmount, parseLast4, parseDirection, parseDate, matchMerchant, prettifyMerchant,
} from './parseHelpers.js';

/**
 * SBI alerts (alerts@sbi.co.in / sbicard.com).
 * Handles "your a/c no. XX7745 is debited by Rs.2100.00 on 27/06/26 ... at HP
 * PETROL" and "a/c no. XX7745 credited by Rs.1200.00 ... Dividend".
 */
export function parse({ subject = '', body = '' } = {}) {
  const text = `${subject}\n${body}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  if (!amount || !direction) return null;

  const rawMerchant = matchMerchant(text, [
    /(?:at|to|towards|trf to)\s+([A-Za-z0-9&'._ -]+?)\s*(?:on|\.|-Ref|Ref|UPI|$)/i,
    /(?:info|remarks|narration)[:\-]\s*([A-Za-z0-9&'._ -]+)/i,
    /VPA\s+([^\s]+@[^\s]+)/i,
  ]);

  return {
    amount,
    direction,
    merchant: prettifyMerchant(rawMerchant) || 'SBI transaction',
    occurredAt: parseDate(text),
    last4: parseLast4(text),
  };
}
