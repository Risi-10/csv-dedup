(function (root) {
  'use strict';

  // Country code used for numbers written without one. Change this for a non-US/Canada list.
  const DEFAULT_COUNTRY_CODE = '1';

  const MIN_DIGITS = 8;
  const MAX_DIGITS = 15; // E.164 maximum

  function international(digits) {
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
    return '+' + digits;
  }

  function national(digits, countryCode) {
    if (countryCode === '1') {
      if (digits.length === 10) return '+1' + digits;
      if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
      return null;
    }
    // Most other countries write a leading trunk "0" that is dropped after the country code.
    return international(countryCode + digits.replace(/^0/, ''));
  }

  // Returns { value, ok, reason }. When the number can't be read, value is the original text
  // so nothing is lost, and reason says why it needs checking.
  function normalizePhone(raw, countryCode = DEFAULT_COUNTRY_CODE) {
    const original = String(raw ?? '').trim();
    if (!original) return { value: '', ok: false, reason: 'phone missing' };

    const unreadable = { value: original, ok: false, reason: 'phone could not be read' };
    if (!/^\+?[\d\s().\-/]+$/.test(original)) return unreadable;

    const digits = original.replace(/\D/g, '');
    let value;
    if (original.startsWith('+')) value = international(digits);
    else if (digits.startsWith('00')) value = international(digits.slice(2));
    else value = national(digits, countryCode);

    return value ? { value, ok: true, reason: '' } : unreadable;
  }

  const api = { normalizePhone, DEFAULT_COUNTRY_CODE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
