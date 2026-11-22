(function (root) {
  'use strict';

  const SEPARATORS = [',', ';', '\t'];

  // Excel on Windows often saves CSVs as Windows-1252 instead of UTF-8. Try UTF-8 strictly first,
  // and fall back so "MÜLLER" doesn't turn into garbage.
  function decodeBytes(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  function firstLine(text) {
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (text[i] === '\n' || text[i] === '\r')) return text.slice(0, i);
    }
    return text;
  }

  function detectSeparator(text) {
    const header = firstLine(text).replace(/"[^"]*"/g, '');
    const count = (sep) => header.split(sep).length - 1;
    return SEPARATORS.reduce((best, sep) => (count(sep) > count(best) ? sep : best));
  }

  function parseCsv(text, separator) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === separator) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row);
        row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function escapeCsvCell(value, separator) {
    const text = String(value ?? '');
    return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(rows, separator) {
    return rows.map((row) => row.map((cell) => escapeCsvCell(cell, separator)).join(separator)).join('\r\n') + '\r\n';
  }

  function dropTrailingEmptyRows(rows) {
    const isEmpty = (row) => row.every((cell) => String(cell ?? '').trim() === '');
    let end = rows.length;
    while (end > 0 && isEmpty(rows[end - 1])) end--;
    return rows.slice(0, end);
  }

  function readSpreadsheet(bytes, XLSX) {
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // raw: false gives the text Excel shows, so phone numbers keep their formatting.
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  }

  // Returns { header, rows, separator }. separator is the CSV separator to use for the download
  // (same as the input, so Excel in the user's locale opens it the same way).
  function readFile(arrayBuffer, fileName, XLSX) {
    const bytes = new Uint8Array(arrayBuffer);
    let table;
    let separator = ',';

    if (/\.(xlsx|xlsm|xls)$/i.test(fileName)) {
      table = readSpreadsheet(bytes, XLSX);
    } else if (/\.(csv|txt)$/i.test(fileName)) {
      const text = decodeBytes(bytes);
      separator = detectSeparator(text);
      table = parseCsv(text, separator);
    } else {
      throw new Error('Please use a .csv or .xlsx file.');
    }

    table = dropTrailingEmptyRows(table);
    if (table.length < 2) throw new Error('The file has no customer rows.');
    const header = table[0].map((h) => String(h ?? '').trim());
    return { header, rows: dropRepeatedHeaders(table.slice(1), header), separator };
  }

  // Exports glued together from several pages repeat the header row partway down.
  function dropRepeatedHeaders(rows, header) {
    const key = (row) => row.map((cell) => String(cell ?? '').trim().toLowerCase()).join('\u0000');
    const headerKey = key(header);
    return rows.filter((row) => key(row) !== headerKey);
  }

  const api = { decodeBytes, detectSeparator, parseCsv, toCsv, readFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
