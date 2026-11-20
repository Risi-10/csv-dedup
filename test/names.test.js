const test = require('node:test');
const assert = require('node:assert/strict');
const { fixName, nameKey } = require('../src/names.js');

test('fixes all-caps and all-lowercase names', () => {
  assert.equal(fixName('ANNA MÜLLER'), 'Anna Müller');
  assert.equal(fixName('maria garcia'), 'Maria Garcia');
});

test('removes extra spaces', () => {
  assert.equal(fixName('  John   Smith '), 'John Smith');
});

test('capitalizes after hyphens and apostrophes', () => {
  assert.equal(fixName("PETER O'BRIEN"), "Peter O'Brien");
  assert.equal(fixName('JOSÉ NÚÑEZ-PÉREZ'), 'José Núñez-Pérez');
});

test('leaves correctly mixed-case words alone', () => {
  assert.equal(fixName('Ronald McDonald'), 'Ronald McDonald');
  assert.equal(fixName('john McDONALD'), 'John McDONALD');
});

test('fixes each word on its own', () => {
  assert.equal(fixName('john SMITH'), 'John Smith');
});

test('handles empty values', () => {
  assert.equal(fixName(''), '');
  assert.equal(fixName(undefined), '');
});

test('nameKey ignores case and spacing', () => {
  assert.equal(nameKey('JOHN  SMITH'), nameKey('John Smith'));
});

test('nameKey ignores leading titles, dots and accents', () => {
  assert.equal(nameKey('DR. AGIM LEKA'), 'agim leka');
  assert.equal(nameKey('Znj. Elira Çela'), 'elira cela');
  assert.equal(nameKey('Jetmir Ç. Dervishi'), 'jetmir c dervishi');
  assert.equal(nameKey('Dr'), 'dr', 'a title alone is kept, so the name is not blank');
});
