---
name: live-market-data
description: Discover tab now shows realtime crypto/stocks/mutual-fund data from public no-auth APIs (CoinGecko, Yahoo Finance, MFAPI)
metadata:
  type: project
---

Discover's crypto, stocks, and mutual-fund sections are now **live from public no-auth APIs** (replaced the static `discover.data.js` content; only FD rates stay curated — no public FD API).

**Sources & clients** (`src/modules/market-data/`):
- `crypto.client.js` — CoinGecko `simple/price?vs_currencies=usd&include_24hr_change=true` for BTC/ETH/BNB/SOL/XRP/ADA/DOGE. **Quoted in USD** (`priceUsd`) per user request. Cache 60s. Serves stale-on-error.
- `stocks.client.js` — Yahoo Finance **chart** endpoint `/v8/finance/chart/{symbol}` for quotes (regularMarketPrice + chartPreviousClose → changePct); `/v1/finance/search` for search. Indian = NSE `.NS` suffix (INR), US = plain ticker (USD), crypto = `BTC-USD`. Needs browser `User-Agent`. Curated groups: indian (RELIANCE/TCS/HDFCBANK/INFY/ICICIBANK/TATAMOTORS .NS) + global (AAPL/GOOGL/META/MSFT/AMZN/NVDA/TSLA). `PRIVATE_GIANTS` (SpaceX/X/OpenAI) shown as "not publicly traded". `searchStocks` is **unified** — returns crypto + equity + etf (filter keys `TYPE_MAP`; each result tagged `type`/`typeLabel`); the chart quote endpoint resolves crypto symbols too. Quote cache **120s** (rate-limit easing). Per-symbol failures filtered out (Promise.all), never crash.
- `mfapi.client.js` `getTrendingFunds()` — fetches full NAV history per curated scheme code, computes **real 1Y return + 3Y CAGR** (`returnOver()` parses "dd-mm-yyyy", newest-first), sorts by 3Y desc. Cache 6h.

**Routes** (no DB / no auth, like other market routes): `GET /api/market/crypto`, `/api/market/stocks` (`?group=indian|global`), `/api/market/stocks/search` (`?q=` or `?symbol=`), `/api/market/stocks/history` (`?symbol=&range=1W|1M|6M|1Y|5Y`), `/api/market/funds/trending`. API client: `getCrypto/getStocks/searchStocks/getStockQuote/getStockHistory/getTrendingFunds`.

**Instrument detail page (history chart):** `stocks.client.js` `getHistory(symbol,range)` uses the Yahoo chart endpoint with `range`/`interval` (RANGE_MAP), returns `{name,currency,price,points:[{t,c}],windowChangePct,high,low}` (cache 5min). `src/features/market/InstrumentDetail.jsx` renders a dependency-free **SVG area+line chart** + range tabs (1W/1M/6M/1Y/5Y) + stats. Reached by clicking any crypto card, Indian/global stock row, or search result — `Discover.jsx` holds `detail` state and renders InstrumentDetail in place (back arrow returns). Crypto coins now carry a Yahoo `symbol` (BTC-USD etc.) so cards open the chart. The old inline picked-quote card in StocksBoard was replaced by navigating to the detail page. Trending MUTUAL FUNDS have no detail page (MFAPI scheme codes, not Yahoo symbols).

**Frontend** `src/features/market/`: `LiveCrypto.jsx` (USD prices), `StocksBoard.jsx` ("Stocks & crypto" — unified search w/ 350ms debounce + type pills crypto/stock/etf + selected-quote card + private-giants note), `TrendingFunds.jsx`, `LiveBadge.jsx` (pulsing LIVE pill; `pulse` keyframe in globals.css). Polling via **`src/common/hooks/usePoll.js`** — visibility-gated (only while tab visible, pauses when hidden, refetches on regaining focus); crypto 60s, stocks 120s. Components unmount when leaving Discover tab → polling stops. Combined with server caches this keeps upstream calls low. Helpers `fmtPrice(value,currency)` + `fmtPct(n)` in `format.js`.

**Gotcha (operational):** do NOT run `npm run build` while `next dev` is live on the same repo — the production build overwrites `.next` and the dev server then 500s with `MODULE_NOT_FOUND` on `.next/server/...`. Fix: kill dev, `rm -rf .next`, restart dev. Verify builds either by stopping dev first, or rely on dev hot-reload + endpoint curls. Zomato search returns empty upstream because Yahoo renamed it ETERNAL.NS (2025) — not a bug.
