import { z } from 'zod';
import { handle, requireDb, ok, HttpError, readJson } from '@/common/api/http';
import { getAuthUser, requireAuth } from '@/common/auth/session';
import { toSafeUser } from '@/modules/users/user.model';
import { updateProfile } from '@/modules/users/user.service';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireDb();
  const user = await getAuthUser();
  if (!user) throw new HttpError(401, 'Not authenticated');
  return ok({ data: toSafeUser(user) });
});

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email').optional(),
  avatarColor: z.string().trim().max(20).optional(),
  salary: z
    .object({
      amount: z.number().min(0, 'Amount must be positive').max(1_000_000_000),
      payDay: z.number().int().min(1).max(31),
      // Designated salary account (Mongo ObjectId string) or null/empty to clear.
      accountId: z.string().optional().nullable(),
    })
    .optional(),
  reminderEnabled: z.boolean().optional(),
  // 24h HH:MM, e.g. "21:00".
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)').optional(),
});

export const PATCH = handle(async (req) => {
  await requireDb();
  const user = await requireAuth();
  const patch = patchSchema.parse(await readJson(req));
  const updated = await updateProfile(user._id, patch);
  return ok({ data: toSafeUser(updated) });
});
