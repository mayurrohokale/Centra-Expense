---
name: milestone-1-status
description: Milestone 1 (scaffold + schemas + seeded backend + 5 wired screens) is built and verified; deviations and flagged design conflicts
metadata:
  type: project
---

**M1 COMPLETE & verified.** **ARCHITECTURE MIGRATED (2026-06-29): the old Vite-frontend + Express-backend split was merged into a SINGLE Next.js 14 App Router app at the repo root and the `backend/`+`frontend/` dirs were deleted.** Deploys to Vercel as one unit (serverless). JavaScript (not TS), `type:module`, `@/*`→`src/*` via jsconfig. Layout: `app/` (layout.jsx+globals.css, `'use client'` page.jsx tabbed-SPA shell, `api/<resource>/route.js` Route Handlers); `src/common` (env · cached global Mongoose connect · AES-256-GCM crypto · redacting logger · httpClient · `api/http.js` helpers `handle`/`requireDb`/`ok`/`HttpError` · theme tokens · api client · useApi · shared UI); `src/modules/*` (model+service only — controllers/routes dropped, logic reused by handlers); `src/features/*` (5 screens, all `'use client'`); `src/seed/seed.js`. No auth — boots to Home as seeded dev user `aditya.sharma@centra.app`. No git init.

**Migration specifics to remember:** Mongoose models guarded with `mongoose.models.X || mongoose.model(...)` (Next hot-reload). DB connect cached on `globalThis.__centraMongoose` (conn+promise); handlers call `await requireDb()` which throws `HttpError(503)` per-route when MONGODB_URI unset/unreachable — `/api/health` + `/api/market/*` never call it and stay 200. Route handlers use `await ctx.params` (works on Next 14 & 15) and `export const dynamic='force-dynamic'`. Fonts via Google `<link>` in layout `<head>` (keeps exact family names for inline-style tokens). `instrumentation.js` (+`experimental.instrumentationHook`) logs configWarnings on boot; `serverComponentsExternalPackages:['mongoose']`. Seed loads env via `src/common/config/loadEnv.js` (dotenv on `.env.local`) imported FIRST. Scripts: `dev`/`start` on **port 5000**, `build`, `seed`. Verified via prod build + runtime probes (health 200, DB routes 503, market 200, nav/abc 400). API client calls relative `/api` (CORS removed). NOTE: after delete, empty `backend/`+`frontend/` shells lingered because the agent session's CWD/workspace-watcher held them — contents are gone; shells clear when the session releases.

**Verified numbers match design:** bank total ₹4,98,900; this-month summary income ₹95,000 / spending ₹52,300 / savings ₹42,700; portfolio current ₹7,80,000 / invested ₹6,86,000 / returns +₹94,000; 8 holdings; 3 connections (ciphertext never serialized); revoke clears `encryptedTokens`; idempotent re-seed stays at 27 txns (no dupes).

**Design conflicts flagged (resolved pragmatically — revisit if user wants exact):**
- The prototype's headline This-Month figures don't reconcile with its small visible txn list, and its category bar chart sums to only ₹36,900 vs spending ₹52,300. We seeded so HEADLINE totals match exactly; the "Where it went" chart is data-driven (top categories) and won't be pixel-identical bar heights.
- **XIRR 18.6%** on Invest summary is a static design value (true XIRR needs cashflow dates — out of M1 scope). Portfolio endpoint returns `returnsPct` (~13.7%) but the card shows the design's 18.6%.
- Allocation legend is data-driven rounding → FD shows 21% (design 20%); MF 49 / Crypto 31 match.

**Deviations from documented collections (no new collections added):**
- Discover content (goals, MF picks, crypto watch, FD rates) is served as curated static data from `market-data/discover.data.js` at `/api/market/discover`. Goals have no user collection in M1.
- Source mapping confirmed in code: DB stores `aa_sync`; design source chip/badge label is "sync"/"🏦 Bank sync". Frontend `tokens.js` SOURCE_BADGE keys on `aa_sync` directly.

**Key impl notes:**
- `transactions.fingerprint` uses a **partial** unique index (`partialFilterExpression: {fingerprint:{$type:'string'}}`), NOT sparse — sparse collides on the explicit nulls that manual/cash rows carry.
- DB-down handling: `bufferCommands:false` + per-handler `requireDb()` returns fast 503; `/api/health` and `/api/market/*` stay up without a DB. (Old global Express `/api` guard is gone — it's now per-route.)
- Real MFAPI scheme codes in seed: Axis Bluechip→**120465** (fund renamed to "Axis Large Cap"), Parag Parikh Flexi Cap→122639, Nippon Small Cap→118778. Discover picks: Quant Small Cap 120828, Mirae Large Cap 118825, ICICI Bal. Adv. 120251.

**Still needs user:** `MONGODB_URI` + `ENCRYPTION_KEY` in **`.env.local`** (repo root; on Vercel set them as project env vars), then `npm run seed`. Next milestones (per build order): market-data live wiring → email pipe → CAS upload → AA auto-sync.
