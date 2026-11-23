'use strict';

// Reads settings from environment variables (see .env.example). Bad values stop the server at
// startup with a clear message rather than failing later on the first upload.
function readConfig(env = process.env) {
  return {
    port: integer(env, 'PORT', 3000, 1, 65535),
    host: env.HOST || '127.0.0.1',
    maxFileMb: integer(env, 'MAX_FILE_MB', 20, 1, 500),
    maxFiles: integer(env, 'MAX_FILES', 10, 1, 100),
    logLevel: oneOf(env, 'LOG_LEVEL', 'info', ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  };
}

function integer(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}, got "${raw}".`);
  }
  return value;
}

function oneOf(env, name, fallback, allowed) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!allowed.includes(raw)) throw new Error(`${name} must be one of ${allowed.join(', ')}, got "${raw}".`);
  return raw;
}

module.exports = { readConfig };
