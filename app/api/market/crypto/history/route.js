import { handle, ok, HttpError } from '@/common/api/http';
import { getCryptoHistory } from '@/modules/market-data/crypto.client';

// Historical crypto price series (CoinGecko market_chart, USD). Public, no DB.
// ?id=bitcoin&range=7d  (range ∈ 24h,7d,30d). `id` accepts a CoinGecko id or a
// symbol like BTC-USD / BTC.
export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || url.searchParams.get('symbol');
  const range = url.searchParams.get('range') || '7d';
  if (!id) throw new HttpError(400, 'id (or symbol) is required');
  const data = await getCryptoHistory(id, range);
  return ok({ data });
});
