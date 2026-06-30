import { handle, ok } from '@/common/api/http';
import { searchStocks, getQuote } from '@/modules/market-data/stocks.client';

// Stock symbol search + (optional) live quote. ?q=tata  or  ?symbol=TCS.NS
export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol');
  if (symbol) {
    const quote = await getQuote(symbol);
    return ok({ data: quote });
  }
  const q = url.searchParams.get('q') || '';
  const results = await searchStocks(q);
  return ok({ data: results });
});
