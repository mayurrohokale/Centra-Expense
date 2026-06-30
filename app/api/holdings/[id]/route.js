import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/holdings/holding.service';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  instrumentType: z.enum(['mutual_fund', 'crypto', 'fd', 'stocks', 'gold', 'other']).optional(),
  name: z.string().min(1).optional(),
  tag: z.string().optional(),
  color: z.string().optional(),
  subtitle: z.string().optional(),
  investedValue: z.number().nonnegative().optional(),
  currentValue: z.number().nonnegative().optional(),
  units: z.number().optional(),
  interestRate: z.number().optional(),
  // Crypto + FD manual fields (editable).
  coinId: z.string().optional(),
  buyPriceUsd: z.number().nonnegative().optional(),
  purchaseDate: z.string().datetime().optional(),
  principal: z.number().nonnegative().optional(),
  fdStartDate: z.string().datetime().optional(),
  maturityDate: z.string().datetime().optional(),
  creditAccountId: z.string().optional(),
});

// Edit a manual holding (the service blocks editing auto-synced ones).
export const PATCH = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const patch = patchSchema.parse(await readJson(req));
  const data = await service.updateHolding(user._id, id, patch);
  return ok({ data });
});

// Delete a manual holding (the service blocks deleting auto-synced ones).
export const DELETE = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const data = await service.deleteHolding(user._id, id);
  return ok({ data });
});
