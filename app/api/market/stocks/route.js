import { handle, ok } from '@/common/api/http';
import { getStockGroup, PRIVATE_GIANTS } from '@/modules/market-data/stocks.client';

// Live curated stock quotes (Yahoo, public). ?group=indian|global (default both).
export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const group = new URL(req.url).searchParams.get('group');
  if (group === 'indian' || group === 'global') {
    const data = await getStockGroup(group);
    return ok({ data });
  }
  const [indian, global] = await Promise.all([getStockGroup('indian'), getStockGroup('global')]);
  return ok({ data: { indian, global, privateGiants: PRIVATE_GIANTS } });
});
