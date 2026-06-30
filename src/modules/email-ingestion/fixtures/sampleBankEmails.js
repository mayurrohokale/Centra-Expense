/**
 * Realistic sample bank-alert emails for DEV / SIMULATE mode.
 *
 * These feed the SAME parser registry + ingestion path as live Gmail, so the
 * simulate endpoint proves parse → categorize → dedupe → store end-to-end
 * before real OAuth is configured. Stable `id`s make re-runs idempotent (the
 * fingerprint dedupes them). These are fixtures only — never persisted.
 *
 * Covers HDFC / ICICI / SBI / Axis / Kotak with a mix of UPI debits, card
 * spends, and credits, plus one unparseable statement notice (failed counter).
 */

export const SAMPLE_BANK_EMAILS = [
  {
    id: 'sim-hdfc-upi-001',
    from: 'HDFC Bank Alerts <alerts@hdfcbank.net>',
    subject: 'You have done a UPI txn',
    body: 'Dear Customer, Rs. 540.00 has been debited from account **4582 to VPA zomato@hdfcbank on 28-06-2026. Your UPI transaction reference number is 451234567890. If you did not authorize this transaction, please report.',
  },
  {
    id: 'sim-hdfc-card-002',
    from: 'HDFC Bank Alerts <alerts@hdfcbank.net>',
    subject: 'Transaction alert on your HDFC Bank Card',
    body: 'You have spent Rs.1899.00 on your HDFC Bank Credit Card ending 4582 at Amazon on 26-06-2026. Avl Limit Rs.2,40,000. Not you? Call 18002586161.',
  },
  {
    id: 'sim-hdfc-credit-003',
    from: 'HDFC Bank Alerts <alerts@hdfcbank.net>',
    subject: 'Amount credited to your account',
    body: 'Update! Rs.85,800.00 is credited to your HDFC Bank account XX4582 towards SALARY TECHCORP on 01-06-2026. Avl bal Rs.1,24,500.00.',
  },
  {
    id: 'sim-icici-upi-004',
    from: 'ICICI Bank <alerts@icicibank.com>',
    subject: 'Debit alert for your ICICI Bank account',
    body: 'Dear Customer, ICICI Bank Acct XX9013 debited with Rs 420.00 on 29-Jun-26; Swiggy credited. UPI Ref 998877. Call 18001080 if not done by you.',
  },
  {
    id: 'sim-icici-credit-005',
    from: 'ICICI Bank <alerts@icicibank.com>',
    subject: 'Credit alert for your ICICI Bank account',
    body: 'Dear Customer, Your ICICI Bank Account XX9013 has been credited with INR 8,000.00 on 28-Jun-26. Info: Freelance Project Ref 12345. Avl Bal INR 86,200.00.',
  },
  {
    id: 'sim-sbi-debit-006',
    from: 'SBI Alerts <alerts@sbi.co.in>',
    subject: 'Transaction Alert',
    body: 'Dear Customer, your a/c no. XX7745 is debited by Rs.2100.00 on 27/06/26 at HP PETROL PUMP Ref 5567. -SBI',
  },
  {
    id: 'sim-sbi-credit-007',
    from: 'SBI Alerts <alerts@sbi.co.in>',
    subject: 'Transaction Alert',
    body: 'Dear Customer, your a/c no. XX7745 is credited by Rs.1200.00 on 26/06/26 towards Dividend Payout Ref 33. -SBI',
  },
  {
    id: 'sim-axis-card-008',
    from: 'Axis Bank <alerts@axisbank.com>',
    subject: 'Spent on your Axis Bank Card',
    body: 'Spent Card no. XX3320 INR 3000.00 at Croma on 21-06-26. Avl Limit INR 50,000. -Axis Bank',
  },
  {
    id: 'sim-axis-debit-009',
    from: 'Axis Bank <alerts@axisbank.com>',
    subject: 'Debit alert on your Axis Bank account',
    body: 'Debit INR 1400.00 A/c no. XX3320 at Apollo Pharmacy on 16-06-26 Info UPI. -Axis Bank',
  },
  {
    id: 'sim-kotak-upi-010',
    from: 'Kotak Bank <alerts@kotak.com>',
    subject: 'UPI transaction alert',
    body: 'Sent Rs.3000.00 from Kotak Bank AC X1198 to Urban Company on 19-06-26. UPI Ref 7788. Not you? Call Kotak.',
  },
  {
    // Unparseable: no amount → exercised by the "failed" counter, never stored.
    id: 'sim-hdfc-statement-011',
    from: 'HDFC Bank Alerts <alerts@hdfcbank.net>',
    subject: 'Your June account statement is ready',
    body: 'Dear Customer, your HDFC Bank account statement for June 2026 is now available. Login to NetBanking to view and download it.',
  },
];
