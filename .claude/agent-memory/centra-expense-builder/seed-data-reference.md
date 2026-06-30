---
name: seed-data-reference
description: Realistic Indian sample data baked into the prototype — banks, merchants, holdings, goals — to mirror in the seed script
metadata:
  type: project
---

From `Centra Expense.dc.html` state. Mirror this in the backend seed so UI matches design. User "Aditya Sharma". Currency ₹ (en-IN formatting).

**Banks (accounts, type bank):** HDFC Bank (logo H, #0050A0, ••4582, ₹124500, Savings/Premier), ICICI Bank (I, #F47216, ••9013, ₹86200, Savings/Regular), SBI (S, #22409A, ••7745, ₹210000, Savings/Salary), Axis Bank (A, #97144D, ••3320, ₹45800, Savings/Regular), Kotak (K, #ED1C24, ••1198, ₹32400, Savings/811).
**Cash account:** balance ₹8500, spent this month ₹4200.
Total balance shown ₹498900; net worth ₹1278900.

**Transactions (source tags shown):** Swiggy -420 ICICI (email), Uber -260 ICICI (sync), Freelance +8000 ICICI (manual), Zomato -540 HDFC (email), Reliance Smart -3250 HDFC (sync), BESCOM Electricity -2100 SBI (manual), Netflix -649 HDFC (manual), Dividend +1200 SBI (sync), Tea & snacks -120 Cash, Auto rickshaw -80 Cash. Upcoming salary ₹85000 to HDFC 1 Jul.
**Needs-review (email-detected):** Amazon Pay -1899 HDFC (26 Jun), HP Petrol Pump -2100 SBI (27 Jun).
**Auto-detected (email pipe demo):** HDFC→Amazon Pay -1899, Reliance Smart -3250; ICICI→Swiggy -420, Uber -260.

**Holdings (investment):**
- Mutual Funds (total ₹380000): Axis Bluechip Fund (SIP ₹5000/mo, cur 165000, inv 140000), Parag Parikh Flexi Cap (SIP ₹8000, 142000/115000), Nippon Small Cap (SIP ₹3000, 73000/58000).
- Crypto (₹240000): Bitcoin 0.034 (128000/110000), Ethereum 0.41 (72000/68000), Solana 5.2 (40000/46000).
- Fixed Deposits (₹160000): HDFC FD 7.1% matures Mar2027 (100000/93000), SBI FD 6.8% matures Sep2026 (60000/56000).
Portfolio: current ₹780000, invested ₹686000, returns +₹94000, XIRR 18.6%. Alloc MF49%/Crypto31%/FD20%.

**Discover content:** Goals — New bike ₹90k/150k, Goa trip ₹52k/80k, Emergency fund ₹180k/300k. MF picks — Quant Small Cap (28.4% 3Y), Mirae Asset Large Cap (15.2%), ICICI Balanced Advantage (11.6%). Crypto watch BTC/ETH/SOL. FD rates — Unity SF 9.0%, Jana SF 8.5%, HDFC 7.1%, SBI 6.8%.

For real MFAPI integration, map MF names to scheme codes (e.g. Parag Parikh Flexi Cap ~122639, Axis Bluechip ~120505, Nippon Small Cap ~118778) — verify codes via api.mfapi.in/mf search before relying on them.
