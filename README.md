# Centra Expense

Mobile-first personal-finance app for India (₹). Three data pipes feed one
MongoDB: **email detection**, **investments via Account Aggregator**, and
**manual/cash**. Every record carries a `source` tag so the UI shows source
badges. This repo implements **Milestone 1**: scaffold + schemas + the 5 in-app
screens wired to a working backend with realistic Indian seed data.

It is a **single Next.js (App Router) app** — UI and API in one project, one
`npm run dev`, deployed to **Vercel as one unit** (serverless).

## Stack
- **Framework:** Next.js 14 (App Router) — React UI + API Route Handlers in one app (JavaScript, not TS)
- **Styling:** Tailwind CSS (mobile-first 390-wide frame) + inline design tokens
- **Database:** MongoDB (Atlas) via Mongoose, with a cached global connection for serverless
- **Market data:** MFAPI.in (NAVs / fund search), cached with TTLs
- **Security:** AES-256-GCM token encryption at rest, redacting logger, read-only OAuth scopes (live Gmail `gmail.readonly` ingestion implemented; AA/Outlook still stubbed)

## Project structure
```
Centra-Expense/
  app/
    layout.jsx, page.jsx        # root layout (fonts/css) + 'use client' tabbed SPA shell
    globals.css                 # Tailwind + design base styles
    api/<resource>/route.js     # Route Handlers replacing the old Express endpoints
  src/
    common/                     # env · cached Mongoose connect · AES-256-GCM crypto · redacting
                                #   logger · http client · Next API helpers (handle/requireDb/ok)
                                #   · theme tokens · api client · useApi · shared UI
    modules/                    # users · accounts · transactions · holdings · connections ·
                                #   categories · market-data  (each: model + service)
    features/                   # dashboard · transactions · email-connect · investments · discover
    seed/seed.js                # realistic Indian seed data (standalone node script)
  next.config.mjs, tailwind.config.js, postcss.config.mjs, jsconfig.json (@/* → src/*)
  instrumentation.js            # logs config warnings on server boot
```

Business logic lives in `src/modules/*.service.js` and is reused by the route
handlers. The dev-user resolver (`src/common/context/devUser.js`) is the single
place the "no auth in M1" assumption lives.

## Prerequisites
- Node.js 18+ (uses built-in `fetch` and `crypto`)
- A MongoDB Atlas connection string (you supply this)

