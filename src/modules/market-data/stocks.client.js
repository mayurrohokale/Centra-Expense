import { httpGetJson } from '../../common/http/httpClient.js';
import { logger } from '../../common/logger/logger.js';

/**
 * Live equity quotes from Yahoo Finance's public endpoints (no auth/key).
 *  - Quote:  /v8/finance/chart/{symbol}        → regularMarketPrice + prevClose
 *  - Search: /v1/finance/search?q=             → symbol lookup
 *
 * Indian symbols use the NSE ".NS" suffix (e.g. RELIANCE.NS); US symbols are
 * plain tickers (AAPL). A browser-like User-Agent avoids occasional blocks.
 * Defensive: per-symbol failures are skipped, never crash the response.
 */

const QUOTE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const SEARCH_BASE = 'https://query1.finance.yahoo.com/v1/finance/search';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const QUOTE_TTL_MS = 120 * 1000; // 2 min — eases Yahoo rate limits across users
const SEARCH_TTL_MS = 10 * 60 * 1000;

const cache = new Map(); // key -> { value, expiresAt }
const getCached = (k) => {
  const h = cache.get(k);
  if (h && h.expiresAt > Date.now()) return h.value;
  if (h) cache.delete(k);
  return null;
};
const setCached = (k, v, ttl) => cache.set(k, { value: v, expiresAt: Date.now() + ttl });

