import { logger } from '../logger/logger.js';

/**
 * Defensive HTTP client for external integrations (MFAPI, Gmail, Graph, AA).
 * - Per-request timeout via AbortController.
 * - Retries with exponential backoff on network errors / 5xx / 429.
 * - Never logs response bodies (may contain financial payloads).
 */

const DEFAULTS = {
  timeoutMs: 8000,
  retries: 2,
  backoffMs: 400,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function httpRequest(url, options = {}) {
  const { timeoutMs, retries, backoffMs, ...fetchOpts } = { ...DEFAULTS, ...options };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
      clearTimeout(timer);

      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        lastErr = new Error(`Upstream ${res.status}`);
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
    }
  }
  logger.warn(`HTTP request failed after ${retries + 1} attempts: ${url}`);
  throw lastErr || new Error('HTTP request failed');
}

export async function httpGetJson(url, options = {}) {
  const res = await httpRequest(url, { ...options, method: 'GET' });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  return res.json();
}
