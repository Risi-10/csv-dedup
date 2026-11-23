const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('../../vendor/xlsx.full.min.js');
const { buildApp } = require('../../server/app.js');
const { readFile, toCsv } = require('../../src/core/parse.js');
const { cleanList } = require('../../src/core/dedupe.js');

const samples = path.join(__dirname, '..', '..', 'samples');

// Encodes a multipart/form-data body the way a browser would, using Node's built-in FormData.
// files: [{ name, content }], fields: { name: value }.
async function multipart(files, fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const { name, content, field = 'files' } of files) form.append(field, new Blob([content]), name);
  const response = new Response(form);
  return {
    headers: { 'content-type': response.headers.get('content-type') },
    payload: Buffer.from(await response.arrayBuffer()),
  };
}

async function postClean(files, fields, appOptions) {
  const app = buildApp({ logLevel: 'silent', ...appOptions });
  const response = await app.inject({ method: 'POST', url: '/api/clean', ...(await multipart(files, fields)) });
  await app.close();
  return { status: response.statusCode, body: response.json() };
}

test('cleans the sample export exactly like the offline page', async () => {
  const content = fs.readFileSync(path.join(samples, 'messy-export.csv'));
  const { status, body } = await postClean([{ name: 'messy-export.csv', content }], { countryCode: '1' });
  assert.equal(status, 200);

  const { header, rows, separator } = readFile(content, 'messy-export.csv');
  const direct = cleanList(header, rows, { countryCode: '1' });
  assert.deepEqual(body.summary, direct.summary);
  assert.deepEqual(body.check, direct.check);

  const expected = fs.readFileSync(path.join(samples, 'expected-clean.csv'), 'utf8');
  const normalize = (text) => text.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
  assert.equal(normalize(toCsv([body.header, ...body.clean], separator)), normalize(expected));
});

test('combines several files and renames columns on request', async () => {
  const { status, body } = await postClean(
    [
      { name: 'monday.csv', content: 'EMRI,TELEFONI,QYTETI\nARBEN HOXHA,0691234567,Tiranë\n' },
      { name: 'tuesday.csv', content: 'Phone,Name,Notes\n+355 69 123 4567,arben hoxha,VIP\n' },
    ],
    { headerLanguage: 'en' },
  );
  assert.equal(status, 200);
  assert.deepEqual(body.header, ['Name', 'Phone', 'City', 'Notes']);
  assert.deepEqual(body.clean, [['Arben Hoxha', '+355691234567', 'Tiranë', 'VIP']]);
  assert.equal(body.summary.duplicatesMerged, 1);
  assert.deepEqual(body.checkHeader.slice(2), body.header);
  assert.ok(body.columnsNotInAllFiles.length > 0);
});

test('reads Excel files', async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Name', 'Phone'], ['ANNA MÜLLER', '069 123 4567']]), 'Sheet1');
  const content = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const { status, body } = await postClean([{ name: 'export.xlsx', content }]);
  assert.equal(status, 200);
  assert.deepEqual(body.clean, [['Anna Müller', '+355691234567']]);
});

test('turns away wrong file types with the file name', async () => {
  const { status, body } = await postClean([{ name: 'notes.txt', content: 'Name,Phone\nA,1\n' }]);
  assert.equal(status, 400);
  assert.match(body.error, /^notes\.txt: .*\.csv or \.xlsx/);
});

test('says which file is missing a needed column', async () => {
  const { status, body } = await postClean([{ name: 'bad.csv', content: 'City,Notes\nTiranë,x\n' }]);
  assert.equal(status, 400);
  assert.match(body.error, /^bad\.csv: Could not find/);
});

test('needs at least one file', async () => {
  const { status, body } = await postClean([], { headerLanguage: 'en' });
  assert.equal(status, 400);
  assert.equal(body.error, 'No files to clean.');
});

test('checks the optional fields', async () => {
  const file = { name: 'a.csv', content: 'Name,Phone\nAna,0691234567\n' };
  assert.equal((await postClean([file], { headerLanguage: 'fr' })).status, 400);
  assert.equal((await postClean([file], { countryCode: '+355' })).status, 400);
});

test('rejects files over the size limit', async () => {
  const content = `Name,Phone\n${'Ana,0691234567\n'.repeat(80000)}`;
  const { status, body } = await postClean([{ name: 'big.csv', content }], {}, { maxFileMb: 1 });
  assert.equal(status, 413);
  assert.match(body.error, /larger than 1 MB/);
});

test('rejects more files than allowed', async () => {
  const file = { name: 'a.csv', content: 'Name,Phone\nAna,0691234567\n' };
  const { status, body } = await postClean([file, { ...file, name: 'b.csv' }], {}, { maxFiles: 1 });
  assert.equal(status, 413);
  assert.match(body.error, /at most 1/);
});

test('a request that is not multipart gets a clear error', async () => {
  const app = buildApp({ logLevel: 'silent' });
  const response = await app.inject({ method: 'POST', url: '/api/clean', payload: { files: [] } });
  await app.close();
  assert.ok(response.statusCode >= 400 && response.statusCode < 500);
  assert.match(response.json().error, /multipart/);
});
