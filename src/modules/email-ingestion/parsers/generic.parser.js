import {
  parseAmount, parseLast4, parseDirection, parseDate, matchMerchant, prettifyMerchant,
  parseAvailableBalance,
} from './parseHelpers.js';

/**
 * Bank-agnostic fallback extractor.
 *
 * Runs when no per-bank regex parser matched (or a bank has no dedicated
 * parser, e.g. the newer `.bank.in` senders). It pulls the universal fields any
 * Indian bank debit/credit alert contains — amount, direction, masked last-4,
 * date, and a best-effort merchant/payee/VPA guess — so a real bank email
 * almost never ends up as a zero-field failure.
 *
 * Returns a normalized draft, or null only when there's no recognizable amount
 * AND direction (e.g. a statement-ready notice) — in which case the AI fallback
 * gets a turn (if configured) before the email is counted as unparsable.
 */
export function genericExtract({ subject = '', body = '' } = {}, bank = null) {
  const text = `${subject}\n${body}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  // Need at least money + a debit/credit intent to call this a transaction.
  if (!amount || !direction) return null;

  const rawMerchant = matchMerchant(text, [
    /\bto VPA\s+([^\s]+@[^\s]+)/i,                          // UPI payee handle
    /\bVPA\s+([^\s]+@[^\s]+)/i,
    /;\s*([A-Za-z0-9&'._ -]+?)\s+credited/i,               // "...; <payee> credited"
    /\bat\s+([A-Za-z0-9&'._ -]+?)\s+on\b/i,                // card spend "at <merchant> on"
    /\b(?:to|towards)\s+([A-Za-z0-9&'._ -]+?)\s+on\b/i,    // "to <name> on"
    /\bfrom\s+([A-Za-z0-9&'._ -]+?)\.?\s*(?:UPI|Ref|on|$)/i,// credit "from <name>"
    /\b(?:Info|Remarks|Narration|Desc)\s*[:\-]\s*([A-Za-z0-9&'._ -]+)/i,
    /\b(?:at|to)\s+([A-Za-z0-9&'._ -]{2,40})/i,            // last resort: any "at/to <text>"
  ]);

  const fallbackName = bank ? `${bank.name} transaction` : 'Bank transaction';
  return {
    amount,
    direction,
    merchant: prettifyMerchant(rawMerchant) || fallbackName,
    occurredAt: parseDate(text),
    last4: parseLast4(text),
    availableBalance: parseAvailableBalance(text),
  };
}
