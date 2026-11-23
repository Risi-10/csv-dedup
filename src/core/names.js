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

  // Titles written before a name: English, and Albanian "Z." (Mr) / "Znj." (Mrs).
  const TITLES = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'ing', 'z', 'znj']);

  // For matching only, never shown: drops leading titles, dots and accents, so
  // "DR. AGIM LEKA" and "Agim Leka" match, and so do "Çela" and "Cela" (typed without ç/ë).
  function nameKey(value) {
    const words = collapseSpaces(value)
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\./g, ' ')
      .split(' ')
      .filter(Boolean);
    while (words.length > 1 && TITLES.has(words[0])) words.shift();
    return words.join(' ');
  }

  const api = { fixName, nameKey, collapseSpaces };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
