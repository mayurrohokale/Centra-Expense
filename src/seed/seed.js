/**
 * Seed realistic Indian sample data matching the Centra Expense design.
 *
 * Run: npm run seed   (requires MONGODB_URI in .env.local)
 *
 * Idempotent: wipes and re-inserts the dev user's data each run.
 *
 * NOTE: the loadEnv import MUST be first — it populates process.env from
 * .env.local before config/env.js (imported transitively below) reads it.
 *
 * Design-fidelity note: the prototype's headline "This month" figures
 * (income ₹95,000 / spending ₹52,300 / savings ₹42,700) do NOT reconcile
 * with its small visible transaction list, and its category bar chart sums
 * to only ₹36,900. We seed so the HEADLINE totals + balances + portfolio
 * match the design exactly; the category breakdown is then data-driven.
 */
import '../common/config/loadEnv.js';

import mongoose from 'mongoose';
import { env, configWarnings } from '../common/config/env.js';
import { connectToDatabase, disconnectDb } from '../common/db/connect.js';
import { logger } from '../common/logger/logger.js';
import { encryptJson, fingerprint } from '../common/crypto/cryptoService.js';

import bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.model.js';
import { Account } from '../modules/accounts/account.model.js';
import { Transaction } from '../modules/transactions/transaction.model.js';
import { Holding } from '../modules/holdings/holding.model.js';
import { Connection } from '../modules/connections/connection.model.js';
import { Category } from '../modules/categories/category.model.js';
import { DEFAULT_CATEGORIES } from '../modules/categories/defaultCategories.js';
import { Goal } from '../modules/goals/goal.model.js';
import { goalThemeAt } from '../modules/goals/goalThemes.js';

// Demo login (documented in README + printed at the end of the seed).
const DEMO_EMAIL = 'aditya@centra.app';
const DEMO_PASSWORD = 'Centra@123';
// Older seeds used this address; clean it up so the credentialed user owns the data.
const LEGACY_EMAIL = 'aditya.sharma@centra.app';

const YEAR = 2026;
const JUN = 5; // month index
const d = (day) => new Date(Date.UTC(YEAR, JUN, day, 6, 0, 0));

