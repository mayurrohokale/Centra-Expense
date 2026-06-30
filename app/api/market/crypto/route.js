import { handle, ok } from '@/common/api/http';
import { getCryptoPrices } from '@/modules/market-data/crypto.client';

// Live crypto prices (CoinGecko, public). No DB needed; cached ~60s upstream.
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const data = await getCryptoPrices();
  return ok({ data });
});
