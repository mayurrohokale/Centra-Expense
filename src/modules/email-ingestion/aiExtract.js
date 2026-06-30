import { z } from 'zod';
import { env } from '../../common/config/env.js';
import { httpRequest } from '../../common/http/httpClient.js';
import { logger } from '../../common/logger/logger.js';

/**
 * AI extraction fallback (Anthropic Messages API).
 *
 * Last resort when neither the per-bank regex nor the generic extractor could
 * pull a transaction. STRICT JSON is enforced via `output_config.format`
 * (json_schema) and the result is validated with zod before it is trusted;
 * anything off-schema returns null so the caller can mark the txn needs_review.
 *
 * Graceful: a no-op returning null when ANTHROPIC_API_KEY is unset (today's
 * default) — the pipeline then simply counts the email as unparsable.
 *
 * Implemented over the project's defensive httpClient (timeouts + retries),
 * consistent with every other external integration here, rather than adding the
 * `@anthropic-ai/sdk` dependency. Switching to the official SDK is a clean
 * future swap if desired.
 *
 * Model: env.anthropicModel (default `claude-opus-4-8`). No `thinking`/`effort`
 * is sent, so the same call works if the model is set to `claude-haiku-4-5`
 * (effort is rejected on Haiku). Prefill is NOT used (removed on Opus 4.8) —
 * structured outputs are the supported way to force a JSON shape.
 *
 * SECURITY: the email body is sent to the API for extraction but is NEVER
 * logged or persisted. Only the extracted fields are returned.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Strict output schema the model must conform to. Keep to supported JSON-schema
// features only (types + enum + additionalProperties:false; no min/max/length).
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_transaction: { type: 'boolean' },
    amount: { type: ['number', 'null'] },
    direction: { type: ['string', 'null'], enum: ['debit', 'credit', null] },
    merchant: { type: ['string', 'null'] },
    last4: { type: ['string', 'null'] },
    occurred_at: { type: ['string', 'null'] }, // YYYY-MM-DD if present
  },
  required: ['is_transaction', 'amount', 'direction', 'merchant', 'last4', 'occurred_at'],
};

// Validate the model's JSON before trusting it.
const ResultSchema = z.object({
  is_transaction: z.boolean(),
  amount: z.number().positive().nullable(),
  direction: z.enum(['debit', 'credit']).nullable(),
  merchant: z.string().nullable(),
  last4: z.string().regex(/^\d{4}$/).nullable().catch(null),
  occurred_at: z.string().nullable(),
});

const SYSTEM_PROMPT = [
  'You extract a single financial transaction from one Indian bank alert email (debit/credit/UPI/card).',
  'Amounts are in Indian Rupees (₹/Rs/INR) and may use Indian comma grouping (e.g. 1,24,500.00).',
  'Return amount as a plain number with no currency symbol or commas.',
  'direction is "debit" when money LEFT the account (debited/spent/withdrawn/sent/paid) and "credit" when money ENTERED (credited/received/deposited).',
  'merchant is the counterparty/payee/narration (a UPI VPA, a store, a salary source, etc.) — concise, human-readable.',
  'last4 is the last 4 digits of the masked account or card if present, else null.',
  'occurred_at is the transaction date as YYYY-MM-DD if present, else null.',
  'If the email is NOT a transaction (statement notice, OTP, promo, balance summary), set is_transaction=false and all other fields null.',
].join(' ');

/** Build a normalized draft from the validated model output, or null. */
function toDraft(parsed) {
  if (!parsed.is_transaction) return null;
  if (!parsed.amount || !parsed.direction) return null;
  let occurredAt = new Date();
  if (parsed.occurred_at) {
    const d = new Date(parsed.occurred_at);
    if (!Number.isNaN(d.getTime())) occurredAt = d;
  }
  return {
    amount: parsed.amount,
    direction: parsed.direction,
    merchant: (parsed.merchant || '').trim() || 'Bank transaction',
    occurredAt,
    last4: parsed.last4 || null,
  };
}

/**
 * @returns {Promise<object|null>} normalized draft, or null when disabled,
 * not a transaction, or the response failed validation.
 */
export async function aiExtract(bank, email) {
  if (!env.anthropicApiKey) return null; // disabled — graceful no-op

  const userContent =
    `Bank: ${bank?.name || 'unknown'}\n` +
    `Subject: ${email.subject || ''}\n\n` +
    `${email.body || ''}`;

  let res;
  try {
    res = await httpRequest(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      timeoutMs: 15000,
      body: JSON.stringify({
        model: env.anthropicModel,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      }),
    });
  } catch (err) {
    logger.warn('[gmail-sync] AI extract: request failed.', err?.message || '');
    return null;
  }

  if (!res.ok) {
    // Body may carry a Google/Anthropic error code; status alone is safe to log.
    logger.warn(`[gmail-sync] AI extract: API returned ${res.status}.`);
    return null;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  // Concatenate any text blocks → the JSON the model produced under the schema.
  const text = Array.isArray(json.content)
    ? json.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    : '';
  if (!text) return null;

  let parsed;
  try {
    parsed = ResultSchema.parse(JSON.parse(text));
  } catch {
    logger.warn('[gmail-sync] AI extract: response did not match the strict schema (skipped).');
    return null;
  }

  return toDraft(parsed);
}

/**
 * Optional AI category suggestion for a merchant when no rule matched.
 * Returns one of `allowedKeys` (strict enum), or null when disabled / invalid.
 * Graceful no-op when ANTHROPIC_API_KEY is unset. Reuses the same Messages API
 * + strict-JSON pattern as aiExtract; no email body is sent (merchant only).
 */
export async function aiSuggestCategory(merchant, direction, allowedKeys = []) {
  if (!env.anthropicApiKey) return null;
  if (!merchant || !Array.isArray(allowedKeys) || allowedKeys.length === 0) return null;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: { category: { type: 'string', enum: allowedKeys } },
    required: ['category'],
  };
  const system =
    'You assign ONE spending category to an Indian transaction merchant/description. ' +
    `Choose exactly one key from this fixed list: ${allowedKeys.join(', ')}. ` +
    'Use "other" only when nothing else fits. Respond with the category key only.';

  let res;
  try {
    res = await httpRequest(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      timeoutMs: 12000,
      body: JSON.stringify({
        model: env.anthropicModel,
        max_tokens: 64,
        system,
        messages: [{ role: 'user', content: `Merchant: ${merchant}\nDirection: ${direction}` }],
        output_config: { format: { type: 'json_schema', schema } },
      }),
    });
  } catch (err) {
    logger.warn('[gmail-sync] AI categorize: request failed.', err?.message || '');
    return null;
  }
  if (!res.ok) {
    logger.warn(`[gmail-sync] AI categorize: API returned ${res.status}.`);
    return null;
  }

  let json;
  try { json = await res.json(); } catch { return null; }
  const text = Array.isArray(json.content)
    ? json.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    : '';
  if (!text) return null;
  try {
    const { category } = JSON.parse(text);
    return allowedKeys.includes(category) ? category : null;
  } catch {
    return null;
  }
}
