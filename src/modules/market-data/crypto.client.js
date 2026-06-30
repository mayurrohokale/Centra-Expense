import { httpGetJson } from '../../common/http/httpClient.js';
import { logger } from '../../common/logger/logger.js';

/**
 * Live crypto prices from CoinGecko's public API (no auth).
 * Endpoint: /simple/price?ids=...&vs_currencies=usd&include_24hr_change=true
 * Quoted in USD (global crypto convention). Cached ~60s to stay within limits.
 */

const BASE = 'https://api.coingecko.com/api/v3';
const TTL_MS = 45 * 1000; // spot price freshness — matches the client poll cadence

// id → display metadata. `id` is CoinGecko's id; `tag` is the ticker badge;
// `symbol` is a Yahoo-style symbol (kept for search/labels). The detail chart
// now uses CoinGecko's market_chart keyed by `id`.
const COINS = [
  { id: 'bitcoin', tag: 'BTC', name: 'Bitcoin', symbol: 'BTC-USD', bg: 'linear-gradient(140deg,#F7931A,#FFB347)' },
  { id: 'ethereum', tag: 'ETH', name: 'Ethereum', symbol: 'ETH-USD', bg: 'linear-gradient(140deg,#627EEA,#8FA2F5)' },
  { id: 'binancecoin', tag: 'BNB', name: 'BNB', symbol: 'BNB-USD', bg: 'linear-gradient(140deg,#F3BA2F,#F8D88B)' },
  { id: 'solana', tag: 'SOL', name: 'Solana', symbol: 'SOL-USD', bg: 'linear-gradient(140deg,#9945FF,#14F195)' },
  { id: 'ripple', tag: 'XRP', name: 'XRP', symbol: 'XRP-USD', bg: 'linear-gradient(140deg,#23292F,#5b6770)' },
  { id: 'cardano', tag: 'ADA', name: 'Cardano', symbol: 'ADA-USD', bg: 'linear-gradient(140deg,#0033AD,#3468dc)' },
  { id: 'dogecoin', tag: 'DOGE', name: 'Dogecoin', symbol: 'DOGE-USD', bg: 'linear-gradient(140deg,#C2A633,#e0c862)' },
];

// Map a Yahoo-style crypto symbol (e.g. "BTC-USD") OR a bare ticker/id to a
// CoinGecko id, so the detail chart can be opened from either the cards (symbol)
// or a search result.
const SYMBOL_TO_ID = COINS.reduce((m, c) => {
  m[c.symbol.toUpperCase()] = c.id;
  m[c.tag.toUpperCase()] = c.id;
  m[c.id.toUpperCase()] = c.id;
  return m;
}, {});
export function coinIdForSymbol(symbol) {
  if (!symbol) return null;
  const s = String(symbol).toUpperCase();
  return SYMBOL_TO_ID[s] || (s.endsWith('-USD') ? SYMBOL_TO_ID[s] : null);
}

let cache = null; // { value, expiresAt }

