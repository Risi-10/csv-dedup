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

  const roleOf = (key) => (key.startsWith('role:') ? key.slice('role:'.length) : null);

  // Columns that only some of the files have, so the page can say which cells were left empty.
  function columnsNotInAllFiles(files, fileKeys, header, positionOfKey) {
    if (files.length < 2) return [];
    return [...positionOfKey].flatMap(([key, position]) => {
      const having = files.filter((_, f) => fileKeys[f].includes(key)).map((file) => file.name);
      return having.length < files.length ? [{ header: header[position], files: having }] : [];
    });
  }

  // files: [{ name, header, rows, rowNumbers }] as returned by readFile, plus the file name.
  // Returns one table for cleanList: { header, rows, sources, roles, columnsNotInAllFiles }.
  // sources[i] says which file and row rows[i] came from (the file name is left out when there
  // is only one file); roles[c] is what column c holds ("city", …) or null if we don't know.
  function combineFiles(files) {
    if (files.length === 0) throw new Error('No files to clean.');

    const header = [];
    const roles = [];
    const positionOfKey = new Map();
    const fileKeys = files.map((file) => {
      const keys = columnKeys(file);
      keys.forEach((key, i) => {
        if (positionOfKey.has(key)) return;
        positionOfKey.set(key, header.length);
        header.push(file.header[i]);
        roles.push(roleOf(key));
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

    return {
      header,
      rows,
      sources,
      roles,
      columnsNotInAllFiles: columnsNotInAllFiles(files, fileKeys, header, positionOfKey),
    };
  }

  const api = { combineFiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
