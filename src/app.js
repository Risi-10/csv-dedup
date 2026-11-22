(function () {
  'use strict';

  const { readFile, combineFiles, cleanList, toCsv, headerInLanguage } = window.Cleaner;
  const PREVIEW_ROWS = 50;
  const $ = (id) => document.getElementById(id);

  let current = null; // { result, roles, columnsNotInAllFiles, separator, baseName }
  let loaded = []; // files read so far, in the order they were added: readFile output plus name
  let queue = Promise.resolve(); // handles drops one after another, so quick drops keep their order

  function showError(message) {
    $('error').textContent = message;
    $('error').hidden = false;
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

  function renderFileList() {
    const list = $('file-list');
    list.replaceChildren();
    for (const file of loaded) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${file.name} (${file.rows.length.toLocaleString('en-US')} rows)`;
      const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Remove' });
      remove.addEventListener('click', () => {
        loaded = loaded.filter((other) => other !== file);
        rebuild();
      });
      item.append(name, remove);
      list.appendChild(item);
    }
    $('files').hidden = loaded.length === 0;
    $('drop-title').textContent = loaded.length ? 'Drag another export here to add it' : 'Drag the export here';
  }

  // The column names chosen for the clean file; the cleaning itself doesn't depend on them.
  function outputHeader() {
    return headerInLanguage(current.result.header, current.roles, $('header-language').value);
  }

  function outputCheckHeader() {
    return [...current.result.checkHeader.slice(0, 2), ...outputHeader()];
  }

  function describeColumnsNotInAllFiles(columns) {
    const list = columns.map(({ header, files }) => `${header} (${files.join(', ')})`).join('; ');
    return `Columns only in some files, left empty for the others: ${list}.`;
  }

  function render() {
    const { result, columnsNotInAllFiles } = current;
    const filesNote = loaded.length > 1 ? `${loaded.length} files combined · ` : '';
    $('summary').textContent = filesNote + result.summary.text;
    $('columns-note').hidden = columnsNotInAllFiles.length === 0;
    $('columns-note').textContent = describeColumnsNotInAllFiles(columnsNotInAllFiles);
    $('check-section').hidden = result.check.length === 0;
    $('download-check').hidden = result.check.length === 0;
    renderTable($('check-table'), outputCheckHeader(), result.check);
    renderTable($('clean-table'), outputHeader(), result.clean.slice(0, PREVIEW_ROWS));
    $('preview-note').textContent = result.clean.length > PREVIEW_ROWS
      ? `(first ${PREVIEW_ROWS} of ${result.clean.length.toLocaleString('en-US')})`
      : '';
    $('result').hidden = false;
  }

  // All loaded files are cleaned as one list, so a customer in two exports ends up in it once.
  function rebuild() {
    renderFileList();
    $('error').hidden = true;
    if (loaded.length === 0) {
      current = null;
      $('result').hidden = true;
      return;
    }
    const { header, rows, sources, roles, columnsNotInAllFiles } = combineFiles(loaded);
    const result = cleanList(header, rows, { sources });
    const baseName = loaded.length === 1 ? loaded[0].name.replace(/\.[^.]+$/, '') : 'combined-list';
    current = { result, roles, columnsNotInAllFiles, separator: loaded[0].separator, baseName };
    render();
  }

  // Reads one file and checks it has the columns we need, so a bad file is turned away
  // on its own instead of blocking the files that are already loaded.
  async function readCheckedFile(file) {
    try {
      const table = { name: file.name, ...readFile(await file.arrayBuffer(), file.name, window.XLSX) };
      combineFiles([table]);
      return table;
    } catch (error) {
      throw new Error(error.message.startsWith(`${file.name}:`) ? error.message : `${file.name}: ${error.message}`);
    }
  }

  // Adds to the files already loaded. A file with the same name as a loaded one replaces it,
  // since that is usually a corrected copy of the same export.
  async function addFiles(fileList) {
    const errors = [];
    for (const file of fileList) {
      try {
        const table = await readCheckedFile(file);
        const existing = loaded.findIndex((other) => other.name === table.name);
        if (existing === -1) loaded.push(table);
        else loaded[existing] = table;
      } catch (error) {
        console.error(error);
        errors.push(error.message);
      }
    }
    try {
      rebuild();
    } catch (error) {
      console.error(error);
      errors.push(error.message);
    }
    if (errors.length) showError(`Couldn't add ${errors.length === 1 ? 'this file' : 'these files'}. ${errors.join(' ')}`);
  }

  function handleFiles(fileList) {
    const files = [...fileList];
    if (files.length) queue = queue.then(() => addFiles(files));
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
    download(toXlsx(outputHeader(), result.clean, 'Clean list'), `${baseName}-clean.xlsx`, XLSX_TYPE);
  });

  $('download-clean-csv').addEventListener('click', () => {
    const { result, separator, baseName } = current;
    // The BOM tells Excel the file is UTF-8, so "Müller" opens correctly.
    const csv = '﻿' + toCsv([outputHeader(), ...result.clean], separator);
    download(csv, `${baseName}-clean.csv`, 'text/csv;charset=utf-8');
  });

  $('start-over').addEventListener('click', () => {
    loaded = [];
    rebuild();
  });

  $('download-check').addEventListener('click', () => {
    const { result, baseName } = current;
    download(toXlsx(outputCheckHeader(), result.check, 'Rows to check'), `${baseName}-check.xlsx`, XLSX_TYPE);
  });

  const HEADER_LANGUAGE_KEY = 'header-language';
  const headerLanguage = $('header-language');
  try {
    const saved = localStorage.getItem(HEADER_LANGUAGE_KEY);
    if ([...headerLanguage.options].some((option) => option.value === saved)) headerLanguage.value = saved;
  } catch (error) {
    console.warn('Could not read the saved column-name choice:', error);
  }
  headerLanguage.addEventListener('change', () => {
    try {
      localStorage.setItem(HEADER_LANGUAGE_KEY, headerLanguage.value);
    } catch (error) {
      // Storage blocked: the choice still applies now, it just won't be remembered next time.
      console.warn('Could not save the column-name choice:', error);
    }
    if (current) render();
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
    handleFiles(event.target.files);
    event.target.value = ''; // allow choosing the same files again
  });
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
    handleFiles(event.dataTransfer.files);
  });
  // Dropping a file anywhere else would make the browser open it and leave the page.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
})();