export async function getCryptoPrices() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const ids = COINS.map((c) => c.id).join(',');
  try {
    const json = await httpGetJson(
      `${BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { timeoutMs: 9000 }
    );
    const list = COINS.map((c) => {
      const row = json?.[c.id] || {};
      const price = typeof row.usd === 'number' ? row.usd : null;
      const change = typeof row.usd_24h_change === 'number' ? row.usd_24h_change : null;
      return {
        id: c.id, tag: c.tag, name: c.name, bg: c.bg, symbol: c.symbol,
        priceUsd: price,
        change24h: change == null ? null : Number(change.toFixed(2)),
      };
    }).filter((c) => c.priceUsd != null);

    cache = { value: list, expiresAt: Date.now() + TTL_MS };
    return list;
  } catch (err) {
    logger.warn(`CoinGecko price fetch failed: ${err?.message || 'error'}`);
    if (cache) return cache.value; // serve stale rather than nothing
    return [];
  }
}

// Spot-price cache for ARBITRARY coin ids (used to value manual crypto
// holdings). Keyed per id so different holdings share fetches.
const spotCache = new Map(); // id -> { usd, expiresAt }
const SPOT_TTL_MS = 45 * 1000;

/**
 * USD spot price for a set of CoinGecko ids → { [id]: number|null }. Cached per
 * id (~45s). On failure for an id, serves the last cached value or null. Never
 * throws — callers fall back to cost/last value.
 */
export async function getSpotPricesForIds(ids = []) {
  const wanted = [...new Set(ids.filter(Boolean).map((s) => String(s).toLowerCase()))];
  const out = {};
  const stale = [];
  for (const id of wanted) {
    const hit = spotCache.get(id);
    if (hit && hit.expiresAt > Date.now()) out[id] = hit.usd;
    else stale.push(id);
  }
  if (stale.length === 0) return out;

  try {
    const json = await httpGetJson(
      `${BASE}/simple/price?ids=${encodeURIComponent(stale.join(','))}&vs_currencies=usd`,
      { timeoutMs: 9000 }
    );
    for (const id of stale) {
      const usd = typeof json?.[id]?.usd === 'number' ? json[id].usd : null;
      if (usd != null) {
        spotCache.set(id, { usd, expiresAt: Date.now() + SPOT_TTL_MS });
        out[id] = usd;
      } else {
        out[id] = spotCache.get(id)?.usd ?? null; // keep stale if we had it
      }
    }
  } catch (err) {
    logger.warn(`CoinGecko spot batch failed: ${err?.message || 'error'}`);
    for (const id of stale) out[id] = spotCache.get(id)?.usd ?? null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Live USD→INR FX rate (keyless), used to convert crypto USD values into ₹ for
// the portfolio rollup. Cached 1h; serves stale or a sane fallback on failure;
// never throws.
// ---------------------------------------------------------------------------
const FX_FALLBACK = 83; // sane default if every source fails
const FX_TTL_MS = 60 * 60 * 1000; // 1h
let fxCache = null; // { rate, expiresAt }

export async function getUsdInrRate() {
  if (fxCache && fxCache.expiresAt > Date.now()) return fxCache.rate;

  // Source 1: derive from CoinGecko (same base, already wired) — tether (a USD
  // stablecoin ≈ $1) priced in INR ≈ the USD→INR rate.
  try {
    const json = await httpGetJson(
      `${BASE}/simple/price?ids=tether&vs_currencies=inr`,
      { timeoutMs: 7000, retries: 1 }
    );
    const r = json?.tether?.inr;
    if (typeof r === 'number' && r > 50 && r < 200) {
      fxCache = { rate: r, expiresAt: Date.now() + FX_TTL_MS };
      return r;
    }
  } catch (err) {
    logger.warn(`FX via CoinGecko failed: ${err?.message || 'error'}`);
  }

  // Source 2: open.er-api.com (keyless FX).
  try {
    const json = await httpGetJson(
      'https://open.er-api.com/v6/latest/USD',
      { timeoutMs: 7000, retries: 1 }
    );
    const r = json?.rates?.INR;
    if (typeof r === 'number' && r > 50 && r < 200) {
      fxCache = { rate: r, expiresAt: Date.now() + FX_TTL_MS };
      return r;
    }
  } catch (err) {
    logger.warn(`FX via open.er-api failed: ${err?.message || 'error'}`);
  }

  // Fallback: last cached rate (even if expired) or the constant.
  return fxCache?.rate ?? FX_FALLBACK;
}

// Range → CoinGecko market_chart `days`. 24h/7d/30d per the product spec.
const HIST_RANGE = {
  '24h': { days: 1 },
  '7d': { days: 7 },
  '30d': { days: 30 },
};
const HIST_TTL_MS = 2 * 60 * 1000; // 2 min — history doesn't need to be as live as spot
const histCache = new Map(); // key -> { value, expiresAt }

/**
 * Historical price series for a coin over a range, from CoinGecko's
 * /coins/{id}/market_chart (prices in USD). Returns:
 *   { id, name, currency:'USD', price, points:[{t,c}], windowChangePct,
 *     high, low, updatedAt }
 * or null on failure. `key` is a CoinGecko id OR a symbol (BTC-USD / BTC).
 */
export async function getCryptoHistory(key, rangeKey = '7d') {
  const id = coinIdForSymbol(key) || (typeof key === 'string' ? key.toLowerCase() : null);
  if (!id) return null;
  const meta = COINS.find((c) => c.id === id);
  const r = HIST_RANGE[rangeKey] || HIST_RANGE['7d'];
  const cacheKey = `${id}:${rangeKey}`;
  const hit = histCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    const json = await httpGetJson(
      `${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${r.days}`,
      { timeoutMs: 9000 }
    );
    const raw = Array.isArray(json?.prices) ? json.prices : [];
    const points = raw
      .filter((p) => Array.isArray(p) && typeof p[1] === 'number')
      .map((p) => ({ t: p[0], c: Number(p[1]) }));
    if (points.length < 2) {
      if (hit) return hit.value; // serve stale rather than nothing
      return null;
    }
    const first = points[0].c;
    const last = points[points.length - 1].c;
    const vals = points.map((p) => p.c);
    const result = {
      id,
      name: meta?.name || id,
      currency: 'USD',
      price: Number(last.toFixed(last < 1 ? 4 : 2)),
      windowChangePct: first ? Number((((last - first) / first) * 100).toFixed(2)) : null,
      high: Number(Math.max(...vals).toFixed(2)),
      low: Number(Math.min(...vals).toFixed(2)),
      points,
      updatedAt: Date.now(),
    };
    histCache.set(cacheKey, { value: result, expiresAt: Date.now() + HIST_TTL_MS });
    return result;
  } catch (err) {
    logger.warn(`CoinGecko history failed for ${id} (${rangeKey}): ${err?.message || 'error'}`);
    if (hit) return hit.value; // serve last cached on failure
    return null;
  }
}
