/**
 * Redacting logger. Never logs secrets, tokens, or raw financial payloads.
 *
 * Any key whose name matches SENSITIVE_KEYS is replaced with '[REDACTED]'
 * before output, recursively. Use this everywhere instead of console.* so
 * accidental logging of a token/cookie/email-body is scrubbed by default.
 */

const SENSITIVE_KEYS = [
  'token', 'accesstoken', 'refreshtoken', 'idtoken',
  'password', 'pass', 'secret', 'apikey', 'api_key',
  'authorization', 'auth', 'cookie', 'encryptiontoken',
  'encryptedtokens', 'encrypted', 'iv', 'authtag',
  'rawbody', 'raw_email', 'rawemail', 'body', 'payload',
  'clientsecret', 'client_secret', 'privatekey', 'private_key',
  'consenthandle', 'fipdata', 'fidata',
];

function isSensitiveKey(key) {
  const k = String(key).toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEYS.some((s) => k.includes(s.replace(/[_-]/g, '')));
}

function redact(value, depth = 0) {
  if (depth > 6) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function ts() {
  return new Date().toISOString();
}

function emit(level, args) {
  const safe = args.map((a) => (typeof a === 'object' ? redact(a) : a));
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`[${ts()}] [${level.toUpperCase()}]`, ...safe);
}

export const logger = {
  info: (...a) => emit('info', a),
  warn: (...a) => emit('warn', a),
  error: (...a) => emit('error', a),
  debug: (...a) => emit('debug', a),
  redact,
};
