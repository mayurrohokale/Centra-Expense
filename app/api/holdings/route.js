import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/holdings/holding.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const sp = new URL(req.url).searchParams;
  // Lazy maturity pass: credit any matured FDs (idempotent) before listing, so
  // the UI shows the "matured ✓ credited" state + the account balance is updated.
  await service.processMaturedFDs(user._id);
  const raw = await service.listHoldings(user._id, {
    instrumentType: sp.get('type') || undefined,
    source: sp.get('source') || undefined,
  });
  // Enrich with live crypto valuation + FD accrued/maturity values.
  const data = await service.valueHoldings(raw);
  return ok({ data });
});

const createSchema = z.object({
  instrumentType: z.enum(['mutual_fund', 'crypto', 'fd', 'stocks', 'gold', 'other']),
  name: z.string().min(1),
  tag: z.string().optional(),
  color: z.string().optional(),
  subtitle: z.string().optional(),
  investedValue: z.number().nonnegative().optional(),
  // Optional for manual entries — defaults to investedValue server-side.
  currentValue: z.number().nonnegative().optional(),
  units: z.number().optional(),
  schemeCode: z.string().optional(),
  interestRate: z.number().optional(),
  // Crypto manual fields (USD live P/L).
  coinId: z.string().optional(),
  buyPriceUsd: z.number().nonnegative().optional(),
  purchaseDate: z.string().datetime().optional(),
  // FD manual fields.
  principal: z.number().nonnegative().optional(),
  fdStartDate: z.string().datetime().optional(),
  maturityDate: z.string().datetime().optional(),
  creditAccountId: z.string().optional(),
}).refine((b) => b.instrumentType !== 'crypto' || (b.coinId && b.units != null && b.buyPriceUsd != null), {
  message: 'Crypto needs a coin, quantity and buy price.',
}).refine((b) => b.instrumentType !== 'fd' || (b.principal != null && b.interestRate != null && b.fdStartDate && b.maturityDate), {
  message: 'FD needs principal, rate, start and maturity dates.',
}).refine((b) => b.instrumentType === 'fd' || b.instrumentType === 'crypto' || b.investedValue != null, {
  message: 'Enter the invested amount.',
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const body = createSchema.parse(await readJson(req));
  const data = await service.createHolding(user._id, body);
  return ok({ data }, { status: 201 });
});
