import { z } from 'zod';
import { handle, ok } from '@/common/api/http';
import { searchFunds } from '@/modules/market-data/mfapi.client';

// MFAPI.in fund search proxy (no DB, TTL-cached in the client).
export const dynamic = 'force-dynamic';

const searchSchema = z.object({ q: z.string().min(2) });

export const GET = handle(async (req) => {
  const { q } = searchSchema.parse({ q: new URL(req.url).searchParams.get('q') || '' });
  const data = await searchFunds(q);
  return ok({ data });
});
