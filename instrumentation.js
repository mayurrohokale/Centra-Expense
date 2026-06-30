/**
 * Next.js instrumentation hook — runs once when the server boots.
 * Surfaces config warnings (missing MONGODB_URI / ENCRYPTION_KEY) without
 * crashing, mirroring the old Express startup warnings.
 */
export async function register() {
  // Only run in the Node.js runtime (not the edge runtime).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { configWarnings } = await import('./src/common/config/env.js');
    const { logger } = await import('./src/common/logger/logger.js');
    for (const w of configWarnings()) logger.warn(w);
  }
}