async function run() {
  for (const w of configWarnings()) logger.warn(w);
  if (!env.mongoUri) {
    logger.error('Cannot seed without MONGODB_URI. Set it in .env.local and retry.');
    process.exitCode = 1;
    return;
  }

  try {
    await connectToDatabase();
  } catch {
    logger.error('Seed aborted: could not connect to MongoDB.');
    process.exitCode = 1;
    return;
  }

  // ---- demo user ----
  // Remove any legacy-email user (and its data) so the credentialed demo
  // account cleanly owns the rich dataset. Idempotent (no-op on later runs).
  const legacy = await User.findOne({ email: LEGACY_EMAIL });
  if (legacy && legacy.email !== DEMO_EMAIL) {
    const legacyId = legacy._id;
    await Promise.all([
      Account.deleteMany({ userId: legacyId }),
      Transaction.deleteMany({ userId: legacyId }),
      Holding.deleteMany({ userId: legacyId }),
      Connection.deleteMany({ userId: legacyId }),
      Category.deleteMany({ userId: legacyId }),
      User.deleteOne({ _id: legacyId }),
    ]);
    logger.info(`Removed legacy user ${LEGACY_EMAIL} and its data.`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      name: 'Aditya Sharma', email: DEMO_EMAIL, passwordHash,
      currency: 'INR', locale: 'en-IN', avatarEmoji: '👋',
      phone: '+91 98765 43210',
      salary: { amount: 85000, payDay: 1 },
      onboarding: { completed: true, skipped: false },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const userId = user._id;
  logger.info(`Demo user ready: ${user.name} <${DEMO_EMAIL}>`);

  // Wipe prior data for a clean, idempotent seed.
  await Promise.all([
    Account.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
    Holding.deleteMany({ userId }),
    Connection.deleteMany({ userId }),
    Category.deleteMany({ userId }),
    Goal.deleteMany({ userId }),
  ]);

  // ---- categories (shared defaults, including the expanded set) ----
  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, userId }));
  await Category.insertMany(categories);

  // ---- accounts (5 banks + cash) ----
  const bankDefs = [
    { name: 'HDFC Bank', logo: 'H', color: '#0050A0', last4: '4582', balance: 124500, tier: 'Premier', lastActivity: 'Today' },
    { name: 'ICICI Bank', logo: 'I', color: '#F47216', last4: '9013', balance: 86200, tier: 'Regular', lastActivity: 'Yesterday' },
    { name: 'SBI', logo: 'S', color: '#22409A', last4: '7745', balance: 210000, tier: 'Salary', lastActivity: '2 days ago' },
    { name: 'Axis Bank', logo: 'A', color: '#97144D', last4: '3320', balance: 45800, tier: 'Regular', lastActivity: '5 days ago' },
    { name: 'Kotak', logo: 'K', color: '#ED1C24', last4: '1198', balance: 32400, tier: '811', lastActivity: '1 week ago' },
  ];
  const banks = await Account.insertMany(
    bankDefs.map((b, i) => ({ ...b, userId, type: 'bank', subtype: 'Savings', order: i }))
  );
  const cash = await Account.create({
    userId, type: 'cash', name: 'Cash', logo: '👛', color: '#1FAE63',
    balance: 8500, spentThisMonth: 4200, order: 10,
  });
  const byName = Object.fromEntries(banks.map((b) => [b.name, b]));
  logger.info(`Accounts: ${banks.length} banks + cash. Total bank balance ₹${banks.reduce((s, b) => s + b.balance, 0)}`);

  // ---- transactions ----
  // Each row: [merchant, accountName, source, amount(+credit/-debit), category, icon, iconBg, day, dateLabel, status]
  const T = (merchant, acctName, source, amount, categoryKey, icon, iconBg, day, dateLabel, status = 'confirmed') => {
    const acct = acctName === 'Cash' ? cash : byName[acctName];
    const direction = amount >= 0 ? 'credit' : 'debit';
    const occurredAt = d(day);
    const fp = (source === 'email' || source === 'aa_sync')
      ? fingerprint([userId.toString(), source, merchant, Math.abs(amount), occurredAt.toISOString()])
      : null;
    return {
      userId, accountId: acct._id, accountName: acct.name,
      source, direction, status, amount: Math.abs(amount), currency: 'INR',
      merchant, categoryKey, icon, iconBg, occurredAt, dateLabel, fingerprint: fp,
    };
  };

  const visible = [
    // TODAY · 29 JUN
    T('Swiggy', 'ICICI Bank', 'email', -420, 'food', '🍔', '#FFEDE9', 29, 'TODAY · 29 JUN'),
    T('Uber', 'ICICI Bank', 'aa_sync', -260, 'transport', '🚕', '#E6F8F5', 29, 'TODAY · 29 JUN'),
    T('Tea & snacks', 'Cash', 'cash', -120, 'food', '☕', '#FFF4DB', 29, 'TODAY · 29 JUN'),
    // YESTERDAY · 28 JUN
    T('Freelance project', 'ICICI Bank', 'manual', 8000, 'income', '💻', '#E6F8F5', 28, 'YESTERDAY · 28 JUN'),
    T('Zomato', 'HDFC Bank', 'email', -540, 'food', '🍕', '#FFEDE9', 28, 'YESTERDAY · 28 JUN'),
    T('Auto rickshaw', 'Cash', 'cash', -80, 'transport', '🛺', '#FFF4DB', 28, 'YESTERDAY · 28 JUN'),
    // 27 JUN
    T('Reliance Smart', 'HDFC Bank', 'aa_sync', -3250, 'shopping', '🛒', '#F4ECFF', 27, '27 JUN'),
    T('BESCOM Electricity', 'SBI', 'manual', -2100, 'bills', '⚡', '#FFF4DB', 27, '27 JUN'),
    // 26 JUN
    T('Netflix', 'HDFC Bank', 'manual', -649, 'entertainment', '🎬', '#FFE9F1', 26, '26 JUN'),
    T('Dividend payout', 'SBI', 'aa_sync', 1200, 'income', '💰', '#EAF7EF', 26, '26 JUN'),
  ];

  // Needs-review (email-detected, unconfirmed) — design Txns + Auto-track screens.
  const needsReview = [
    T('Amazon Pay', 'HDFC Bank', 'email', -1899, 'shopping', '🛍️', '#F4ECFF', 26, '26 JUN', 'needs_review'),
    T('HP Petrol Pump', 'SBI', 'email', -2100, 'transport', '⛽', '#FFF4DB', 27, '27 JUN', 'needs_review'),
  ];

  // Earlier-June activity so monthly headline totals match the design exactly.
  // Income filler: 85,800 (salary) + 8,000 + 1,200 = ₹95,000.
  // Expense filler sums to ₹44,881; + ₹7,419 visible = ₹52,300. Savings ₹42,700.
  const earlier = [
    T('Salary · TechCorp India', 'HDFC Bank', 'aa_sync', 85800, 'income', '💼', '#EAF7EF', 1, '01 JUN'),
    T('Jio Fiber', 'SBI', 'manual', -1499, 'bills', '🛜', '#FFF4DB', 3, '03 JUN'),
    T('Airtel Postpaid', 'ICICI Bank', 'manual', -1100, 'bills', '📱', '#FFF4DB', 5, '05 JUN'),
    T('IRCTC', 'ICICI Bank', 'email', -1960, 'transport', '🚆', '#E6F8F5', 6, '06 JUN'),
    T('Indane Gas', 'SBI', 'manual', -2501, 'bills', '🔥', '#FFF4DB', 8, '08 JUN'),
    T('LIC Premium', 'SBI', 'manual', -8000, 'services', '🛡️', '#EFEAFB', 9, '09 JUN'),
    T('BigBasket', 'HDFC Bank', 'email', -4200, 'food', '🥦', '#FFEDE9', 10, '10 JUN'),
    T('Swiggy', 'ICICI Bank', 'email', -3220, 'food', '🍔', '#FFEDE9', 12, '12 JUN'),
    T('Amazon.in', 'HDFC Bank', 'aa_sync', -6550, 'shopping', '📦', '#F4ECFF', 14, '14 JUN'),
    T('Apollo Pharmacy', 'Axis Bank', 'manual', -1400, 'health', '🩺', '#EAFBF1', 16, '16 JUN'),
    T('Zomato', 'HDFC Bank', 'email', -4000, 'food', '🍕', '#FFEDE9', 18, '18 JUN'),
    T('Urban Company', 'Kotak', 'manual', -3000, 'services', '🧹', '#EFEAFB', 19, '19 JUN'),
    T('Uber', 'ICICI Bank', 'aa_sync', -2000, 'transport', '🚕', '#E6F8F5', 20, '20 JUN'),
    T('Croma', 'Axis Bank', 'aa_sync', -3000, 'shopping', '🖥️', '#F4ECFF', 21, '21 JUN'),
    T('BookMyShow', 'HDFC Bank', 'manual', -2451, 'entertainment', '🎟️', '#FFE9F1', 22, '22 JUN'),
  ];

  await Transaction.insertMany([...visible, ...needsReview, ...earlier]);
  logger.info(`Transactions: ${visible.length} visible + ${needsReview.length} needs-review + ${earlier.length} earlier.`);

  // ---- holdings (real MFAPI scheme codes) ----
  const holdings = [
    // Mutual Funds — total ₹3,80,000
    { instrumentType: 'mutual_fund', name: 'Axis Bluechip Fund', tag: 'AB', color: '#6C5CE7', subtitle: 'SIP ₹5,000/mo', investedValue: 140000, currentValue: 165000, schemeCode: '120465' },
    { instrumentType: 'mutual_fund', name: 'Parag Parikh Flexi Cap', tag: 'PP', color: '#FF6B5E', subtitle: 'SIP ₹8,000/mo', investedValue: 115000, currentValue: 142000, schemeCode: '122639' },
    { instrumentType: 'mutual_fund', name: 'Nippon Small Cap', tag: 'NS', color: '#2BC4B0', subtitle: 'SIP ₹3,000/mo', investedValue: 58000, currentValue: 73000, schemeCode: '118778' },
    // Crypto — total ₹2,40,000
    { instrumentType: 'crypto', name: 'Bitcoin', tag: 'BTC', color: '#F7931A', subtitle: '0.034 BTC', investedValue: 110000, currentValue: 128000, units: 0.034 },
    { instrumentType: 'crypto', name: 'Ethereum', tag: 'ETH', color: '#627EEA', subtitle: '0.41 ETH', investedValue: 68000, currentValue: 72000, units: 0.41 },
    { instrumentType: 'crypto', name: 'Solana', tag: 'SOL', color: '#9945FF', subtitle: '5.2 SOL', investedValue: 46000, currentValue: 40000, units: 5.2 },
    // Fixed Deposits — total ₹1,60,000
    { instrumentType: 'fd', name: 'HDFC FD · 7.1%', tag: 'HD', color: '#0050A0', subtitle: 'Matures Mar 2027', investedValue: 93000, currentValue: 100000, interestRate: 7.1, maturityDate: new Date(Date.UTC(2027, 2, 15)) },
    { instrumentType: 'fd', name: 'SBI FD · 6.8%', tag: 'SB', color: '#22409A', subtitle: 'Matures Sep 2026', investedValue: 56000, currentValue: 60000, interestRate: 6.8, maturityDate: new Date(Date.UTC(2026, 8, 15)) },
  ].map((h) => ({ ...h, userId, source: 'aa_sync', lastSyncedAt: new Date() }));
  await Holding.insertMany(holdings);
  const invCur = holdings.reduce((s, h) => s + h.currentValue, 0);
  logger.info(`Holdings: ${holdings.length}. Portfolio current ₹${invCur}.`);

  // ---- connections (encrypted-at-rest stub tokens) ----
  // Email links per design state: HDFC→gmail, ICICI→outlook. Others unlinked.
  const connections = [
    {
      userId, kind: 'gmail', accountId: byName['HDFC Bank']._id,
      label: 'aditya.hdfc@gmail.com', provider: 'Google',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      status: 'connected',
      encryptedTokens: encryptJson({ access_token: 'stub-gmail-access', refresh_token: 'stub-gmail-refresh' }),
    },
    {
      userId, kind: 'outlook', accountId: byName['ICICI Bank']._id,
      label: 'aditya.icici@outlook.com', provider: 'Microsoft',
      scopes: ['Mail.Read'],
      status: 'connected',
      encryptedTokens: encryptJson({ access_token: 'stub-outlook-access', refresh_token: 'stub-outlook-refresh' }),
    },
    {
      userId, kind: 'aa_finvu', accountId: null,
      label: 'Finvu AA · Investments', provider: 'Finvu AA',
      scopes: ['mutual_funds:read', 'deposits:read', 'equities:read'],
      status: 'connected',
      consentExpiresAt: new Date(Date.UTC(YEAR + 1, JUN, 29)),
      encryptedTokens: encryptJson({ consent_id: 'stub-consent', data_session: 'stub-session' }),
    },
  ];
  await Connection.insertMany(connections);
  logger.info(`Connections: ${connections.length} (tokens encrypted at rest).`);

  // ---- goals (real, user-owned savings goals) ----
  const goalDefs = [
    { emoji: '🏍️', name: 'New bike', saved: 90000, target: 150000, theme: 0 },
    { emoji: '✈️', name: 'Goa trip', saved: 52000, target: 80000, theme: 1 },
    { emoji: '🛟', name: 'Emergency fund', saved: 180000, target: 300000, theme: 2 },
  ];
  await Goal.insertMany(
    goalDefs.map((g, i) => {
      const t = goalThemeAt(g.theme);
      return { userId, emoji: g.emoji, name: g.name, saved: g.saved, target: g.target, accent: t.accent, bg: t.bg, border: t.border, order: i };
    })
  );
  logger.info(`Goals: ${goalDefs.length} (real, editable).`);

  logger.info('Seed complete ✅');
  logger.info(`Demo login →  email: ${DEMO_EMAIL}   password: ${DEMO_PASSWORD}`);
}

run()
  .catch((err) => {
    logger.error('Seed failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });
