---
name: salary-tracking
description: Salary tracking — designated salary account + expected amount/day, auto-detect from email, manual monthly tick, per-month idempotency, reports/balance binding
metadata:
  type: project
---

Built 2026-06-30 (dev server running; NO build/dev run — read-only verification per the live-`.next` gotcha in [[live-market-data]]).

**STORAGE (forks chosen).** Salary config lives on `user.salary` (extended the existing sub-doc, NOT a flag on accounts): `{ amount, payDay (1–31; 31≈month-end via nextPayDate clamp), accountId }`. `accountId` = the single designated SALARY ACCOUNT (ObjectId ref Account; null clears it) — chose user.salaryAccountId-style over an account flag so "one at a time" is enforced by construction. Transaction gained `isSalary` (Bool, indexed). NO new collection / no per-month marker doc.

**MONTH-CREDITED = QUERY, not a flag.** A month is "credited" iff an income (credit) txn with `isSalary:true` exists in that calendar month (`salary.service.findSalaryTxnForMonth`, status-agnostic so an auto-detected DRAFT also counts). This single check is the idempotency guard shared by auto-detect AND the manual tick → a month can never be double-counted.

**AUTO-DETECT (in email ingestion).** `emailIngestion.service.ingestEmails` loads `user.salary` once per run. A parsed CREDIT landing on the salary account that `looksLikeSalary` (narration matches salary/sal/payroll/wages/stipend regex OR amount within ±15% of expected via `withinSalaryTolerance`) is tagged `isSalary:true` + forced `categoryKey:'income'` + 💼 icon — but ONLY if `findSalaryTxnForMonth` finds nothing for that month yet (so a 2nd matching credit isn't also tagged; loop is sequential/awaited so the DB reflects the first). Still created as `needs_review` (normal email draft flow) → balance/income finalize on confirm like every email row.

**MANUAL TICK (fallback).** `salary.service.markSalaryCredited(userId,{amount,date})` creates a **CONFIRMED** income credit on the salary account (`source:'manual'`, direction:'credit', categoryKey:'income', isSalary:true, merchant 'Salary credited'). Confirmed → flows through `createTransaction → applyBalanceForTransaction` (computed mode, +amount to the account balance) AND counts in reports income immediately. Amount is EDITABLE (defaults to expected). Rejects 409 if the month is already credited (auto or manual). Routes: `GET /api/salary/status`, `POST /api/salary/mark-credited`. api client: `getSalaryStatus`, `markSalaryCredited`.

**getSalaryStatus** returns { configured, accountId, accountName, expectedAmount, payDay, credited, creditedAmount, creditedDate, creditedTxnId, autoDetected (txn.source==='email'), canMarkCredited, monthKey }. `canMarkCredited` = configured && !credited && now.getDate() ≥ min(payDay||25, 25) — tick appears from ~the credit day / 25th onward.

**REPORTS/BALANCE BINDING (verified, no change needed).** report.service `windowTotals` sums credits into `received` (salary included); `byCategory`/merchants/trend filter `direction:'debit'` so salary never shows as spend; `incomeVsExpense.income = received`. transaction.service.getSummary income = sum of confirmed credits (includes confirmed salary). Transfers stay excluded (see [[taxonomy-transfers-recurring]]). FIRST-TIME BASELINE already works via existing AccountEditSheet manual balance (balanceSource 'manual' + startingBalance); salary credits then track exact incoming via balance.service.

**UI.** Home: `src/features/dashboard/SalaryCard.jsx` (added to Dashboard after the finish-setup nudge) — skeleton while loading; not-configured → gentle "Track your salary" prompt → opens Profile; credited → "✅ Received ₹X into <acct> on <date>" + AUTO-DETECTED/MARKED badge; pending → "Pending · ₹X, expected on the Nth" + a "✅ Salary credited this month" button (when canMarkCredited) opening an editable amount+date confirm sheet. `onChanged` refetches accounts+summary+me. Settings: `SalarySheet.jsx` rewritten to add a bank-account picker (salary account) alongside amount + credit day. Profile salary card shows the bound account name. Reports: a compact salary attribution line under the summary card for the this_month period (received/pending).

**NOTE:** seed.js demo user has `salary {amount:85000, payDay:1}` but no accountId (set before accounts exist) → demo shows the not-configured prompt until a salary account is picked; left as-is (seed is manual, real users use Settings). Auto-detected salary draft shows as "received" on the card before confirm (detection=received; balance/income finalize on confirm) — deliberate.
