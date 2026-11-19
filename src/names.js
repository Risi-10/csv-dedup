(function (root) {
  'use strict';

  function collapseSpaces(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function isSingleCase(word) {
    const upper = word.toLocaleUpperCase();
    const lower = word.toLocaleLowerCase();
    return upper !== lower && (word === upper || word === lower);
  }

  function capitalizeWord(word) {
    // Capitalize after hyphens and apostrophes too: "o'brien" -> "O'Brien", "núñez-pérez" -> "Núñez-Pérez".
    return word
      .toLocaleLowerCase()
      .replace(/(^|[-'’])(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase());
  }

  // Only re-case words that are ALL CAPS or all lowercase, so names that are already
  // written correctly with mixed case ("McDonald", "DiCaprio") are left alone.
  function fixName(value) {
    return collapseSpaces(value)
      .split(' ')
      .map((word) => (isSingleCase(word) ? capitalizeWord(word) : word))
      .join(' ');
  }

  function nameKey(value) {
    return collapseSpaces(value).toLocaleLowerCase();
  }

  const api = { fixName, nameKey, collapseSpaces };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
