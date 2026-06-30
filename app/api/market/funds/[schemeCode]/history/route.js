import { handle, ok, HttpError } from '@/common/api/http';
import { getFundHistory } from '@/modules/market-data/mfapi.client';

// NAV history + returns for a mutual fund (MFAPI.in, no auth/DB; client-cached).
// ?range=1M|6M|1Y|3Y|MAX. Powers the trending-MF detail chart + SIP calculator.
export const dynamic = 'force-dynamic';

export const GET = handle(async (req, ctx) => {
  const { schemeCode } = await ctx.params;
  if (!/^\d+$/.test(schemeCode)) throw new HttpError(400, 'schemeCode must be numeric');
  const range = new URL(req.url).searchParams.get('range') || '1Y';
  const data = await getFundHistory(schemeCode, range);
  if (!data) throw new HttpError(502, 'Fund data unavailable from MFAPI right now');
  return ok({ data });
});
