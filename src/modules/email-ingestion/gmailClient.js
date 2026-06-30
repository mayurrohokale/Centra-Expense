import { httpRequest } from '../../common/http/httpClient.js';
import { allSenderDomains } from './bankSenders.js';

/**
 * Minimal Gmail REST client (users.messages.list/get) over the shared,
 * defensive httpClient — no heavy SDK. Returns lightweight in-memory email
 * objects { id, from, subject, body, date }. The body is decoded only to feed
 * the parser; it is NEVER returned to the caller's storage layer.
 */

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Gmail search query: only bank senders, newer_than N days. */
export function buildBankQuery(days = 30) {
  const senders = allSenderDomains().map((d) => `from:${d}`).join(' OR ');
  return `(${senders}) newer_than:${Math.max(1, days)}d`;
}

/**
 * Generic message-id lister for an arbitrary Gmail search query. Returns the
 * ids AND Gmail's resultSizeEstimate so callers can log "found N" precisely.
 */
export async function listMessageIds(accessToken, { q, max = 50 } = {}) {
  const params = new URLSearchParams({ q, maxResults: String(max) });
  const res = await httpRequest(`${API}/messages?${params}`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`GMAIL_LIST_FAILED_${res.status}`);
  const json = await res.json();
  return { ids: (json.messages || []).map((m) => m.id), estimate: json.resultSizeEstimate ?? null };
}

/** List message ids matching the bank-sender query (capped). */
export async function listBankMessageIds(accessToken, { days = 30, max = 50 } = {}) {
  const { ids } = await listMessageIds(accessToken, { q: buildBankQuery(days), max });
  return ids;
}

/**
 * Read-access probe (count only, no bodies fetched): how many messages exist
 * in the window from ANY sender. Used to prove Gmail read works when the
 * bank-sender filter legitimately matches nothing.
 */
export async function countRecentMessages(accessToken, { days = 90 } = {}) {
  const { estimate, ids } = await listMessageIds(accessToken, { q: `newer_than:${Math.max(1, days)}d`, max: 1 });
  return estimate ?? ids.length;
}

/** Fetch one message and decode it into an in-memory email object. */
export async function getMessage(accessToken, id) {
  const res = await httpRequest(`${API}/messages/${id}?format=full`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`GMAIL_GET_FAILED_${res.status}`);
  const msg = await res.json();
  const headers = msg.payload?.headers || [];
  const header = (name) => (headers.find((h) => h.name.toLowerCase() === name) || {}).value || '';
  return {
    id: msg.id,
    from: header('from'),
    subject: header('subject'),
    date: header('date'),
    body: extractPlainText(msg.payload),
  };
}

/** Walk the MIME tree and return decoded plain text (HTML stripped as fallback). */
export function extractPlainText(payload) {
  if (!payload) return '';
  const plain = findPart(payload, 'text/plain');
  if (plain) return decodeB64Url(plain);
  const html = findPart(payload, 'text/html');
  if (html) return stripHtml(decodeB64Url(html));
  if (payload.body?.data) return decodeB64Url(payload.body.data);
  return '';
}

function findPart(payload, mime) {
  if (payload.mimeType === mime && payload.body?.data) return payload.body.data;
  for (const part of payload.parts || []) {
    const found = findPart(part, mime);
    if (found) return found;
  }
  return null;
}

function decodeB64Url(data) {
  try {
    return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
