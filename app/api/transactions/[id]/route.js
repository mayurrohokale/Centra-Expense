import { z } from 'zod';
import { handle, requireDb, ok, HttpError, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/transactions/transaction.service';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  categoryKey: z.string().min(1).optional(),
  merchant: z.string().min(1).optional(),
  icon: z.string().optional(),
  iconBg: z.string().optional(),
  note: z.string().optional(),
});

export const PATCH = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const patch = patchSchema.parse(await readJson(req));
  const updated = await service.updateTransaction(user._id, id, patch);
  if (!updated) throw new HttpError(404, 'Transaction not found');
  return ok({ data: updated });
});

/**
 * Delete a transaction (auth + user-scoped). Works for BOTH drafts and confirmed
 * rows. For a confirmed row the service reverses its balance effect (debit adds
 * back, credit subtracts) and undoes any linked goal contribution before
 * removing the row. The UI gates confirmed deletes behind a confirmation modal.
 */
export const DELETE = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const result = await service.deleteTransaction(user._id, id);
  return ok({ data: result });
});
