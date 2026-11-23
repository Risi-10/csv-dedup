const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../../server/app.js');
const { readConfig } = require('../../server/config.js');

test('GET /health says the server is up', async () => {
  const app = buildApp({ logLevel: 'silent' });
  const response = await app.inject({ method: 'GET', url: '/health' });
  await app.close();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

test('unknown paths get a 404 in the same error format', async () => {
  const app = buildApp({ logLevel: 'silent' });
  const response = await app.inject({ method: 'GET', url: '/nope' });
  await app.close();
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'Not found.' });
});

test('config has safe defaults and rejects bad values', () => {
  assert.deepEqual(readConfig({}), { port: 3000, host: '127.0.0.1', maxFileMb: 20, maxFiles: 10, logLevel: 'info' });
  assert.equal(readConfig({ PORT: '8080' }).port, 8080);
  assert.throws(() => readConfig({ PORT: 'abc' }), /PORT must be a whole number/);
  assert.throws(() => readConfig({ MAX_FILE_MB: '0' }), /MAX_FILE_MB/);
  assert.throws(() => readConfig({ LOG_LEVEL: 'loud' }), /LOG_LEVEL must be one of/);
});
