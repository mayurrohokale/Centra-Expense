import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * AES-256-GCM token encryption for data at rest (OAuth + AA tokens).
 *
 * Storage format (string): "<ivHex>:<authTagHex>:<cipherHex>"
 * Never log the key, plaintext, or ciphertext.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // 96-bit nonce recommended for GCM

// Dev fallback key so the app runs before a real key is provisioned.
// configWarnings() surfaces a warning when this is in use.
const DEV_FALLBACK = '11111111111111111111111111111111111111111111111111111111111111ab';

function resolveKey() {
  const hex = /^[0-9a-fA-F]{64}$/.test(env.encryptionKey) && env.encryptionKey !== '0'.repeat(64)
    ? env.encryptionKey
    : DEV_FALLBACK;
  return Buffer.from(hex, 'hex');
}

/** Encrypt a UTF-8 string (or JSON-serializable object) → opaque string. */
export function encrypt(plaintext) {
  const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${enc.toString('hex')}`;
}

/** Decrypt a string produced by encrypt(). Returns the original UTF-8 string. */
export function decrypt(payload) {
  try {
    const [ivHex, tagHex, dataHex] = String(payload).split(':');
    if (!ivHex || !tagHex || !dataHex) throw new Error('malformed ciphertext');
    const key = resolveKey();
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    logger.error('Token decryption failed (key mismatch or corrupted data).');
    throw new Error('DECRYPTION_FAILED');
  }
}

/** Convenience: encrypt/decrypt a JSON object. */
export function encryptJson(obj) {
  return encrypt(JSON.stringify(obj));
}
export function decryptJson(payload) {
  return JSON.parse(decrypt(payload));
}

/** Deterministic fingerprint for idempotent ingestion (dedupe). */
export function fingerprint(parts) {
  const normalized = (Array.isArray(parts) ? parts : [parts])
    .map((p) => String(p ?? '').trim().toLowerCase())
    .join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
