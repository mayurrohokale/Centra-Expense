import { handle, ok } from '@/common/api/http';
import { discoverContent } from '@/modules/market-data/discover.data';

// Curated Research-tab content (goals, MF picks, crypto watch, FD rates).
// No DB needed — stays alive even when MONGODB_URI is unset.
export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ data: discoverContent }));
