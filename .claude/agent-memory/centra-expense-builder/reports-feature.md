---
name: reports-feature
description: Reports/spending-analytics page — GET /api/reports aggregation + Reports.jsx, reached from Home (no 6th nav tab)
metadata:
  type: project
---

Reports page built 2026-06-30 (dev server running; built WITHOUT `npm run build` per constraint).

**Backend:** `GET /api/reports?period=this_month|last_month|last_3_months|this_year|custom&from=&to=` -> `app/api/reports/route.js` -> `src/modules/reports/report.service.js` `getReport(userId,{period,from,to})`. CONFIRMED txns only (status:'confirmed'; drafts excluded). `resolvePeriod` returns current + previous windows [start,end) + trend bucket (day for month/custom-short, month for year/3mo). MongoDB aggregation: windowTotals (debit/credit/count), byCategory (group categoryKey), byAccount (group accountId), merchants grouped by {categoryKey, merchant} then JS-merged via `normalizeMerchant` (ZOMATO/zomato@hdfc combine) into global top-10 + per-category top-3 (drill-down), trend via $dateToString (TZ Asia/Kolkata). Response: { period, summary{spent,received,net,count,prevSpent,spendDeltaPct}, byCategory[{...,pct,topMerchants[]}], topMerchants[], trend[{key,label,amount}], byAccount[{...,pct}], incomeVsExpense{income,expense} }. Reuses category + account meta.

**Frontend:** `src/features/reports/Reports.jsx`. Sections: period chips (+custom date inputs), headline summary (spent + received/net/txns + up/down delta-vs-prev badge), Where-it-went (conic donut + ranked category bars, tap category to expand its top merchants), spending-over-time CSS bars, Top merchants list, Spent-by-account bars, Income-vs-Expense bars. Empty state when count===0. Uses inr/inrCompact, tokens, ReportsSkeleton (added to Skeleton.jsx). NO chart deps.

**Nav placement DECISION:** kept the 5-tab bottom bar exactly as designed (NO 6th tab). Reports is a focused view reached from Home's existing "View Reports" quick action (was mis-wired to onTab('discover'), now onTab('reports')). page.jsx renders {tab==='reports' && <Reports onBack={()=>setTab('home')}/>}; bottom nav stays visible + back arrow returns home. api.getReport(params) added.
