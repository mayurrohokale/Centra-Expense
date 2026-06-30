import { handle, ok } from '@/common/api/http';
import { getTrendingFunds } from '@/modules/market-data/mfapi.client';

// Trending mutual funds with live 1Y/3Y returns (MFAPI, public). Cached ~6h.
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const data = await getTrendingFunds();
  return ok({ data });
});
