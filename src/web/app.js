(function () {
  'use strict';

  const { readFile, combineFiles, cleanList, toCsv, headerInLanguage } = window.Cleaner;
  const PREVIEW_ROWS = 50;
  const $ = (id) => document.getElementById(id);

  // Opened from the cleaning server (http/https): files are sent to POST /api/clean. Opened as the
  // offline file (file://): everything is cleaned in this browser and nothing leaves the computer.
  const SERVER_MODE = location.protocol === 'http:' || location.protocol === 'https:';

  let current = null; // { result, roles, columnsNotInAllFiles, separator, baseName }
  // Files added so far, in order, each with name and rowCount. Offline: readFile output.
  // Server mode: { name, file } until the server reports rowCount.
  let loaded = [];
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
      name.textContent = file.rowCount === undefined
        ? file.name
        : `${file.name} (${file.rowCount.toLocaleString('en-US')} rows)`;
      const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Remove' });
      remove.addEventListener('click', () => {
        loaded = loaded.filter((other) => other !== file);
        enqueue(rebuild);
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

  function cleanInBrowser(files) {
    const { header, rows, sources, roles, columnsNotInAllFiles } = combineFiles(files);
    const result = cleanList(header, rows, { sources });
    return { result, roles, columnsNotInAllFiles, separator: files[0].separator };
  }

  // Same result shape as cleanInBrowser. Column names come back as in the first file; the page
  // renames them itself, so changing the language needs no new request.
  async function cleanOnServer(files) {
    const form = new FormData();
    for (const { file } of files) form.append('files', file, file.name);
    let response;
    try {
      response = await fetch('api/clean', { method: 'POST', body: form });
    } catch (error) {
      console.error(error);
      throw new Error('Could not reach the cleaning server. Check that it is still running.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `The cleaning server answered with error ${response.status}.`);
    body.files.forEach(({ rows }, i) => {
      files[i].rowCount = rows;
    });
    const { summary, header, clean, checkHeader, check, roles, columnsNotInAllFiles, separator } = body;
    return { result: { summary, header, clean, checkHeader, check }, roles, columnsNotInAllFiles, separator };
  }

  // All loaded files are cleaned as one list, so a customer in two exports ends up in it once.
  async function rebuild() {
    renderFileList();
    $('error').hidden = true;
    if (loaded.length === 0) {
      current = null;
      $('result').hidden = true;
      return;
    }
    const cleaned = SERVER_MODE ? await cleanOnServer(loaded) : cleanInBrowser(loaded);
    const baseName = loaded.length === 1 ? loaded[0].name.replace(/\.[^.]+$/, '') : 'combined-list';
    current = { ...cleaned, baseName };
    renderFileList();
    render();
  }

  // A file with the same name as a loaded one replaces it, since that is usually a corrected
  // copy of the same export.
  function withFiles(list, added) {
    const result = [...list];
    for (const entry of added) {
      const existing = result.findIndex((other) => other.name === entry.name);
      if (existing === -1) result.push(entry);
      else result[existing] = entry;
    }
    return result;
  }

  // Reads one file and checks it has the columns we need, so a bad file is turned away
  // on its own instead of blocking the files that are already loaded.
  async function readCheckedFile(file) {
    try {
      const table = { name: file.name, ...readFile(await file.arrayBuffer(), file.name, window.XLSX) };
      combineFiles([table]);
      return { ...table, rowCount: table.rows.length };
    } catch (error) {
      throw new Error(error.message.startsWith(`${file.name}:`) ? error.message : `${file.name}: ${error.message}`);
    }
  }

  // Returns the error messages for files that couldn't be added.
  async function addFilesInBrowser(files) {
    const errors = [];
    for (const file of files) {
      try {
        loaded = withFiles(loaded, [await readCheckedFile(file)]);
      } catch (error) {
        console.error(error);
        errors.push(error.message);
      }
    }
    try {
      await rebuild();
    } catch (error) {
      console.error(error);
      errors.push(error.message);
    }
    return errors;
  }

  // The server cleans all files in one request and stops at the first bad one, naming it. That
  // file is left out and the rest are tried again, so, as offline, one bad file doesn't block the
  // others. Any other error keeps the files as they were before.
  async function addFilesOnServer(files) {
    const before = loaded;
    const errors = [];
    let pending = files;
    while (pending.length) {
      loaded = withFiles(before, pending.map((file) => ({ name: file.name, file })));
      try {
        await rebuild();
        return errors;
      } catch (error) {
        console.error(error);
        errors.push(error.message);
        const bad = pending.find((file) => error.message.startsWith(`${file.name}:`));
        if (!bad) break;
        pending = pending.filter((file) => file !== bad);
      }
    }
    loaded = before;
    renderFileList();
    return errors;
  }

  async function addFiles(files) {
    const errors = SERVER_MODE ? await addFilesOnServer(files) : await addFilesInBrowser(files);
    if (errors.length) showError(`Couldn't add ${errors.length === 1 ? 'this file' : 'these files'}. ${errors.join(' ')}`);
  }

  // Runs changes to the file list one after another, so quick drops keep their order and a slow
  // server answer can't overwrite a newer one.
  function enqueue(task) {
    queue = queue.then(task).catch((error) => {
      console.error(error);
      showError(error.message);
    });
  }

  function handleFiles(fileList) {
    const files = [...fileList];
    if (files.length) enqueue(() => addFiles(files));
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
    enqueue(rebuild);
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

  if (SERVER_MODE) {
    $('lead').textContent = "Drop Monday's customer export here to get a clean list back. "
      + `Files are sent to the cleaning server (${location.host}), cleaned in memory and not stored.`;
  }

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
