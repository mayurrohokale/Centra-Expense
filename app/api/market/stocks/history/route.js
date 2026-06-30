import { handle, ok, HttpError } from '@/common/api/http';
import { getHistory } from '@/modules/market-data/stocks.client';

// Historical price series for a symbol (stock or crypto, e.g. AAPL / BTC-USD).
// ?symbol=AAPL&range=1M  (range ∈ 1W,1M,6M,1Y,5Y). Public, no DB/auth.
export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol');
  const range = url.searchParams.get('range') || '1M';
  if (!symbol) throw new HttpError(400, 'symbol is required');
  const data = await getHistory(symbol, range);
  return ok({ data });
});
