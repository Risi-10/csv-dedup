const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../vendor/xlsx.full.min.js');
const { decodeBytes, detectSeparator, parseCsv, toCsv, readFile } = require('../src/core/parse.js');

test('decodes UTF-8 with or without BOM', () => {
  const utf8 = new TextEncoder().encode('Name\nMÜLLER');
  assert.equal(decodeBytes(utf8), 'Name\nMÜLLER');
  assert.equal(decodeBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8])), 'Name\nMÜLLER');
});

test('falls back to Windows-1252 for Excel-saved CSVs', () => {
  // "MÜLLER" in Windows-1252: Ü is 0xDC, which is invalid UTF-8 on its own.
  assert.equal(decodeBytes(new Uint8Array([0x4d, 0xdc, 0x4c, 0x4c, 0x45, 0x52])), 'MÜLLER');
});

test('detects the separator from the header row', () => {
  assert.equal(detectSeparator('Name;Phone;City\nA, B;1;x'), ';');
  assert.equal(detectSeparator('Name,Phone\n1;2;3;4'), ',');
  assert.equal(detectSeparator('"Last; First",Phone\n'), ',');
});

test('parses quoted cells with separators, quotes and line breaks', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi""","line\nbreak"\r\nd,e,f,g', ','), [
    ['a', 'b, c', 'say "hi"', 'line\nbreak'],
    ['d', 'e', 'f', 'g'],
  ]);
});

test('toCsv round-trips through parseCsv', () => {
  const rows = [['Name', 'Note'], ["O'Brien; Peter", 'a "quote"']];
  assert.deepEqual(parseCsv(toCsv(rows, ';'), ';').slice(0, 2), rows);
});

test('reads .xlsx files with phone numbers as text', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Name', 'Phone'], ['ANNA', '+1 555 010 0000']]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const { header, rows } = readFile(bytes, 'export.xlsx', XLSX);
  assert.deepEqual(header, ['Name', 'Phone']);
  assert.deepEqual(rows, [['ANNA', '+1 555 010 0000']]);
});

test('rejects other file types and empty files', () => {
  assert.throws(() => readFile(new ArrayBuffer(0), 'list.pdf', XLSX), /\.csv or \.xlsx/);
  assert.throws(() => readFile(new TextEncoder().encode('Name;Phone\n;\n').buffer, 'list.csv', XLSX), /no customer rows/);
});

test('drops header rows repeated partway down the file', () => {
  const csv = 'ID,EMRI,TELEFONI\n1,Ana,0691234567\nID,EMRI,TELEFONI\n2,Ben,0697654321\n';
  const { rows } = readFile(new TextEncoder().encode(csv).buffer, 'export.csv');
  assert.deepEqual(rows.map((row) => row[0]), ['1', '2']);
});
