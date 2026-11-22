const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cleanList, namesClose } = require('../src/dedupe.js');
const { readFile, toCsv } = require('../src/parse.js');

const header = ['Name', 'Phone', 'Email'];
// These examples use the US numbers from the project brief.
const cleanUs = (h, rows) => cleanList(h, rows, { countryCode: '1' });

test('namesClose allows one typo per word and any word order', () => {
  assert.ok(namesClose('jonh smith', 'john smith'));
  assert.ok(namesClose('smith john', 'john smith'));
  assert.ok(!namesClose('peter smith', 'mary smith'));
  assert.ok(!namesClose('john smith', 'john a smith'));
});

test('merges rows with the same phone and a typo in the name', () => {
  const result = cleanUs(header, [
    ['JOHN SMITH', '555-010-0001', ''],
    ['Jonh Smith', '5550100001', 'john@example.com'],
  ]);
  assert.deepEqual(result.clean, [['John Smith', '+15550100001', 'john@example.com']]);
  assert.equal(result.summary.duplicatesMerged, 1);
  assert.equal(result.check.length, 0);
});

test('merges by email, ignoring case', () => {
  const result = cleanUs(header, [
    ['Ann Lee', '', 'ANN@example.com'],
    ['ann lee', '555 010 0007', 'ann@example.com'],
  ]);
  assert.deepEqual(result.clean, [['Ann Lee', '+15550100007', 'ann@example.com']]);
  assert.equal(result.check.length, 0, 'phone warning dropped once a merged copy has a phone');
});

test('merges by customer ID even when names differ', () => {
  const result = cleanUs(['Customer ID', ...header], [
    ['42', 'Robert Brown', '555 010 0005', ''],
    ['42', 'Bob Brown', '', 'bob@example.com'],
  ]);
  assert.deepEqual(result.clean, [['42', 'Robert Brown', '+15550100005', 'bob@example.com']]);
});

test('never merges different names sharing a phone; flags both instead', () => {
  const result = cleanUs(header, [
    ['PETER OBRIEN', '555 010 0003', ''],
    ['MARY OBRIEN', '555 010 0003', ''],
  ]);
  assert.equal(result.clean.length, 2);
  assert.equal(result.check.length, 2);
  assert.match(result.check[0][1], /shares phone \+15550100003 with row 3 \(Mary Obrien\)/);
});

test('flags merged rows whose phones disagreed', () => {
  const result = cleanUs(header, [
    ['Maria Garcia', '555 010 0002', 'maria@example.com'],
    ['Maria Garcia', '555 010 0099', 'maria@example.com'],
  ]);
  assert.equal(result.clean.length, 1);
  assert.deepEqual(result.check[0].slice(0, 1), ['2, 3']);
  assert.match(result.check[0][1], /different phones: \+15550100002, \+15550100099 \(kept \+15550100002\)/);
});

test('works with separate first and last name columns', () => {
  const result = cleanUs(['First Name', 'Last Name', 'Phone'], [
    ['ANNA', 'MÜLLER', '5550100000'],
    ['Anna', 'Muller', '555 010 0000'],
  ]);
  assert.deepEqual(result.clean, [['Anna', 'Müller', '+15550100000']]);
});

test('cleans the sample export to match the expected file', () => {
  const samples = path.join(__dirname, '..', 'samples');
  const input = fs.readFileSync(path.join(samples, 'messy-export.csv'));
  const { header: inputHeader, rows, separator } = readFile(input, 'messy-export.csv');
  const result = cleanUs(inputHeader, rows);

  const expected = fs.readFileSync(path.join(samples, 'expected-clean.csv'), 'utf8');
  const normalize = (text) => text.replace(/\r\n/g, '\n').trim();
  assert.equal(normalize(toCsv([result.header, ...result.clean], separator)), normalize(expected));
  assert.equal(result.summary.text, '14 rows → 9 · 4 duplicates merged · 1 empty row removed · 6 rows to check');
});

test('namesClose survives a typo that changes how words sort', () => {
  assert.ok(namesClose('elira kela', 'cela elira'));
});

test('merges Albanian rows with titles, swapped name order and missing accents', () => {
  const result = cleanList(['ID', 'EMRI', 'TELEFONI', 'EMAIL'], [
    ['17', 'DR. AGIM LEKA', '04 2234 568', 'agim.leka@example.com'],
    ['18', 'LEKA AGIM', '042234568', 'agim.leka@example.com'],
    ['3', 'ELIRA ÇELA', '069 22 33 445', 'elira.cela@example.com'],
    ['4', 'Elira Cela', '0692233445', 'elira.cela@example.com'],
    ['1', 'ARBEN HOXHA', '0691234567', ''],
    ['2', 'arben hoxha', '+355 69 123 4567', ''],
  ]);
  assert.deepEqual(result.clean, [
    ['17', 'Dr. Agim Leka', '+35542234568', 'agim.leka@example.com'],
    ['3', 'Elira Çela', '+355692233445', 'elira.cela@example.com'],
    ['1', 'Arben Hoxha', '+355691234567', ''],
  ]);
  assert.equal(result.check.length, 0);
});

test('a name shared by many customers gives each row one short flag, not one per pair', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ['Arben Hoxha', '', `arben${i}@example.com`]);
  const result = cleanList(header, rows);
  assert.equal(result.clean.length, 200);
  assert.equal(result.check[0][1], 'phone missing; same name, different phone/email, as '
    + 'row 3 (Arben Hoxha), row 4 (Arben Hoxha), row 5 (Arben Hoxha) and 196 more');
});

const albanianHeader = ['ID', 'EMRI', 'TELEFONI', 'EMAIL', 'QYTETI'];

test('puts an email and phone typed into the wrong columns back, and flags the row', () => {
  const result = cleanList(albanianHeader, [
    ['7', 'GËZIM RRAPAJ', 'gezim.rrapaj@example.com', 'Vlorë', '00355682345678'],
    ['8', 'MARIA ROSSI', '+39 333 1234567', 'maria.rossi@example.com', 'Bari'],
  ]);
  assert.deepEqual(result.clean, [
    ['7', 'Gëzim Rrapaj', '+355682345678', 'gezim.rrapaj@example.com', 'Vlorë'],
    ['8', 'Maria Rossi', '+393331234567', 'maria.rossi@example.com', 'Bari'],
  ]);
  assert.equal(result.check.length, 1);
  assert.equal(result.check[0][1],
    'values were in the wrong columns (email was under "TELEFONI", phone was under "QYTETI"); moved back, check this row');
});

test('never takes a phone number from the customer ID column', () => {
  const result = cleanList(albanianHeader, [['0691234567', 'Ana Gjoni', '', 'ana@example.com', 'Tiranë']]);
  assert.deepEqual(result.clean[0].slice(0, 3), ['0691234567', 'Ana Gjoni', '']);
  assert.match(result.check[0][1], /^phone missing$/);
});

test('stops with a clear message when most rows do not match their headers', () => {
  const rows = [1, 2, 3, 4].map((i) => [String(i), `ana${i}@example.com`, `Person ${i}`, 'Tiranë', `069123456${i}`]);
  assert.throws(() => cleanList(albanianHeader, rows), /In most rows the email is not under "EMAIL" but under "EMRI"/);
});
