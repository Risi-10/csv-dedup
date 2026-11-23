const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../../server/app.js');

async function get(url) {
  const app = buildApp({ logLevel: 'silent' });
  const response = await app.inject({ method: 'GET', url });
  await app.close();
  return response;
}

// Resolves a link in the page the way the browser does when the page is at "/".
const resolveFromRoot = (link) => new URL(link, 'http://localhost/').pathname;

test('serves the page at /', async () => {
  const response = await get('/');
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.match(response.body, /<title>Newsletter List Cleaner<\/title>/);
});

test('serves every script and stylesheet the page links to', async () => {
  const page = (await get('/')).body;
  const links = [...page.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(links.length >= 9, `expected the page's scripts and stylesheet, found ${links.length}`);
  for (const link of links) {
    const response = await get(resolveFromRoot(link));
    assert.equal(response.statusCode, 200, `${link} → ${resolveFromRoot(link)}`);
    assert.match(response.headers['content-type'], link.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
  }
});

test('serves nothing outside the page files', async () => {
  for (const url of ['/package.json', '/server/config.js', '/core/../package.json', '/.env', '/samples/messy-export.csv']) {
    assert.equal((await get(url)).statusCode, 404, url);
  }
});
