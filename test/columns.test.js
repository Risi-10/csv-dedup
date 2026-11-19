const test = require('node:test');
const assert = require('node:assert/strict');
const { detectColumns } = require('../src/columns.js');

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
