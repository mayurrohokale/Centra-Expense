---
name: balance-and-skeletons
description: Per-bank balance tracking (email-authoritative + computed, idempotent on confirm) and app-wide skeleton loaders
metadata:
  type: project
---

Two features built 2026-06-30 (dev server running; built WITHOUT `npm run build` per constraint — build corrupts the live .next cache).

**FEATURE B — per-bank balance that updates with transactions.**
- Model fields: `account` gained `balanceSource` ('email'|'computed'|'manual', default manual), `startingBalance`, `balanceUpdatedAt`. `transaction` gained `availableBalance` (Number|null), `balanceAsOf`, `balanceApplied` (Bool, idempotency guard).
- New `src/modules/accounts/balance.service.js`: `applyBalanceForTransaction` / `reverseBalanceForTransaction`. PRIORITY: if txn.availableBalance != null → set account.balance to that authoritative value, balanceSource='email'; else computed delta (credit +, debit −), balanceSource='computed'. Cash also moves spentThisMonth on debit. Idempotent via `balanceApplied` flag.
- Applied WHEN CONFIRMED: `transaction.service.confirmTransaction` calls apply after the needs_review→confirmed transition. Manual/cash created already-confirmed → `createTransaction` applies on create when status==='confirmed' && accountId. needs_review email rows wait for confirm.
- Avl Bal parsing: `parseHelpers.parseAvailableBalance` (requires "bal" keyword so it never grabs a card "Avl Limit" or the txn amount). Captured in `ingestEmails` from full email text (covers regex/generic/ai paths) AND added to generic.parser draft. Stored on the txn at create; applied at confirm.
- Manual entries pick account via existing TxnSheet account chips; REMOVED TxnSheet's client-side cash balance update (now centralized server-side — avoids double count). `account.service.updateAccount` stamps balanceSource='manual'+startingBalance when balance edited; createAccount seeds manual source.
- UI: Dashboard bank cards show a balance-source badge (📧 Synced / 🧮 Auto / ✍️ Manual + relTime). EmailConnect confirm + confirmAllAuto now refetchAll (accounts) so balance visibly updates.
- KNOWN SIMPLIFICATION: with multiple email balances, last-confirmed-wins (no occurredAt ordering); reverse() of an email snapshot is approximate (next sync re-asserts). No delete/un-confirm endpoints exist yet, so reverse() is ready but only create/confirm are wired. A real HDFC `.bank.in` email sample would let us tune the Avl Bal regex precisely.

**FEATURE A — skeleton loaders.** New `src/common/ui/Skeleton.jsx` (base `Skeleton` + presets SkeletonText/Number/Chip/Circle/Row/Rows/StatCard + per-screen DashboardSkeleton/TransactionsSkeleton/EmailConnectSkeleton/InvestmentsSkeleton/DiscoverSkeleton). Shimmer = `.skeleton` class + `@keyframes shimmer` in app/globals.css. Replaced `<Loading/>` guard in Dashboard, Transactions, Investments, Discover, EmailConnect. Profile still uses the old spinner (not in scope). Market subcomponents keep their inline "Loading…" text.
