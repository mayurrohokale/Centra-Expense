import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * Cached Mongoose connection for Vercel serverless + Next.js dev hot-reload.
 *
 * Serverless invocations and Next's dev hot-reload would otherwise open a new
 * connection pool on every request / recompile. We cache the connection (and
 * the in-flight connect promise) on `globalThis` so a single pool is reused
 * across invocations and module reloads.
 *
 * Connect lazily from inside route handlers via connectToDatabase().
 */

let cached = globalThis.__centraMongoose;
if (!cached) {
  cached = globalThis.__centraMongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(env.mongoUri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        // Fail fast instead of buffering queries for 10s when disconnected.
        bufferCommands: false,
      })
      .then((m) => {
        logger.info('MongoDB connected.');
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next request can retry the connection.
    cached.promise = null;
    logger.error('MongoDB connection failed:', err?.message || 'unknown');
    throw err;
  }
  return cached.conn;
}

/** Lightweight state for the /api/health probe (no connection attempt). */
export function dbState() {
  switch (mongoose.connection.readyState) {
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'disconnected';
  }
}

/** Used by the seed script to close cleanly. */
export async function disconnectDb() {
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  cached.conn = null;
  cached.promise = null;
}
