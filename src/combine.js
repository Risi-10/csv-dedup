(function (root) {
  'use strict';

  const { detectColumns } = typeof require === 'function' ? require('./columns.js') : root.Cleaner;

  // A column is matched across files by what it holds (name, phone, …) when we know that,
  // otherwise by its header text, so files with columns in a different order still line up.
  function columnKeys(file) {
    let columns;
    try {
      columns = detectColumns(file.header);
    } catch (error) {
      throw new Error(`${file.name}: ${error.message}`);
    }
    // Count repeats so two columns with the same (often empty) header stay separate.
    const seen = new Map();
    const keys = file.header.map((h) => {
      const text = h.trim().toLowerCase();
      seen.set(text, (seen.get(text) || 0) + 1);
      return `header:${text}#${seen.get(text)}`;
    });
    for (const [role, index] of Object.entries(columns)) {
      if (index !== null) keys[index] = 'role:' + role;
    }
    return keys;
  }

  // files: [{ name, header, rows, rowNumbers }] as returned by readFile, plus the file name.
  // Returns one table for cleanList: { header, rows, sources }, where sources[i] says which
  // file and row rows[i] came from. The file name is left out when there is only one file.
  function combineFiles(files) {
    if (files.length === 0) throw new Error('No files to clean.');

    const header = [];
    const positionOfKey = new Map();
    const fileKeys = files.map((file) => {
      const keys = columnKeys(file);
      keys.forEach((key, i) => {
        if (positionOfKey.has(key)) return;
        positionOfKey.set(key, header.length);
        header.push(file.header[i]);
      });
      return keys;
    });

    const rows = [];
    const sources = [];
    files.forEach((file, f) => {
      const positions = fileKeys[f].map((key) => positionOfKey.get(key));
      file.rows.forEach((row, r) => {
        const combined = new Array(header.length).fill('');
        positions.forEach((position, c) => {
          combined[position] = row[c] ?? '';
        });
        rows.push(combined);
        sources.push({ file: files.length > 1 ? file.name : '', row: file.rowNumbers[r] });
      });
    });

    return { header, rows, sources };
  }

  const api = { combineFiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
