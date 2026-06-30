import { handle, requireDb, ok } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { recategorizeUncategorized } from '@/modules/transactions/transaction.service';

export const dynamic = 'force-dynamic';

/**
 * One-shot backfill: apply merchant → category rules to the user's existing
 * transactions that were never auto-categorized (and weren't set by hand).
 * Idempotent and rule-based (no AI). Also runs automatically after each sync.
 */
export const POST = handle(async () => {
  await requireDb();
  const user = await requireAuth();
  const updated = await recategorizeUncategorized(user._id);
  return ok({ data: { updated } });
});
