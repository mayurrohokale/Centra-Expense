import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectToDatabase } from '../db/connect.js';
import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * Shared helpers for Next.js Route Handlers — the serverless replacement for
 * the old Express controllers + error middleware.
 *
 * - HttpError: throwable carrying an HTTP status.
 * - handle(fn): wraps a handler, mapping thrown errors to JSON responses
 *   (ZodError → 400, HttpError → its status, anything else → 500). Mirrors the
 *   old errorHandler middleware.
 * - requireDb(): connects (cached) and throws a clear 503 when MONGODB_URI is
 *   unset or the connection fails — the per-handler version of the old global
 *   "/api 503 when DB down" guard. Market-data and /api/health never call it.
 * - ok(body, init): NextResponse.json wrapper.
 */

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function requireDb() {
  if (!env.mongoUri) {
    throw new HttpError(
      503,
      'Database not connected. Set MONGODB_URI in .env.local and run `npm run seed`.'
    );
  }
  try {
    await connectToDatabase();
  } catch {
    throw new HttpError(503, 'Database connection failed. Check MONGODB_URI and that the cluster is reachable.');
  }
}

export function ok(body, init) {
  return NextResponse.json(body, init);
}

export function handle(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
      }
      const status = err?.status || 500;
      if (status >= 500) {
        logger.error('Route error:', err?.message || err);
      } else {
        logger.warn('Request error:', err?.message || err);
      }
      return NextResponse.json(
        { error: err?.message || 'Internal server error', ...(err?.details ? { details: err.details } : {}) },
        { status }
      );
    }
  };
}

/** Parse JSON body defensively (empty body → {}). */
export async function readJson(req) {
  try {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
