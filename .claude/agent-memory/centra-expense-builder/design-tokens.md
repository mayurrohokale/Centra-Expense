---
name: design-tokens
description: Confirmed design tokens (fonts, colors, radii) and screen list from the imported Centra Expense.dc.html prototype
metadata:
  type: project
---

Source of truth: `C:\Users\mayur.rohokale\Desktop\centra-expense-mobile-app-design\project\Centra Expense.dc.html` (local export; claude_design MCP NOT available in this env). README confirms: recreate pixel-perfectly, do not copy prototype internal structure. Prototype runtime is a custom `DCLogic` class in `support.js` — do not replicate it; reimplement in React.

**Fonts:** Plus Jakarta Sans (weights 500/600/700/800 — headings, numbers, buttons, brand) + Inter (400/500/600/700/800 — body, labels). Loaded from Google Fonts.

**Frame:** mobile 390x844, app container radius 46px, bg `#FBF8F4`. Page bg radial gradient `#efe9fb`→`#e6e9f3`. Status bar 9:41.

**Core color tokens:**
- Text dark `#2a2733`; muted `#7a7387` / `#9b94a8` / `#b3acc0`.
- Brand gradient (primary CTA): `linear-gradient(135deg,#FF8A7A,#FF6FA5 55%,#A78BFA)`. Accent purple `#A78BFA`.
- Green/positive `#16a34a` / `#1FAE63` / `#2BC4B0` / `#34D39E`.
- Red/expense `#FF6B5E` / `#FF8A7A`. Amber `#FFB23E`/`#FF9F1C`/`#FFC247`/`#FFD166`.
- Cards: white `#fff`, border `#f1ecf6` (1.5px), shadow `0 10-12px 22-28px rgba(90,70,130,.06-.10)`, radius 22-30px.
- Invest summary gradient `linear-gradient(140deg,#6C5CE7,#A78BFA 55%,#C8A2FF)`. Net-worth strip teal `#2BC4B0→#4ECDC4→#7BE3C9`.

**Source badge palette (transactions):**
- email: bg `#F4ECFF` fg `#8b5cf6`, label "📧 Auto from {account}"
- sync (aa_sync): bg `#E7F3FF` fg `#2B7FE0`, label "🏦 Bank sync · {account}"
- cash: bg `#EAF7EF` fg `#1FAE63`, label "💵 Cash"
- manual: bg `#F1EEF6` fg `#7a7387`, label "✍️ Manual · {account}"
NOTE design uses source value `sync`; our DB uses `aa_sync` — map between them.

**Screens / flows (all in one prototype):**
1. Auth (pre-app, no nav): Login, Signup (with password-strength meter), Forgot-password (form + sent confirmation). "Continue with Google". NOTE: design has email+password fields, but project rule = NEVER store passwords + M1 auth is stubbed single-user. Flag this conflict; build UI but defer real auth.
2. Bottom nav (5 tabs): Home 🏠, Txns 💳, Auto ✉️ (email), Invest 📈, Discover 🔍.
3. Home/Dashboard: hero total-balance card, horizontal bank cards (expandable) + Cash card, invested-balance donut, net-worth strip, this-month income/spending bars, quick actions grid.
4. Transactions: in/out overview, search, segment (all/income/expenses), source chips, upcoming salary, NEEDS REVIEW cards (confirm/edit), date-grouped list with source badges, "where it went" category bar chart, floating + FAB. Cash wallet bottom sheet (add/spend).
5. Auto-track (email): per-account connect cards (connected/not-linked status), Gmail/Outlook connect bottom sheet, auto-detected transactions grouped by bank with confirm/edit.
6. Investments: AA-synced banner, portfolio summary card (current value/invested/returns/XIRR), allocation legend, link-account button, holdings sections (Mutual Funds/Crypto/Fixed Deposits), CAS import + add-manually options. AA Consent view (handshake, scopes read-only, consent terms, approve/cancel — "Powered by Finvu AA").
7. Discover/Research: goals progress, mutual-fund picks, crypto watch (horizontal), best FD rates, logout.
