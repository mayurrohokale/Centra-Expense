---
name: loans-debts
description: Loans/debts tracker — borrow & lend between user and people, each event a linked confirmed txn moving real balance; excluded from income/expense reports like transfers
metadata:
  type: project
---

Built 2026-06-30 (dev server running; NO build/dev run — live-`.next` gotcha in [[live-market-data]]).

**MODEL** `src/modules/loans/loan.model.js` `Loan`: userId, direction ('borrowed'=I owe them | 'lent'=they owe me), counterpartyName, principal, outstanding, accountId/accountName (at creation), principalTxnId (the principal-move txn), note, status ('open'|'settled'), startDate, settledAt. REPAYMENTS are NOT embedded — they're linked TRANSACTIONS queried by `loanId` (one source of truth; balance reversal on delete stays consistent). `transaction.model` gained `loanId` (ObjectId ref Loan).

**BALANCE WIRING — each loan event = a CONFIRMED txn (categoryKey 'loan', loanId set) through the shared balance system (`loan.service.js`):**
- Create BORROWED → CREDIT chosen acct (+bal), merchant "Loan from <name>", outstanding=principal.
- Create LENT → DEBIT chosen acct (−bal), "Loan to <name>". BALANCE GUARD applies (createTransaction's assertSufficientBalance — manual/cash debit).
- Repay BORROWED (I pay them) → DEBIT (−bal, GUARDED), "Repaid <name>".
- Repay LENT (they pay me) → CREDIT (+bal), "Repayment from <name>".
- outstanding maintained by `recomputeOutstanding(userId,loanId)` = principal − Σ(confirmed linked txns except principalTxnId); flips status open/settled + settledAt. Repayment rejected if > outstanding (400). Settles at 0.
- DELETE loan → `deleteLoan` reverses EVERY linked txn via `deleteTransaction` (reverses balance idempotently via balanceApplied), then removes the loan. DELETE single repayment → `deleteRepayment` reverses that txn + recomputeOutstanding (may re-open). Principal txn can't be deleted as a "repayment".

**REPORTS/SUMMARY EXCLUSION (mirrors transfers).** Transfers are excluded by their `direction:'transfer'` (outside debit/credit). Loans use real credit/debit directions, so they're excluded by `loanId: null` added to: `transaction.service.getSummary` match, `getCategoryBreakdown` match, and `report.service.matchStage` (which covers windowTotals/byCategory/byAccount/merchants/trend). `loanId: null` matches absent-or-null so existing txns are unaffected. New `loan` category 🤝 added to defaultCategories (order 18, auto-backfilled to existing users via /api/categories); TxnSheet expense picker hides 'loan' like 'transfer'.

**ENDPOINTS** (`app/api/loans/`): GET `/loans` (list + totals {youOwe=Σ open borrowed outstanding, owedToYou=Σ open lent outstanding}), POST `/loans` (create, balance-guarded for LENT), POST `/loans/[id]/repay`, DELETE `/loans/[id]`, GET `/loans/[id]/repayments`, DELETE `/loans/[id]/repayments/[txnId]`. api.js: getLoans/createLoan/deleteLoan/repayLoan/getLoanRepayments/deleteRepayment.

**UI** — placed as a FOCUSED VIEW reached from a Home card (mirrors how Reports is reached; keeps the 5-tab bottom nav unchanged). `page.jsx` `tab==='loans'` → `<Loans onBack/>`. Home `src/features/dashboard/LoanCard.jsx` shows the two totals + opens it (skeleton + empty prompt). `src/features/loans/Loans.jsx` = two totals (You owe / Owed to you), Add-loan button, ACTIVE + SETTLED sections (settled de-emphasized w/ ✓), per-loan repaid progress bar + "Record repayment" + Delete; SkeletonRows while loading + friendly empty state. `AddLoanSheet.jsx` (Borrowed/Lent toggle, counterparty, amount, account picker, balance-guarded for LENT, note, date). `RepaySheet.jsx` (amount clamped to outstanding + "Settle full", account picker, balance-guarded for borrowed repayment, repayment history).

FORKS: repayments as linked txns (not embedded array) for one-source-of-truth balance reversal; loan as a Home-card focused view (not a 6th nav tab) to keep the designed bottom bar. Cash repayment debits still bump cash spentThisMonth (minor, matches existing transfer-era behavior; not excluded). No circular import (loan.service → transaction.service only; transaction/report services don't import loan.service).
