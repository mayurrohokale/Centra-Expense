import { bankForSender, BANK_BY_KEY } from '../bankSenders.js';
import { genericExtract } from './generic.parser.js';
import { aiExtract } from '../aiExtract.js';
import { parse as hdfc } from './hdfc.parser.js';
import { parse as icici } from './icici.parser.js';
import { parse as sbi } from './sbi.parser.js';
import { parse as axis } from './axis.parser.js';
import { parse as kotak } from './kotak.parser.js';

/**
 * Parser registry: bank key → per-bank regex parser. Banks WITHOUT an entry
 * here (e.g. PNB, BoB, the newer `.bank.in` senders) are still detected via
 * bankForSender and handled by the generic extractor + AI fallback.
 *
 * Extraction chain per email: per-bank regex → generic extractor → AI fallback
 * (Anthropic, strict JSON; only when ANTHROPIC_API_KEY is set). The first one
 * to produce a draft wins, and the `path` is reported for logging.
 */
const REGISTRY = {
  hdfc,
  icici,
  sbi,
  axis,
  kotak,
};

/** Bank metadata + optional per-bank parser for a raw `From` header. */
export function resolveBank(fromHeader) {
  const bank = bankForSender(fromHeader);
  if (!bank) return null;
  return { bank, parser: REGISTRY[bank.key] || null };
}

/**
 * Parse a single (in-memory) email into a normalized transaction draft.
 * Returns { bank, draft, reason, path }:
 *   - draft != null  → success; `path` ∈ 'regex' | 'generic' | 'ai'
 *   - draft == null  → `reason` ∈ 'no_parser' (sender not a monitored bank) |
 *                       'unparsable' (bank matched but no extractor could read it)
 * The raw email is never returned or stored.
 */
export async function parseEmail(email) {
  const resolved = resolveBank(email.from);
  if (!resolved) return { bank: null, draft: null, reason: 'no_parser', path: null };

  const { bank, parser } = resolved;
  const input = { subject: email.subject, body: email.body };

  // 1) Per-bank regex (when available).
  if (parser) {
    let draft = null;
    try { draft = parser(input); } catch { draft = null; }
    if (draft) return { bank, draft, reason: null, path: 'regex' };
  }

  // 2) Generic bank-agnostic extractor.
  let generic = null;
  try { generic = genericExtract(input, bank); } catch { generic = null; }
  if (generic) return { bank, draft: generic, reason: null, path: 'generic' };

  // 3) AI fallback (strict JSON) — no-op when ANTHROPIC_API_KEY is unset.
  let ai = null;
  try {
    ai = await aiExtract(bank, email);
  } catch {
    ai = null;
  }
  if (ai) return { bank, draft: ai, reason: null, path: 'ai' };

  return { bank, draft: null, reason: 'unparsable', path: null };
}

export { BANK_BY_KEY };