// Curated "popular" lists. Indian large-caps (NSE) + global giants.
export const STOCK_GROUPS = {
  indian: [
    { symbol: 'RELIANCE.NS', name: 'Reliance', tag: 'RIL', color: '#0050A0' },
    { symbol: 'TCS.NS', name: 'TCS', tag: 'TCS', color: '#1c3f94' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', tag: 'HDFC', color: '#004c8f' },
    { symbol: 'INFY.NS', name: 'Infosys', tag: 'INFY', color: '#007cc3' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', tag: 'ICICI', color: '#F47216' },
    { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', tag: 'TATA', color: '#1c4ca0' },
  ],
  global: [
    { symbol: 'AAPL', name: 'Apple', tag: 'AAPL', color: '#1d1d1f' },
    { symbol: 'GOOGL', name: 'Alphabet', tag: 'GOOG', color: '#4285F4' },
    { symbol: 'META', name: 'Meta', tag: 'META', color: '#0866FF' },
    { symbol: 'MSFT', name: 'Microsoft', tag: 'MSFT', color: '#00A4EF' },
    { symbol: 'AMZN', name: 'Amazon', tag: 'AMZN', color: '#FF9900' },
    { symbol: 'NVDA', name: 'Nvidia', tag: 'NVDA', color: '#76B900' },
    { symbol: 'TSLA', name: 'Tesla', tag: 'TSLA', color: '#E82127' },
  ],
};

// Privately-held names users may ask for — not publicly traded.
export const PRIVATE_GIANTS = [
  { name: 'SpaceX', note: 'Private — not publicly listed' },
  { name: 'X (Twitter)', note: 'Private — taken private in 2022' },
  { name: 'OpenAI', note: 'Private — not publicly listed' },
];

/** Fetch one symbol's live quote via the chart endpoint. Returns null on failure. */
async function fetchQuote(symbol) {
  const key = `q:${symbol}`;
  const cached = getCached(key);
  if (cached) return cached;
  try {
    const json = await httpGetJson(
      `${QUOTE_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { timeoutMs: 8000, headers: { 'User-Agent': UA, Accept: 'application/json' } }
    );
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
    const price = meta.regularMarketPrice;
    const prev = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : (meta.previousClose ?? null);
    const changePct = prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : null;
    const result = {
      symbol: meta.symbol || symbol,
      price: Number(price.toFixed(2)),
      currency: meta.currency || (symbol.endsWith('.NS') ? 'INR' : 'USD'),
      changePct,
      marketName: meta.shortName || '',
    };
    setCached(key, result, QUOTE_TTL_MS);
    return result;
  } catch (err) {
    logger.warn(`Yahoo quote failed for ${symbol}: ${err?.message || 'error'}`);
    return null;
  }
}

/** Curated group ('indian' | 'global') merged with live quotes. */
export async function getStockGroup(group) {
  const defs = STOCK_GROUPS[group] || [];
  const quotes = await Promise.all(defs.map((d) => fetchQuote(d.symbol)));
  return defs
    .map((d, i) => (quotes[i] ? { ...d, ...quotes[i] } : null))
    .filter(Boolean);
}

/** Live quote for an arbitrary symbol (used after a search selection). */
export async function getQuote(symbol) {
  return fetchQuote(symbol);
}

// Range → Yahoo {range, interval}. Works for equities AND crypto (BTC-USD).
const RANGE_MAP = {
  '1W': { range: '5d', interval: '60m' },
  '1M': { range: '1mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
};
const HISTORY_TTL_MS = 5 * 60 * 1000;

/**
 * Historical price series for a symbol over a range. Returns
 * { symbol, name, currency, price, points:[{t,c}], windowChangePct, high, low }
 * or null on failure. Used by the instrument detail page's chart.
 */
export async function getHistory(symbol, rangeKey = '1M') {
  const r = RANGE_MAP[rangeKey] || RANGE_MAP['1M'];
  const key = `h:${symbol}:${rangeKey}`;
  const cached = getCached(key);
  if (cached) return cached;
  try {
    const json = await httpGetJson(
      `${QUOTE_BASE}/${encodeURIComponent(symbol)}?interval=${r.interval}&range=${r.range}`,
      { timeoutMs: 9000, headers: { 'User-Agent': UA, Accept: 'application/json' } }
    );
    const res0 = json?.chart?.result?.[0];
    const meta = res0?.meta;
    const ts = res0?.timestamp || [];
    const closes = res0?.indicators?.quote?.[0]?.close || [];
    if (!meta || ts.length === 0) return null;

    const points = ts
      .map((t, i) => ({ t: t * 1000, c: closes[i] }))
      .filter((p) => typeof p.c === 'number');
    if (points.length < 2) return null;

    const first = points[0].c;
    const last = points[points.length - 1].c;
    const vals = points.map((p) => p.c);
    const result = {
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || meta.symbol || symbol,
      currency: meta.currency || (symbol.endsWith('.NS') ? 'INR' : 'USD'),
      price: typeof meta.regularMarketPrice === 'number' ? Number(meta.regularMarketPrice.toFixed(2)) : last,
      windowChangePct: first ? Number((((last - first) / first) * 100).toFixed(2)) : null,
      high: Number(Math.max(...vals).toFixed(2)),
      low: Number(Math.min(...vals).toFixed(2)),
      points,
    };
    setCached(key, result, HISTORY_TTL_MS);
    return result;
  } catch (err) {
    logger.warn(`Yahoo history failed for ${symbol} (${rangeKey}): ${err?.message || 'error'}`);
    return null;
  }
}

// Map Yahoo quoteType → our friendly instrument type + label.
const TYPE_MAP = {
  EQUITY: { type: 'equity', label: 'Stock' },
  ETF: { type: 'etf', label: 'ETF' },
  CRYPTOCURRENCY: { type: 'crypto', label: 'Crypto' },
};

/**
 * Unified instrument search across crypto + global/Indian stocks + ETFs.
 * Returns up to 10 matches, each tagged with `type` (crypto|equity|etf) so the
 * UI can badge and route them. Crypto symbols come back like "BTC-USD".
 */
export async function searchStocks(q) {
  const term = q.trim();
  if (!term) return [];
  const key = `s:${term.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;
  try {
    const json = await httpGetJson(
      `${SEARCH_BASE}?q=${encodeURIComponent(term)}&quotesCount=12&newsCount=0`,
      { timeoutMs: 8000, headers: { 'User-Agent': UA, Accept: 'application/json' } }
    );
    const results = (json?.quotes || [])
      .filter((r) => r.symbol && TYPE_MAP[r.quoteType])
      .slice(0, 10)
      .map((r) => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        exchange: r.exchDisp || r.exchange || '',
        type: TYPE_MAP[r.quoteType].type,
        typeLabel: TYPE_MAP[r.quoteType].label,
      }));
    setCached(key, results, SEARCH_TTL_MS);
    return results;
  } catch (err) {
    logger.warn(`Yahoo search failed for "${term}": ${err?.message || 'error'}`);
    return [];
  }
}