## 1) Install & configure
```bash
npm install

# configure environment — copy the example to .env.local (Next convention)
cp .env.example .env.local
# edit .env.local and set:
#   MONGODB_URI    = your Atlas connection string
#   ENCRYPTION_KEY = a 32-byte hex key:
#                    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
The app **builds and runs without these**: DB-backed API routes return a clear
`503` while `/api/health` and `/api/market/*` stay alive. A dev encryption key
is used (with a warning) until `ENCRYPTION_KEY` is set.

## 2) Seed realistic Indian sample data
```bash
npm run seed     # requires MONGODB_URI in .env.local; idempotent
```
Seeds dev user **Aditya Sharma**, 5 banks + cash, 27 transactions across all 4
sources (incl. 2 needs_review), 8 holdings with real MFAPI scheme codes, 3
encrypted connections, and categories.

## 3) Run
```bash
npm run dev      # http://localhost:5000  (Next dev)
# or production:
npm run build && npm run start   # http://localhost:5000
```
Open http://localhost:5000 — the app opens the **Login** screen. Use the demo
login below (or sign up) to reach the populated app.

## Authentication

The app gates on a signed session: on load the shell calls `GET /api/auth/me`;
unauthenticated → the Login / Signup / Forgot flow, authenticated → the 5-tab app
bound to the real user.

- **Email + password:** passwords are stored ONLY as a one-way **bcrypt** hash
  (`bcryptjs`) — never plaintext, never logged, never returned in any response.
- **Sessions:** a JWT (signed with `jose`/HS256) in an **httpOnly, SameSite=Lax,
  Secure-in-prod** cookie `centra_session`. Every data route calls `requireAuth()`
  and scopes all reads/writes to the authenticated user.
- **Google sign-in:** "Continue with Google" → `/api/auth/google`. Until you add
  Google OAuth credentials it degrades gracefully to a clear "not configured"
  message (no crash).
- **Forgot/reset:** `POST /api/auth/forgot` stores a hashed, expiring token and
  (SMTP deferred) **logs the reset link in dev**; `/reset?token=…` + `POST
  /api/auth/reset` consumes it. Single-use, 1-hour expiry.

### Demo login (seeded — shows the full rich dataset)
```
email:    aditya@centra.app
password: Centra@123
```

### Enabling Google sign-in (optional)
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID**
   (Application type: **Web application**).
2. Add this exact **Authorized redirect URI**:
   `http://localhost:5000/api/auth/google/callback`
3. Paste the client id/secret into `.env.local` (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`). `GOOGLE_REDIRECT_URI` / `APP_URL` are already set.
   On Vercel, set the same vars and register your deployed `…/api/auth/google/callback` URI.

## Email ingestion pipe (Gmail, read-only)

The **Auto-track** screen connects a Gmail inbox **read-only**, fetches only
bank-alert emails, and parses them into `needs_review` transactions
(`source='email'`). Parsing is **per-bank regex** (HDFC / ICICI / SBI / Axis /
Kotak); the parser registry is built so an AI fallback can slot in later. Only
**extracted fields** are stored — raw email bodies are never persisted (the
Gmail messageId is used solely inside the dedupe fingerprint, then discarded).

**Try it immediately (no Google setup) — Simulate mode**
1. Log in as the demo user, open the **Auto** tab.
2. Tap **🧪 Simulate fetch (dev)**. Realistic sample HDFC/ICICI/SBI/Axis/Kotak
   emails run through the real parser → dedupe → store pipeline. Tapping again
   finds **0 new** (idempotent). The unparseable "statement ready" notice is
   counted as skipped, never stored.
3. Confirm / Edit category on the detected rows — they also appear in the
   **Transactions → Needs review** section (same data).

Or by API (after logging in to get the `centra_session` cookie):
```bash
curl -b cookies.txt -X POST http://localhost:5000/api/connections/gmail/simulate
# → {"data":{"total":11,"created":10,"duplicate":0,"failed":1,"simulated":true}}
```

**Manual sync** (live Gmail): `POST /api/connections/:id/sync` for the gmail
connection → fetches messages newer than the last sync, parses, dedupes, and
bumps `lastSyncedAt`. Surfaced as **🔄 Sync now** on the Auto screen.

### Enabling LIVE Gmail (restricted scope — needs Google setup)
1. Google Cloud Console → **APIs & Services → Library → enable "Gmail API"**.
2. **OAuth consent screen** → add the scope
   `https://www.googleapis.com/auth/gmail.readonly` (restricted/sensitive) and
   add yourself under **Test users**. Full production use requires Google app
   **verification** (security assessment for restricted scopes).
3. **Credentials** → your Web OAuth client → add the Authorized redirect URI
   `http://localhost:5000/api/connections/gmail/callback` (distinct from the
   sign-in callback). On Vercel, also register the deployed
   `…/api/connections/gmail/callback`.
4. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local` (reused from
   sign-in). `GMAIL_REDIRECT_URI` is already set. The flow requests
   `access_type=offline` + `prompt=consent` to obtain a **refresh token**,
   which is encrypted at rest. Until configured, **Connect Gmail** degrades
   gracefully and Simulate mode still works.

### Scheduled auto-sync (Vercel Cron)
`GET /api/cron/email-sync` sweeps every active Gmail connection and syncs each.
It is protected by **`CRON_SECRET`** (sent by Vercel Cron as a Bearer token);
public/unauthorized calls get `401`. `vercel.json` schedules it every 6 hours.
Set `CRON_SECRET` as a Vercel project env var to enable it.

## API ↔ screen map (all same-origin `/api/...`)
| Screen | Endpoints |
| --- | --- |
| **Auth** | `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/forgot`, `POST /api/auth/reset`, `GET /api/auth/google` (+ `/callback`) |
| **Home / Dashboard** | `/api/users/me`, `/api/accounts`, `/api/holdings/portfolio`, `/api/transactions/summary` |
| **Transactions** | `/api/transactions` (segment/source/search), `/api/transactions/needs-review`, `/api/transactions/summary`, `/api/transactions/categories`, `/api/categories`; cash sheet → `POST /api/transactions` + `PATCH /api/accounts/:id` |
| **Auto-track (email)** | `/api/connections`, `GET /api/connections/gmail/start` (+ `/callback`), `POST /api/connections/:id/sync`, `POST /api/connections/gmail/simulate`, `POST /api/connections/:id/revoke`, `/api/transactions/needs-review` |
| **Investments** | `/api/holdings`, `/api/holdings/portfolio`, AA consent → `POST /api/connections` |
| **Discover** | `/api/market/discover` |
| **Market data** | `/api/market/nav/:schemeCode`, `/api/market/search` (proxy MFAPI.in, TTL-cached) |
| **Health** | `/api/health` (no DB; reports connection state) |

## Vercel deployment
- Deploy this repo as **one Vercel project** (no monorepo split). The App Router
  API routes run as serverless functions automatically.
- Set **Environment Variables** in Vercel → Project Settings: `MONGODB_URI`,
  `ENCRYPTION_KEY`, and (later) `ANTHROPIC_API_KEY`.
- The Mongoose connection is cached on `globalThis` so warm serverless
  invocations reuse one pool instead of opening one per request.
- **Vercel Cron** is configured in `vercel.json` to hit `/api/cron/email-sync`
  every 6 hours (protected by `CRON_SECRET`). AA auto-sync will add its own route.

## Security notes (M1)
- OAuth / AA tokens are stored only as AES-256-GCM ciphertext (`connections.encryptedTokens`); plaintext is never persisted, serialized, or logged.
- The logger redacts token/secret/payload-like fields.
- Raw email bodies are never stored — only extracted transaction fields.
- Revoking a connection clears its stored ciphertext.

## What still needs you
1. **`.env.local` → `MONGODB_URI`** — your Atlas connection string (already set locally).
2. **`.env.local` → `ENCRYPTION_KEY`** + **`JWT_SECRET`** — real secrets (already set locally).
3. Run **`npm run seed`** once to populate data + the demo login.
4. *(optional)* Add **Google OAuth** credentials to enable "Continue with Google".

## Deferred to later milestones (not yet wired)
- **Outlook / Microsoft Graph** email ingestion (button shown as "coming soon";
  this milestone is **Gmail-only**).
- **Anthropic AI parser fallback** for emails the regex parsers can't read (the
  registry has the seam; regex-only this pass).
- **Google app verification** for the restricted `gmail.readonly` scope — live
  Gmail works for **Test users** until then.
- **Live Setu/Finvu AA** consent fetch + decryption (AA consent currently stores a
  stubbed, encrypted Finvu connection).
- **CAS PDF parsing** ("Import CAS" shows a "coming soon" state).
- **SMTP email delivery** for password reset (the reset link is logged in dev).
