const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone } = require('../src/phones.js');

// Most examples are from the project brief, which uses US numbers.
const value = (raw, country = '1') => normalizePhone(raw, country).value;

test('formats the brief\'s examples the same way', () => {
  for (const raw of ['+1 (555) 010-0000', '555 010 0000', '5550100000', '555.010.0000', '1-555-010-0000']) {
    assert.equal(value(raw), '+15550100000', raw);
  }
});

test('handles the 00 international prefix', () => {
  assert.equal(value('001 555 010 0000'), '+15550100000');
  assert.equal(value('0049 30 1234567'), '+49301234567');
});

test('keeps other countries\' codes', () => {
  assert.equal(value('+52 55 1234 5678'), '+525512345678');
});

test('drops the trunk 0 for a non-US default country', () => {
  assert.equal(value('030 1234567', '49'), '+49301234567');
});

test('keeps unreadable numbers and says why', () => {
  assert.deepEqual(normalizePhone('call after 5'), { value: 'call after 5', ok: false, reason: 'phone could not be read' });
  assert.equal(normalizePhone('555 0100', '1').ok, false, 'too short');
  assert.equal(normalizePhone('55+5 010 0000').ok, false, 'plus in the middle');
});

test('flags missing numbers', () => {
  assert.deepEqual(normalizePhone('  '), { value: '', ok: false, reason: 'phone missing' });
});

test('drops a "(0)" written after the country code', () => {
  assert.equal(value('+355(0)69 888 7766'), '+355698887766');
  assert.equal(value('+44 (0)20 7946 0000'), '+442079460000');
});

test('reads Albanian numbers in every common way of writing them', () => {
  for (const raw of ['0691234567', '069 123 4567', '069-123-4567', '(069) 123 4567', '691234567',
    '+355 69 123 4567', '+355(0)69 123 4567', '00355691234567', '355691234567']) {
    assert.equal(normalizePhone(raw).value, '+355691234567', raw);
  }
  assert.equal(normalizePhone('04 2234 568').value, '+35542234568', 'Tirana landline');
  assert.equal(normalizePhone('+383 44 123 456').value, '+38344123456', 'Kosovo mobile');
});

test('flags Albanian and Kosovo numbers with a digit missing or extra', () => {
  for (const raw of ['069 123 456', '069 123 45678', '+355 69 123 456', '+383 44 123 45']) {
    assert.deepEqual(normalizePhone(raw), { value: raw, ok: false, reason: 'phone has too few or too many digits' }, raw);
  }
});

test('rejects placeholder numbers like all zeros', () => {
  assert.equal(normalizePhone('0000000000').ok, false);
});

test('explains numbers Excel turned into scientific notation', () => {
  const result = normalizePhone('3.55692E+11');
  assert.equal(result.ok, false);
  assert.match(result.reason, /shortened by Excel/);
});
