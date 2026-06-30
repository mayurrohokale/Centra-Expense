import { z } from 'zod';
import { handle, requireDb, ok, HttpError, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/transactions/transaction.service';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({ categoryKey: z.string().optional() });

export const POST = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;
  const patch = confirmSchema.parse(await readJson(req));
  const updated = await service.confirmTransaction(user._id, id, patch);
  if (!updated) throw new HttpError(404, 'Reviewable transaction not found');
  return ok({ data: updated });
});
