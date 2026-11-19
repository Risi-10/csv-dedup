const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone } = require('../src/phones.js');

const value = (raw, country) => normalizePhone(raw, country).value;

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
  assert.equal(normalizePhone('555 0100').ok, false, 'too short');
  assert.equal(normalizePhone('55+5 010 0000').ok, false, 'plus in the middle');
});

test('flags missing numbers', () => {
  assert.deepEqual(normalizePhone('  '), { value: '', ok: false, reason: 'phone missing' });
});
