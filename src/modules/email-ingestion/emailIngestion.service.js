import { Account } from '../accounts/account.model.js';
import { createTransaction, recategorizeUncategorized } from '../transactions/transaction.service.js';
import * as connections from '../connections/connection.service.js';
import { fingerprint } from '../../common/crypto/cryptoService.js';
import { logger } from '../../common/logger/logger.js';
import { parseEmail } from './parsers/registry.js';
import { parseAvailableBalance } from './parsers/parseHelpers.js';
import { categorize, styleForCategory, CATEGORY_KEYS } from './categorize.js';
import { aiSuggestCategory } from './aiExtract.js';
import { listMessageIds, getMessage, buildBankQuery, countRecentMessages } from './gmailClient.js';
import { refreshGmailAccessToken, expiryFromNow } from './gmailOAuth.js';
import { allSenderDomains } from './bankSenders.js';
import { SAMPLE_BANK_EMAILS } from './fixtures/sampleBankEmails.js';

// First time we sync a freshly-connected inbox, back-fill this many days so we
// catch recent alerts (not just mail since "now"). Incremental syncs after that
// use the days-since-last-sync window.
const FIRST_RUN_BACKFILL_DAYS = 90;

/**
 * Email ingestion service — the shared core for both live Gmail sync and the
 * dev simulate path. Pipeline per email:
 *   parse (regex registry) → categorize → resolve account → fingerprint →
 *   idempotent create (source='email', status='needs_review').
 *
 * SECURITY: the raw email body never leaves this function. Only extracted
 * fields are persisted.
 *
 * IDEMPOTENCY / CROSS-INBOX DEDUPE: the fingerprint is derived purely from the
 * transaction's CONTENT (bank, account, amount, date, direction, merchant) and
 * NOT from the Gmail messageId. This means the SAME bank alert delivered to two
 * connected inboxes — which have different messageIds — collapses to one
 * transaction, and re-fetching the same inbox is a no-op. Trade-off: two
 * genuinely distinct transactions identical on all those fields would merge
 * (rare; standard expense-tracker behavior).
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dateLabel(date) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * Resolve (or lazily create) the bank account a parsed txn belongs to.
 * Match priority: parsed last-4 → bank name token → create a lightweight
 * bank account. Accounts are cached per ingestion run.
 */
async function resolveAccount(userId, bank, last4, cache) {
  if (!cache.accounts) {
    cache.accounts = await Account.find({ userId, type: 'bank' }).lean();
  }
  let acct = null;
  if (last4) acct = cache.accounts.find((a) => a.last4 && a.last4 === last4);
  if (!acct) {
    acct = cache.accounts.find((a) =>
      bank.accountMatch.some((tok) => a.name.toLowerCase().includes(tok)));
  }
  if (acct) return acct;

  // Lightweight bank account for a sender the user hasn't added yet.
  const created = await Account.create({
    userId, type: 'bank', name: bank.name, logo: bank.logo, color: bank.color,
    last4: last4 || '', subtype: 'Savings', order: 50 + cache.accounts.length,
    lastActivity: 'Just now',
  });
  const lean = created.toObject();
  cache.accounts.push(lean);
  return lean;
}

/**
 * Ingest a batch of in-memory emails. Returns a summary; never stores bodies.
 * @param {Array<{id,from,subject,body}>} emails
 */
