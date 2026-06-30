import { httpGetJson } from '../../common/http/httpClient.js';
import { logger } from '../../common/logger/logger.js';

/**
 * Live crypto prices from CoinGecko's public API (no auth).
 * Endpoint: /simple/price?ids=...&vs_currencies=usd&include_24hr_change=true
 * Quoted in USD (global crypto convention). Cached ~60s to stay within limits.
 */

const BASE = 'https://api.coingecko.com/api/v3';
const TTL_MS = 60 * 1000;

// id → display metadata. `id` is CoinGecko's id; `tag` is the ticker badge;
// `symbol` is the Yahoo symbol used by the detail page's history chart.
const COINS = [
  { id: 'bitcoin', tag: 'BTC', name: 'Bitcoin', symbol: 'BTC-USD', bg: 'linear-gradient(140deg,#F7931A,#FFB347)' },
  { id: 'ethereum', tag: 'ETH', name: 'Ethereum', symbol: 'ETH-USD', bg: 'linear-gradient(140deg,#627EEA,#8FA2F5)' },
  { id: 'binancecoin', tag: 'BNB', name: 'BNB', symbol: 'BNB-USD', bg: 'linear-gradient(140deg,#F3BA2F,#F8D88B)' },
  { id: 'solana', tag: 'SOL', name: 'Solana', symbol: 'SOL-USD', bg: 'linear-gradient(140deg,#9945FF,#14F195)' },
  { id: 'ripple', tag: 'XRP', name: 'XRP', symbol: 'XRP-USD', bg: 'linear-gradient(140deg,#23292F,#5b6770)' },
  { id: 'cardano', tag: 'ADA', name: 'Cardano', symbol: 'ADA-USD', bg: 'linear-gradient(140deg,#0033AD,#3468dc)' },
  { id: 'dogecoin', tag: 'DOGE', name: 'Dogecoin', symbol: 'DOGE-USD', bg: 'linear-gradient(140deg,#C2A633,#e0c862)' },
];

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
        tag: c.tag, name: c.name, bg: c.bg, symbol: c.symbol,
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
