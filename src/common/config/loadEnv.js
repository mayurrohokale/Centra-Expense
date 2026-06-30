/**
 * Loads environment variables for the STANDALONE seed script only.
 *
 * Next.js loads `.env.local` automatically for its server runtime, so route
 * handlers never import this. The seed script runs under plain `node`, which
 * does not read `.env.local` — so seed.js imports this FIRST (before any
 * module that reads process.env, e.g. config/env.js) to populate it.
 */
import dotenv from 'dotenv';
import path from 'node:path';

// Prefer .env.local (Next convention); fall back to .env if present.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
