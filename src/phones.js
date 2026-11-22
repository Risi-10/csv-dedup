(function (root) {
  'use strict';

  // Country code used for numbers written without one (the customers are mostly in Albania).
  const DEFAULT_COUNTRY_CODE = '355';

  const MIN_DIGITS = 8;
  const MAX_DIGITS = 15; // E.164 maximum

  // The digits after the country code, for countries where we know the exact shape, so a
  // number with a digit missing or extra is flagged instead of passed on as if it were fine.
  const NATIONAL_NUMBER = {
    355: /^(6[6-9]\d{7}|[2-58]\d{7})$/, // Albania: mobile 6x + 7 digits, landline 8 digits
    383: /^[2-4]\d{7}$/, // Kosovo: mobile 4x and landline 2x/3x, 8 digits
  };

  function hasValidLength(value) {
    const code = Object.keys(NATIONAL_NUMBER).find((c) => value.startsWith('+' + c));
    return !code || NATIONAL_NUMBER[code].test(value.slice(code.length + 1));
  }

  function international(digits) {
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
    if (digits.startsWith('0')) return null; // no country code starts with 0
    return '+' + digits;
  }

  function national(digits, countryCode) {
    if (countryCode === '1') {
      if (digits.length === 10) return '+1' + digits;
      if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
      return null;
    }
    // "355 69 …" is an international number with the "+" left off.
    const withoutPlus = '+' + digits;
    if (digits.startsWith(countryCode) && NATIONAL_NUMBER[countryCode] && hasValidLength(withoutPlus)) {
      return withoutPlus;
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
    if (/^\d+([.,]\d+)?E\+?\d+$/i.test(original)) {
      // Excel rounded the number (355692000000 → 3.55692E+11); the lost digits can't be recovered.
      return { value: original, ok: false, reason: 'phone was shortened by Excel, copy it again from the old system' };
    }
    if (!/^\+?[\d\s().\-/]+$/.test(original)) return unreadable;

    // "+355 (0)69 …" shows the trunk 0 for local callers; it isn't dialled after the country code.
    const digits = original.replace(/^(\+\d+\s*)\(0\)/, '$1').replace(/\D/g, '');
    let value;
    if (original.startsWith('+')) value = international(digits);
    else if (digits.startsWith('00')) value = international(digits.slice(2));
    else value = national(digits, countryCode);

    if (!value) return unreadable;
    if (!hasValidLength(value)) return { value: original, ok: false, reason: 'phone has too few or too many digits' };
    return { value, ok: true, reason: '' };
  }

  const api = { normalizePhone, DEFAULT_COUNTRY_CODE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