export async function ingestEmails(userId, emails) {
  const summary = { total: emails.length, created: 0, duplicate: 0, failed: 0 };
  const cache = {};

  for (const email of emails) {
    const { bank, draft, reason, path } = await parseEmail(email);
    if (!draft) {
      summary.failed += 1;
      if (reason === 'unparsable' && bank) {
        logger.warn(`[gmail-sync] ${bank.name}: matched sender but no extractor (regex/generic/ai) could read it — skipped (needs_review not created).`);
      }
      continue;
    }

    // Authoritative "Avl Bal" from the alert text (covers regex/generic/ai
    // paths uniformly). When present, confirming this txn sets the bank's
    // balance to this exact value (see balance.service).
    const availableBalance = draft.availableBalance != null
      ? draft.availableBalance
      : parseAvailableBalance(`${email.subject || ''}\n${email.body || ''}`);

    // Per-email trace: which bank matched, which extraction path won, the amount.
    logger.info(`[gmail-sync] ${bank.name}: extracted via ${path} → ${draft.direction} ₹${draft.amount} "${draft.merchant}"${draft.last4 ? ` (••${draft.last4})` : ''}${availableBalance != null ? ` · Avl Bal ₹${availableBalance}` : ''}`);

    try {
      const account = await resolveAccount(userId, bank, draft.last4, cache);

      // 1) Rule-based merchant → category. 2) If it stayed uncategorized (a
      // debit with no keyword hit) and AI is configured, ask Claude to pick a
      // category from the allowed keys. Graceful no-op when no key is set.
      let style = categorize(draft.merchant, draft.direction);
      if (style.categorySource === 'default' && draft.direction === 'debit') {
        const aiKey = await aiSuggestCategory(draft.merchant, draft.direction, CATEGORY_KEYS);
        if (aiKey && aiKey !== 'other') {
          style = { categoryKey: aiKey, ...styleForCategory(aiKey), categorySource: 'ai' };
        }
      }

      const fp = fingerprint([
        userId.toString(), bank.key, draft.last4 || '', draft.amount,
        new Date(draft.occurredAt).toISOString(), draft.direction, draft.merchant,
      ]);

      const { deduped } = await createTransaction(userId, {
        accountId: account._id,
        accountName: account.name,
        source: 'email',
        status: 'needs_review',
        direction: draft.direction,
        amount: draft.amount,
        currency: 'INR',
        merchant: draft.merchant,
        categoryKey: style.categoryKey,
        categorySource: style.categorySource,
        icon: style.icon,
        iconBg: style.iconBg,
        occurredAt: draft.occurredAt,
        dateLabel: dateLabel(draft.occurredAt),
        availableBalance,
        balanceAsOf: availableBalance != null ? draft.occurredAt : null,
        fingerprint: fp,
      });

      if (deduped) summary.duplicate += 1;
      else summary.created += 1;
    } catch (err) {
      summary.failed += 1;
      logger.warn(`Email ingest: failed to store a parsed ${bank?.name || 'bank'} transaction.`, err?.message || '');
    }
  }

  // Backfill auto-categorization onto any older rows that predate this feature
  // (rule-based, cheap). Lets a normal "Sync now" also fix the existing review
  // queue without a separate action.
  try {
    summary.recategorized = await recategorizeUncategorized(userId);
    if (summary.recategorized) {
      logger.info(`[gmail-sync] backfilled categories on ${summary.recategorized} existing transaction(s).`);
    }
  } catch (err) {
    logger.warn('[gmail-sync] category backfill skipped.', err?.message || '');
  }

  return summary;
}

/** Dev/simulate: run the fixture emails through the real ingestion pipeline. */
export async function simulateIngest(userId) {
  return ingestEmails(userId, SAMPLE_BANK_EMAILS);
}

/** Skew (ms) before expiry at which we proactively refresh the access token. */
const TOKEN_SKEW_MS = 60 * 1000;

/**
 * Return a valid access token for a connection, refreshing only when needed.
 * Reuses the stored access token while it's still valid (expiry-aware), else
 * mints a fresh one from the refresh token. Returns the (possibly updated)
 * token bag + expiry so the caller can persist it.
 */
async function ensureAccessToken(connection, tokens) {
  const storedExp = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
  const stillValid = tokens.access_token && storedExp && storedExp - TOKEN_SKEW_MS > Date.now();

  if (stillValid) {
    return { accessToken: tokens.access_token, tokens, tokenExpiresAt: connection.tokenExpiresAt };
  }

  const refreshed = await refreshGmailAccessToken(tokens.refresh_token);
  const tokenExpiresAt = expiryFromNow(refreshed.expires_in);
  const nextTokens = { ...tokens, access_token: refreshed.access_token };
  return { accessToken: refreshed.access_token, tokens: nextTokens, tokenExpiresAt };
}

