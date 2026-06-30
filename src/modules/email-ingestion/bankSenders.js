/**
 * Per-bank metadata for the email ingestion pipe.
 *
 * `senderDomains` drives the Gmail `from:(...)` query AND the parser registry
 * lookup (sender domain → bank). `accountMatch` are case-insensitive name
 * tokens used to link a parsed transaction to one of the user's bank accounts
 * (we also try the parsed last-4 first). `logo`/`color` are used only when we
 * have to create a lightweight bank account for a sender the user hasn't added.
 *
 * Domain coverage (2026): each bank lists BOTH legacy domains AND the new
 * RBI-mandated `.bank.in` banking domain (rolled out 2025-2026). Keep legacy
 * domains so nothing regresses; where the exact `.bank.in` spelling is
 * uncertain we add the most likely form alongside the legacy domain.
 *
 * Add a bank by: (1) appending an entry here, (2) OPTIONALLY adding a per-bank
 * parser file + registering it in parsers/registry.js. A bank with no per-bank
 * parser still works — the generic extractor (parsers/generic.parser.js) and
 * the AI fallback handle it.
 */

export const BANKS = [
  {
    key: 'hdfc',
    name: 'HDFC Bank',
    logo: 'H',
    color: '#0050A0',
    senderDomains: ['hdfcbank.bank.in', 'hdfcbank.net', 'hdfcbank.com', 'hdfcbank.com.in'],
    accountMatch: ['hdfc'],
  },
  {
    key: 'icici',
    name: 'ICICI Bank',
    logo: 'I',
    color: '#F47216',
    senderDomains: ['icicibank.bank.in', 'icicibank.com', 'icicibank.co.in'],
    accountMatch: ['icici'],
  },
  {
    key: 'sbi',
    name: 'SBI',
    logo: 'S',
    color: '#22409A',
    senderDomains: ['sbi.bank.in', 'sbi.co.in', 'alerts.sbi.co.in', 'sbicard.com', 'onlinesbi.sbi'],
    accountMatch: ['sbi', 'state bank'],
  },
  {
    key: 'axis',
    name: 'Axis Bank',
    logo: 'A',
    color: '#97144D',
    senderDomains: ['axisbank.bank.in', 'axisbank.com'],
    accountMatch: ['axis'],
  },
  {
    key: 'kotak',
    name: 'Kotak',
    logo: 'K',
    color: '#ED1C24',
    senderDomains: ['kotak.bank.in', 'kotak.com', 'kotakbank.com', 'kotak.net'],
    accountMatch: ['kotak'],
  },
  {
    key: 'pnb',
    name: 'Punjab National Bank',
    logo: 'P',
    color: '#A6202B',
    senderDomains: ['pnb.bank.in', 'pnb.co.in', 'pnbindia.in', 'pnbmail.in'],
    accountMatch: ['pnb', 'punjab national'],
  },
  {
    key: 'bob',
    name: 'Bank of Baroda',
    logo: 'B',
    color: '#F4811F',
    senderDomains: ['bankofbaroda.bank.in', 'bankofbaroda.com', 'bankofbaroda.co.in', 'bobibanking.com'],
    accountMatch: ['baroda', 'bob'],
  },
  {
    key: 'yes',
    name: 'Yes Bank',
    logo: 'Y',
    color: '#00518F',
    senderDomains: ['yesbank.bank.in', 'yesbank.in', 'yesbank.com'],
    accountMatch: ['yes bank'],
  },
  {
    key: 'indusind',
    name: 'IndusInd Bank',
    logo: 'In',
    color: '#9B2242',
    senderDomains: ['indusind.bank.in', 'indusind.com'],
    accountMatch: ['indusind'],
  },
  {
    key: 'idfc',
    name: 'IDFC First Bank',
    logo: 'ID',
    color: '#9C1D26',
    senderDomains: ['idfcfirstbank.bank.in', 'idfcfirstbank.com', 'idfcbank.com'],
    accountMatch: ['idfc'],
  },
  {
    key: 'canara',
    name: 'Canara Bank',
    logo: 'C',
    color: '#00529B',
    senderDomains: ['canarabank.bank.in', 'canarabank.com', 'canarabank.in'],
    accountMatch: ['canara'],
  },
  {
    key: 'union',
    name: 'Union Bank of India',
    logo: 'U',
    color: '#E11B22',
    senderDomains: ['unionbankofindia.bank.in', 'unionbankofindia.com', 'unionbankofindia.co.in'],
    accountMatch: ['union bank'],
  },
];

export const BANK_BY_KEY = Object.fromEntries(BANKS.map((b) => [b.key, b]));

/** Flat, de-duplicated list of every monitored sender domain (for the Gmail query). */
export function allSenderDomains() {
  return [...new Set(BANKS.flatMap((b) => b.senderDomains))];
}

/**
 * Resolve the bank for a raw `From` header, matching on the DOMAIN so any
 * sender at that domain is captured (alerts@, cc.alerts@, no-reply@, …) and any
 * subdomain too (e.g. `mailers.hdfcbank.bank.in`). Boundary-safe: `axisbank.com`
 * matches `x@axisbank.com` and `x@a.axisbank.com` but NOT `x@myaxisbank.com`.
 */
export function bankForSender(fromHeader = '') {
  const lower = String(fromHeader).toLowerCase();
  const domain = (lower.match(/@([a-z0-9.-]+)/) || [])[1] || lower;
  return BANKS.find((b) =>
    b.senderDomains.some((d) => domain === d || domain.endsWith(`.${d}`))
  ) || null;
}
