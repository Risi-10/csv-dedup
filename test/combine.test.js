const test = require('node:test');
const assert = require('node:assert/strict');
const { combineFiles } = require('../src/combine.js');
const { cleanList } = require('../src/dedupe.js');
const { readFile } = require('../src/parse.js');

const csvFile = (name, text) => ({ name, ...readFile(new TextEncoder().encode(text).buffer, name) });

test('lines up columns by what they hold, even in a different order or language', () => {
  const { header, rows } = combineFiles([
    csvFile('a.csv', 'EMRI,TELEFONI,QYTETI\nAna,0691234567,Tiranë\n'),
    csvFile('b.csv', 'Phone,Name,Notes\n0697654321,Ben,VIP\n'),
  ]);
  assert.deepEqual(header, ['EMRI', 'TELEFONI', 'QYTETI', 'Notes']);
  assert.deepEqual(rows, [
    ['Ana', '0691234567', 'Tiranë', ''],
    ['Ben', '0697654321', '', 'VIP'],
  ]);
});

test('keeps columns with the same header text apart within one file', () => {
  const { header, rows } = combineFiles([csvFile('a.csv', 'Name,Phone,,\nAna,0691234567,x,y\n')]);
  assert.equal(header.length, 4);
  assert.deepEqual(rows[0], ['Ana', '0691234567', 'x', 'y']);
});

test('merges a customer who appears in two files and says where each copy came from', () => {
  const { header, rows, sources } = combineFiles([
    csvFile('monday.csv', 'EMRI,TELEFONI\nARBEN HOXHA,0691234567\nBESNIK SHEHU,0684455667\n'),
    csvFile('tuesday.csv', 'EMRI,TELEFONI\narben hoxha,+355 69 123 4567\nANA GJONI,069 999 9999 9\n'),
  ]);
  const result = cleanList(header, rows, { sources });

  assert.deepEqual(result.clean, [
    ['Arben Hoxha', '+355691234567'],
    ['Besnik Shehu', '+355684455667'],
    ['Ana Gjoni', '069 999 9999 9'],
  ]);
  assert.equal(result.summary.duplicatesMerged, 1);
  assert.deepEqual(result.check.map((row) => row[0]), ['tuesday.csv row 3']);
});

test('row numbers point at the real Excel row after a repeated header is dropped', () => {
  const file = csvFile('a.csv', 'EMRI,TELEFONI\nAna,0691234567\nEMRI,TELEFONI\nBen,123\n');
  assert.deepEqual(file.rowNumbers, [2, 4]);
  const { header, rows, sources } = combineFiles([file]);
  const result = cleanList(header, rows, { sources });
  assert.deepEqual(result.check.map((row) => row[0]), ['4']);
});

test('names the file when one of them is missing a required column', () => {
  assert.throws(
    () => combineFiles([csvFile('good.csv', 'Name,Phone\nAna,1\n'), csvFile('bad.csv', 'City,Notes\nTiranë,x\n')]),
    /^Error: bad\.csv: Could not find a name column/,
  );
});