/**
 * Live Gmail sync for one connection: ensure a valid access token (refresh
 * only when expired) → list bank messages since last sync → fetch & parse →
 * ingest → persist token/expiry + bump lastSyncedAt.
 */
export async function syncGmailConnection(userId, connection) {
  const tokens = await connections.getConnectionTokens(userId, connection._id);
  if (!tokens?.refresh_token) {
    throw new Error('NO_REFRESH_TOKEN');
  }

  const { accessToken, tokens: nextTokens, tokenExpiresAt } =
    await ensureAccessToken(connection, tokens);

  const label = connection.emailAddress || connection.label || 'inbox';

  // Window: first sync of a new inbox back-fills FIRST_RUN_BACKFILL_DAYS;
  // afterwards it's the days since last sync (min 1).
  const since = connection.lastSyncedAt ? new Date(connection.lastSyncedAt) : null;
  const days = since
    ? Math.max(1, Math.ceil((Date.now() - since.getTime()) / 86400000) + 1)
    : FIRST_RUN_BACKFILL_DAYS;

  // The EXACT Gmail search used — only monitored bank senders, within the window.
  const q = buildBankQuery(days);
  logger.info(`[gmail-sync] ${label}: window=${days}d q="${q}"`);

  const { ids, estimate } = await listMessageIds(accessToken, { q, max: 50 });
  logger.info(`[gmail-sync] ${label}: Gmail matched ${ids.length} candidate message id(s) (estimate≈${estimate}).`);

  // If the bank filter matched nothing, prove read access works (count-only,
  // no bodies) so we can tell "inbox unreadable" apart from "no bank alerts".
  if (ids.length === 0) {
    try {
      const recent = await countRecentMessages(accessToken, { days });
      logger.info(`[gmail-sync] ${label}: 0 bank-sender matches, but ~${recent} total message(s) in last ${days}d → read access OK. This inbox has no alerts from monitored senders: ${allSenderDomains().join(', ')}.`);
    } catch (err) {
      logger.warn(`[gmail-sync] ${label}: read-access probe failed.`, err?.message || '');
    }
  }

  const emails = [];
  for (const id of ids) {
    try {
      emails.push(await getMessage(accessToken, id));
    } catch (err) {
      logger.warn('Gmail: failed to fetch a message (skipped).', err?.message || '');
    }
  }
  logger.info(`[gmail-sync] ${label}: fetched ${emails.length} email(s); running parser registry…`);

  const summary = await ingestEmails(userId, emails);
  logger.info(`[gmail-sync] ${label}: done — total=${summary.total} created=${summary.created} duplicate=${summary.duplicate} failed=${summary.failed} (total=candidates fetched; failed=fetched-but-no-regex-match).`);

  // Persist the access token + expiry and bump sync time.
  await connections.recordSync(userId, connection._id, { tokens: nextTokens, tokenExpiresAt });

  return summary;
}

/**
 * Sync EVERY active Gmail connection for one user, aggregating results. Each
 * inbox is isolated: a failure on one (e.g. needs reconnect) marks that
 * connection 'error' and is reported, but does not abort the others.
 * Cross-inbox dedupe is handled by the content fingerprint in ingestEmails.
 */
export async function syncAllGmailForUser(userId) {
  const conns = await connections.listConnectionsByKind(userId, 'gmail', { status: 'connected' });
  const totals = { connections: conns.length, created: 0, duplicate: 0, failed: 0, errors: 0 };
  const perAccount = [];

  for (const conn of conns) {
    try {
      const s = await syncGmailConnection(userId, conn);
      totals.created += s.created;
      totals.duplicate += s.duplicate;
      totals.failed += s.failed;
      perAccount.push({ id: String(conn._id), email: conn.emailAddress || conn.label, ...s });
    } catch (err) {
      totals.errors += 1;
      await connections.markConnectionError(userId, conn._id);
      perAccount.push({
        id: String(conn._id), email: conn.emailAddress || conn.label,
        error: err?.message === 'NO_REFRESH_TOKEN' ? 'reconnect_needed' : 'sync_failed',
      });
      logger.warn('Gmail sync-all: a connection failed.', err?.message || '');
    }
  }

  return { ...totals, perAccount };
}
