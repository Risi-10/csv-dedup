(function () {
  'use strict';

  const { readFile, cleanList, toCsv } = window.Cleaner;
  const PREVIEW_ROWS = 50;
  const $ = (id) => document.getElementById(id);

  let current = null; // { result, separator, baseName }

  function showError(message) {
    $('error').textContent = message;
    $('error').hidden = false;
    $('result').hidden = true;
  }

  function renderTable(table, header, rows) {
    table.replaceChildren();
    const headRow = table.createTHead().insertRow();
    for (const name of header) {
      const th = document.createElement('th');
      th.textContent = name;
      headRow.appendChild(th);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      for (const cell of row) tr.insertCell().textContent = cell;
    }
  }

  function render(result) {
    $('summary').textContent = result.summary.text;
    $('check-section').hidden = result.check.length === 0;
    $('download-check').hidden = result.check.length === 0;
    renderTable($('check-table'), result.checkHeader, result.check);
    renderTable($('clean-table'), result.header, result.clean.slice(0, PREVIEW_ROWS));
    $('preview-note').textContent = result.clean.length > PREVIEW_ROWS
      ? `(first ${PREVIEW_ROWS} of ${result.clean.length.toLocaleString('en-US')})`
      : '';
    $('error').hidden = true;
    $('result').hidden = false;
  }

  async function handleFile(file) {
    if (!file) return;
    try {
      const { header, rows, separator } = readFile(await file.arrayBuffer(), file.name, window.XLSX);
      const result = cleanList(header, rows);
      current = { result, separator, baseName: file.name.replace(/\.[^.]+$/, '') };
      render(result);
    } catch (error) {
      console.error(error);
      showError(`Couldn't clean this file. ${error.message}`);
    }
  }

  function download(content, fileName, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Every cell is written as text so Excel keeps the "+" on phone numbers.
  function toXlsx(header, rows, sheetName) {
    const XLSX = window.XLSX;
    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows].map((row) => row.map(String)));
    sheet['!cols'] = header.map((_, col) => ({
      wch: Math.min(60, Math.max(8, ...[header, ...rows].map((row) => String(row[col] ?? '').length))),
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, sheetName);
    return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  }

  const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  $('download-clean-xlsx').addEventListener('click', () => {
    const { result, baseName } = current;
    download(toXlsx(result.header, result.clean, 'Clean list'), `${baseName}-clean.xlsx`, XLSX_TYPE);
  });

  $('download-clean-csv').addEventListener('click', () => {
    const { result, separator, baseName } = current;
    // The BOM tells Excel the file is UTF-8, so "Müller" opens correctly.
    const csv = '﻿' + toCsv([result.header, ...result.clean], separator);
    download(csv, `${baseName}-clean.csv`, 'text/csv;charset=utf-8');
  });

  $('download-check').addEventListener('click', () => {
    const { result, baseName } = current;
    download(toXlsx(result.checkHeader, result.check, 'Rows to check'), `${baseName}-check.xlsx`, XLSX_TYPE);
  });

  const THEME_KEY = 'theme';
  const themeButton = $('theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeButton.textContent = theme === 'dark' ? '☀ Light mode' : '☾ Dark mode';
  }

  function savedTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  themeButton.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      // Storage blocked: the switch still works, it just won't be remembered next time.
      console.warn('Could not save theme choice:', error);
    }
  });
  // Until a choice is saved, keep following the computer's setting.
  systemDark.addEventListener('change', (event) => {
    if (!savedTheme()) applyTheme(event.matches ? 'dark' : 'light');
  });
  applyTheme(document.documentElement.dataset.theme);

  const dropZone = $('drop-zone');
  $('file-input').addEventListener('change', (event) => {
    handleFile(event.target.files[0]);
    event.target.value = ''; // allow choosing the same file again
  });
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
    handleFile(event.dataTransfer.files[0]);
  });
  // Dropping a file anywhere else would make the browser open it and leave the page.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
})();
