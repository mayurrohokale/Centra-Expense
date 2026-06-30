import { handle, ok, HttpError } from '@/common/api/http';
import { getNav } from '@/modules/market-data/mfapi.client';

// MFAPI.in NAV proxy (no DB, TTL-cached in the client).
export const dynamic = 'force-dynamic';

export const GET = handle(async (req, ctx) => {
  const { schemeCode } = await ctx.params;
  if (!/^\d+$/.test(schemeCode)) throw new HttpError(400, 'schemeCode must be numeric');
  const data = await getNav(schemeCode);
  if (!data) throw new HttpError(502, 'NAV unavailable from MFAPI right now');
  return ok({ data });
});
