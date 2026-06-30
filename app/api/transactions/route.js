import { z } from 'zod';
import { handle, requireDb, ok, readJson } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import { Account } from '@/modules/accounts/account.model';
import * as service from '@/modules/transactions/transaction.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const sp = new URL(req.url).searchParams;
  const data = await service.listTransactions(user._id, {
    segment: sp.get('segment') || undefined,
    source: sp.get('source') || undefined,
    status: sp.get('status') || undefined,
    q: sp.get('q') || undefined,
  });
  return ok({ data });
});

const createSchema = z.object({
  accountId: z.string().optional(),
  source: z.enum(['email', 'aa_sync', 'cash', 'manual']),
  direction: z.enum(['debit', 'credit', 'transfer']),
  amount: z.number().positive(),
  merchant: z.string().min(1),
  categoryKey: z.string().optional(),
  icon: z.string().optional(),
  iconBg: z.string().optional(),
  note: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  dateLabel: z.string().optional(),
  status: z.enum(['confirmed', 'needs_review']).optional(),
  // Goal funding: links this contribution to a savings goal (draft until confirmed).
  goalId: z.string().optional(),
  // Self-transfer: destination account (direction must be 'transfer').
  toAccountId: z.string().optional(),
}).refine((b) => b.direction !== 'transfer' || (b.accountId && b.toAccountId && b.accountId !== b.toAccountId), {
  message: 'A transfer needs distinct from and to accounts.',
});

export const POST = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const body = createSchema.parse(await readJson(req));

  let accountName = '';
  if (body.accountId) {
    const acct = await Account.findOne({ _id: body.accountId, userId: user._id }).lean();
    accountName = acct?.name || '';
  }
  let toAccountName = '';
  if (body.toAccountId) {
    const toAcct = await Account.findOne({ _id: body.toAccountId, userId: user._id }).lean();
    toAccountName = toAcct?.name || '';
  }

  const { transaction, deduped } = await service.createTransaction(user._id, {
    ...body,
    accountName,
    toAccountName,
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
  });

  return ok({ data: transaction, deduped }, { status: deduped ? 200 : 201 });
});
