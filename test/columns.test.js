const test = require('node:test');
const assert = require('node:assert/strict');
const { detectColumns, headerInLanguage, HEADER_LABELS } = require('../src/core/columns.js');

test('finds columns regardless of case and punctuation', () => {
  const columns = detectColumns(['Customer ID', 'Full Name', 'E-Mail', 'Phone Number', 'City']);
  assert.deepEqual(
    { id: columns.id, name: columns.name, email: columns.email, phone: columns.phone },
    { id: 0, name: 1, email: 2, phone: 3 },
  );
});

test('accepts separate first and last name columns', () => {
  const columns = detectColumns(['First Name', 'Last Name', 'Mobile']);
  assert.equal(columns.firstName, 0);
  assert.equal(columns.lastName, 1);
  assert.equal(columns.phone, 2);
});

test('explains clearly when a required column is missing', () => {
  assert.throws(() => detectColumns(['City', 'Phone']), /a name column.*Columns in this file: City, Phone/);
  assert.throws(() => detectColumns(['Name', 'City']), /a phone, email or customer ID column/);
});

test('recognizes Albanian headers', () => {
  const columns = detectColumns(['ID', 'EMRI', 'TELEFONI', 'EMAIL', 'QYTETI']);
  assert.deepEqual(
    { id: columns.id, name: columns.name, firstName: columns.firstName, phone: columns.phone, email: columns.email },
    { id: 0, name: 1, firstName: null, phone: 2, email: 3 },
  );
});

test('treats "Emri" as first name when a "Mbiemri" column is present', () => {
  const columns = detectColumns(['Emri', 'Mbiemri', 'Telefoni']);
  assert.equal(columns.name, null);
  assert.equal(columns.firstName, 0);
  assert.equal(columns.lastName, 1);
});

test('recognizes optional columns in Albanian, English and German', () => {
  const columns = detectColumns(['Emri', 'Telefoni', 'Qyteti', 'Address', 'PLZ', 'Datëlindja', 'Shënime', 'Land']);
  assert.deepEqual(
    [columns.city, columns.address, columns.postalCode, columns.birthday, columns.notes, columns.country],
    [2, 3, 4, 5, 6, 7],
  );
});

test('renames known columns for the download and keeps unknown ones', () => {
  const header = ['ID', 'EMRI', 'TELEFONI', 'QYTETI', 'Fax'];
  const roles = ['id', 'name', 'phone', 'city', null];
  assert.deepEqual(headerInLanguage(header, roles, 'en'), ['Customer ID', 'Name', 'Phone', 'City', 'Fax']);
  assert.deepEqual(headerInLanguage(header, roles, 'sq'), ['ID Klienti', 'Emri', 'Telefoni', 'Qyteti', 'Fax']);
  assert.deepEqual(headerInLanguage(header, roles, 'original'), header);
});

test('a clean file with translated column names can be read again', () => {
  for (const labels of Object.values(HEADER_LABELS)) {
    const roles = ['id', 'name', 'phone', 'email', 'city', 'address', 'country', 'postalCode', 'birthday', 'notes'];
    const columns = detectColumns(roles.map((role) => labels[role]));
    roles.forEach((role, i) => assert.equal(columns[role], i, `${labels[role]} → ${role}`));
  }
  const split = detectColumns(['First name', 'Last name', 'Phone']);
  assert.deepEqual([split.firstName, split.lastName], [0, 1]);
});
