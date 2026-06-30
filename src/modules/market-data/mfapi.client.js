import { httpGetJson } from '../../common/http/httpClient.js';
import { logger } from '../../common/logger/logger.js';

/**
 * MFAPI.in client (plain HTTP, no auth) with in-memory TTL cache.
 * - NAV endpoint: https://api.mfapi.in/mf/:schemeCode/latest  (cached 1h)
 * - Search:       https://api.mfapi.in/mf/search?q=           (cached 24h)
 */

const BASE = 'https://api.mfapi.in/mf';

const NAV_TTL_MS = 60 * 60 * 1000; // 1 hour — NAVs update once daily
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const cache = new Map(); // key -> { value, expiresAt }

function getCached(key) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (hit) cache.delete(key);
  return null;
}
function setCached(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

/** Latest NAV + scheme meta for a scheme code. Returns null on failure. */
export async function getNav(schemeCode) {
  const key = `nav:${schemeCode}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const json = await httpGetJson(`${BASE}/${encodeURIComponent(schemeCode)}/latest`);
    const latest = Array.isArray(json?.data) ? json.data[0] : null;
    const result = {
      schemeCode: String(schemeCode),
      schemeName: json?.meta?.scheme_name || '',
      fundHouse: json?.meta?.fund_house || '',
      category: json?.meta?.scheme_category || '',
      nav: latest ? Number(latest.nav) : null,
      date: latest?.date || null,
    };
    setCached(key, result, NAV_TTL_MS);
    return result;
  } catch (err) {
    logger.warn(`MFAPI NAV lookup failed for ${schemeCode}: ${err?.message || 'error'}`);
    return null;
  }
}

const RETURNS_TTL_MS = 6 * 60 * 60 * 1000; // 6h — return figures move slowly

// Curated "trending" funds (real MFAPI scheme codes) → returns computed live.
const TRENDING_SCHEMES = [
  { schemeCode: '120828', category: 'Small Cap', risk: 'High risk', riskBg: '#FFE9E5', riskFg: '#FF6B5E' },
  { schemeCode: '122639', category: 'Flexi Cap', risk: 'Moderate', riskBg: '#FFF4DB', riskFg: '#D99100' },
  { schemeCode: '118778', category: 'Small Cap', risk: 'High risk', riskBg: '#FFE9E5', riskFg: '#FF6B5E' },
  { schemeCode: '118825', category: 'Large Cap', risk: 'Moderate', riskBg: '#FFF4DB', riskFg: '#D99100' },
  { schemeCode: '120465', category: 'Large Cap', risk: 'Moderate', riskBg: '#FFF4DB', riskFg: '#D99100' },
  { schemeCode: '120251', category: 'Hybrid', risk: 'Low risk', riskBg: '#E6F8F1', riskFg: '#1FAE63' },
];

// Parse MFAPI's "dd-mm-yyyy" date → Date.
function parseMfDate(s) {
  const [d, m, y] = (s || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Compute a fund's trailing return % over ~`years` from full NAV history. */
function returnOver(data, years) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const latest = data[0];
  const latestNav = Number(latest.nav);
  const target = parseMfDate(latest.date);
  target.setFullYear(target.getFullYear() - years);
  // data is newest-first; find the first point at or before the target date.
  const past = data.find((row) => parseMfDate(row.date) <= target);
  if (!past) return null;
  const pastNav = Number(past.nav);
  if (!pastNav || !latestNav) return null;
  const pct = ((latestNav - pastNav) / pastNav) * 100;
  // Annualize multi-year returns (CAGR) so the badge reads "per year".
  const annual = years > 1 ? (Math.pow(latestNav / pastNav, 1 / years) - 1) * 100 : pct;
  return Number(annual.toFixed(1));
}

/** Trending funds with live 1Y/3Y returns, sorted by 3Y desc. Returns [] on failure. */
export async function getTrendingFunds() {
  const key = 'trending';
  const cached = getCached(key);
  if (cached) return cached;

  const rows = await Promise.all(
    TRENDING_SCHEMES.map(async (s) => {
      try {
        const json = await httpGetJson(`${BASE}/${s.schemeCode}`, { timeoutMs: 9000 });
        const data = Array.isArray(json?.data) ? json.data : [];
        const r1 = returnOver(data, 1);
        const r3 = returnOver(data, 3);
        return {
          schemeCode: s.schemeCode,
          name: json?.meta?.scheme_name || `Scheme ${s.schemeCode}`,
          fundHouse: json?.meta?.fund_house || '',
          category: s.category, risk: s.risk, riskBg: s.riskBg, riskFg: s.riskFg,
          return1y: r1, return3y: r3,
        };
      } catch (err) {
        logger.warn(`MFAPI trending fetch failed for ${s.schemeCode}: ${err?.message || 'error'}`);
        return null;
      }
    })
  );

  const list = rows
    .filter((r) => r && (r.return1y != null || r.return3y != null))
    .sort((a, b) => (b.return3y ?? b.return1y ?? -999) - (a.return3y ?? a.return1y ?? -999));

  if (list.length) setCached(key, list, RETURNS_TTL_MS);
  return list;
}

// Range → number of days of NAV history to return for the detail chart.
const FUND_RANGE_DAYS = { '1M': 30, '6M': 182, '1Y': 365, '3Y': 365 * 3, MAX: Infinity };
const FUND_HISTORY_TTL_MS = 60 * 60 * 1000; // 1h — NAVs update once daily

/**
 * Full fund detail for the trending-MF detail view: meta, latest NAV+date,
 * NAV history points for a range (oldest→newest, {t,c}), and computed trailing
 * returns (1Y/3Y/5Y annualized CAGR). Cached 1h. Returns null on failure.
 * `key` is `${schemeCode}:${range}`; the underlying NAV history is fetched once
 * per scheme and sliced per range.
 */
export async function getFundHistory(schemeCode, rangeKey = '1Y') {
  const cacheKey = `hist:${schemeCode}:${rangeKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const json = await httpGetJson(`${BASE}/${encodeURIComponent(schemeCode)}`, { timeoutMs: 9000 });
    const data = Array.isArray(json?.data) ? json.data : []; // newest-first
    if (data.length < 2) return null;

    const latest = data[0];
    const latestDate = parseMfDate(latest.date);
    const days = FUND_RANGE_DAYS[rangeKey] ?? 365;
    const cutoff = days === Infinity ? -Infinity : latestDate.getTime() - days * 86400000;

    // Build oldest→newest points within the range for the chart.
    const points = data
      .filter((row) => parseMfDate(row.date).getTime() >= cutoff)
      .map((row) => ({ t: parseMfDate(row.date).getTime(), c: Number(row.nav) }))
      .filter((p) => Number.isFinite(p.c))
      .sort((a, b) => a.t - b.t);

    const first = points[0]?.c;
    const last = points[points.length - 1]?.c;
    const vals = points.map((p) => p.c);

    const result = {
      schemeCode: String(schemeCode),
      name: json?.meta?.scheme_name || `Scheme ${schemeCode}`,
      fundHouse: json?.meta?.fund_house || '',
      category: json?.meta?.scheme_category || '',
      nav: latest ? Number(latest.nav) : null,
      date: latest?.date || null,
      points,
      windowChangePct: first && last ? Number((((last - first) / first) * 100).toFixed(2)) : null,
      high: vals.length ? Number(Math.max(...vals).toFixed(2)) : null,
      low: vals.length ? Number(Math.min(...vals).toFixed(2)) : null,
      // Trailing returns from the FULL history (annualized for >1y).
      return1y: returnOver(data, 1),
      return3y: returnOver(data, 3),
      return5y: returnOver(data, 5),
    };
    setCached(cacheKey, result, FUND_HISTORY_TTL_MS);
    return result;
  } catch (err) {
    logger.warn(`MFAPI history failed for ${schemeCode} (${rangeKey}): ${err?.message || 'error'}`);
    return null;
  }
}

/** Search funds by name. Returns [] on failure. */
export async function searchFunds(q) {
  const key = `search:${q.trim().toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const json = await httpGetJson(`${BASE}/search?q=${encodeURIComponent(q)}`);
    const results = Array.isArray(json)
      ? json.map((r) => ({ schemeCode: String(r.schemeCode), schemeName: r.schemeName }))
      : [];
    setCached(key, results, SEARCH_TTL_MS);
    return results;
  } catch (err) {
    logger.warn(`MFAPI search failed for "${q}": ${err?.message || 'error'}`);
    return [];
  }
}
