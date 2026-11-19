const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cleanList, namesClose } = require('../src/dedupe.js');
const { readFile, toCsv } = require('../src/parse.js');

const header = ['Name', 'Phone', 'Email'];

test('namesClose allows one typo per word and any word order', () => {
  assert.ok(namesClose('jonh smith', 'john smith'));
  assert.ok(namesClose('smith john', 'john smith'));
  assert.ok(!namesClose('peter smith', 'mary smith'));
  assert.ok(!namesClose('john smith', 'john a smith'));
});

test('merges rows with the same phone and a typo in the name', () => {
  const result = cleanList(header, [
    ['JOHN SMITH', '555-010-0001', ''],
    ['Jonh Smith', '5550100001', 'john@example.com'],
  ]);
  assert.deepEqual(result.clean, [['John Smith', '+15550100001', 'john@example.com']]);
  assert.equal(result.summary.duplicatesMerged, 1);
  assert.equal(result.check.length, 0);
});

test('merges by email, ignoring case', () => {
  const result = cleanList(header, [
    ['Ann Lee', '', 'ANN@example.com'],
    ['ann lee', '555 010 0007', 'ann@example.com'],
  ]);
  assert.deepEqual(result.clean, [['Ann Lee', '+15550100007', 'ann@example.com']]);
  assert.equal(result.check.length, 0, 'phone warning dropped once a merged copy has a phone');
});

test('merges by customer ID even when names differ', () => {
  const result = cleanList(['Customer ID', ...header], [
    ['42', 'Robert Brown', '555 010 0005', ''],
    ['42', 'Bob Brown', '', 'bob@example.com'],
  ]);
  assert.deepEqual(result.clean, [['42', 'Robert Brown', '+15550100005', 'bob@example.com']]);
});

test('never merges different names sharing a phone; flags both instead', () => {
  const result = cleanList(header, [
    ['PETER OBRIEN', '555 010 0003', ''],
    ['MARY OBRIEN', '555 010 0003', ''],
  ]);
  assert.equal(result.clean.length, 2);
  assert.equal(result.check.length, 2);
  assert.match(result.check[0][1], /shares phone \+15550100003 with row 3 \(Mary Obrien\)/);
});

test('flags merged rows whose phones disagreed', () => {
  const result = cleanList(header, [
    ['Maria Garcia', '555 010 0002', 'maria@example.com'],
    ['Maria Garcia', '555 010 0099', 'maria@example.com'],
  ]);
  assert.equal(result.clean.length, 1);
  assert.deepEqual(result.check[0].slice(0, 1), ['2, 3']);
  assert.match(result.check[0][1], /different phones: \+15550100002, \+15550100099 \(kept \+15550100002\)/);
});

test('works with separate first and last name columns', () => {
  const result = cleanList(['First Name', 'Last Name', 'Phone'], [
    ['ANNA', 'MÜLLER', '5550100000'],
    ['Anna', 'Muller', '555 010 0000'],
  ]);
  assert.deepEqual(result.clean, [['Anna', 'Müller', '+15550100000']]);
});

test('cleans the sample export to match the expected file', () => {
  const samples = path.join(__dirname, '..', 'samples');
  const input = fs.readFileSync(path.join(samples, 'messy-export.csv'));
  const { header: inputHeader, rows, separator } = readFile(input, 'messy-export.csv');
  const result = cleanList(inputHeader, rows);

  const expected = fs.readFileSync(path.join(samples, 'expected-clean.csv'), 'utf8');
  const normalize = (text) => text.replace(/\r\n/g, '\n').trim();
  assert.equal(normalize(toCsv([result.header, ...result.clean], separator)), normalize(expected));
  assert.equal(result.summary.text, '14 rows → 9 · 4 duplicates merged · 1 empty row removed · 6 rows to check');
});
