(function (root) {
  'use strict';

  const deps = typeof require === 'function'
    ? Object.assign({}, require('./names.js'), require('./phones.js'), require('./columns.js'))
    : root.Cleaner;
  const { fixName, nameKey, normalizePhone, detectColumns } = deps;

  // Where a row came from, as Elira would look it up in Excel: "row 7", or "a.csv row 7"
  // when several files were combined.
  const rowLabel = ({ file, row }) => (file ? `${file} row ${row}` : `row ${row}`);

  // Optimal string alignment distance: insertions, deletions, substitutions and swaps of
  // two neighbouring letters ("Jonh" -> "John" is 1).
  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }

  // Same person if every word matches with at most one typo per word (word order ignored).
  // A blank name is treated as matching, since the shared phone/email already ties the rows.
  function namesClose(a, b) {
    if (!a || !b || a === b) return true;
    // Pair each word with any unused word of the other name, rather than sorting both lists,
    // because a typo in a first letter ("Kela"/"Cela") changes where a word sorts.
    const unmatched = b.split(' ');
    const wordsA = a.split(' ');
    if (wordsA.length !== unmatched.length) return false;
    for (const word of wordsA) {
      const i = unmatched.findIndex((other) => editDistance(word, other) <= 1);
      if (i === -1) return false;
      unmatched.splice(i, 1);
    }
    return true;
  }

  function createUnionFind(size) {
    const parent = Array.from({ length: size }, (_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => {
      const [ra, rb] = [find(a), find(b)];
      // Keep the earliest row as the group's root so output order follows the file.
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };
    return { find, union };
  }

  function isBlankRow(row) {
    return row.every((cell) => String(cell ?? '').trim() === '');
  }

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // When values are moved by hand in Excel without their header, a row's email or phone ends up
  // under another column. Swap them back into their own columns. Returns what was moved, so the
  // row can be flagged. The ID column is never searched: a long numeric ID could look like a phone.
  function putContactsBack(cells, columns, countryCode) {
    const moved = [];
    const looksRight = {
      email: (value) => EMAIL_PATTERN.test(value),
      phone: (value) => normalizePhone(value, countryCode).ok,
    };
    for (const role of ['email', 'phone']) {
      const target = columns[role];
      if (target === null || looksRight[role](cells[target])) continue;
      const from = cells.findIndex((value, i) => i !== target && i !== columns.id && looksRight[role](value));
      if (from === -1) continue;
      [cells[target], cells[from]] = [cells[from], cells[target]];
      moved.push({ role, from, to: target });
    }
    return moved;
  }

  function cleanRecord(row, source, columns, countryCode, header) {
    const cells = row.map((cell) => String(cell ?? '').trim());
    const flags = [];
    const moved = putContactsBack(cells, columns, countryCode);
    if (moved.length) {
      const where = moved.map(({ role, from }) => `${role} was under "${header[from]}"`).join(', ');
      flags.push(`values were in the wrong columns (${where}); moved back, check this row`);
    }
    for (const role of ['name', 'firstName', 'lastName']) {
      if (columns[role] !== null) cells[columns[role]] = fixName(cells[columns[role]]);
    }

    let phone = '';
    if (columns.phone !== null) {
      const result = normalizePhone(cells[columns.phone], countryCode);
      cells[columns.phone] = result.value;
      if (result.ok) phone = result.value;
      else flags.push(result.reason);
    }

    let email = '';
    if (columns.email !== null) {
      email = cells[columns.email].toLowerCase();
      cells[columns.email] = email;
    }

    const displayName = columns.name !== null
      ? cells[columns.name]
      : [cells[columns.firstName], cells[columns.lastName]].filter(Boolean).join(' ');

    return {
      source,
      moved,
      cells,
      flags,
      id: columns.id !== null ? cells[columns.id] : '',
      phone,
      email,
      displayName,
      name: nameKey(displayName),
    };
  }

  function groupBy(records, key) {
    const groups = new Map();
    for (const record of records) {
      if (!record[key]) continue;
      if (!groups.has(record[key])) groups.set(record[key], []);
      groups.get(record[key]).push(record);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }

  function describe(record) {
    return `${rowLabel(record.source)} (${record.displayName || 'no name'})`;
  }

  // Sure matches are merged; near-misses are only flagged, so no real customer is lost.
  function findGroups(records) {
    const uf = createUnionFind(records.length);
    const position = new Map(records.map((r, i) => [r, i]));
    const pos = (r) => position.get(r);
    const conflicts = []; // [group, text]: rows that share something but may be different people

    for (const group of groupBy(records, 'id')) {
      group.forEach((r) => uf.union(pos(group[0]), pos(r)));
    }

    for (const key of ['email', 'phone']) {
      for (const group of groupBy(records, key)) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            if (namesClose(group[i].name, group[j].name)) uf.union(pos(group[i]), pos(group[j]));
          }
        }
        conflicts.push([group, `shares ${key} ${group[0][key]} with`]);
      }
    }

    for (const group of groupBy(records, 'name')) {
      conflicts.push([group, 'same name, different phone/email, as']);
    }

    const groups = new Map();
    records.forEach((record, i) => {
      const rootIndex = uf.find(i);
      if (!groups.has(rootIndex)) groups.set(rootIndex, []);
      groups.get(rootIndex).push(record);
    });

    // Only rows that ended up as separate customers need checking.
    for (const [group, text] of conflicts) flagSeparateCustomers(group, text, (r) => uf.find(pos(r)));

    return [...groups.values()];
  }

  const MAX_ROWS_LISTED = 3;

  // One flag per row naming a few of the other customers, rather than one flag per pair:
  // a common name shared by hundreds of rows would otherwise make the list unreadable
  // and run the browser out of memory.
  function flagSeparateCustomers(group, text, customerOf) {
    const firstRowOfCustomer = new Map();
    for (const record of group) {
      if (!firstRowOfCustomer.has(customerOf(record))) firstRowOfCustomer.set(customerOf(record), record);
    }
    if (firstRowOfCustomer.size < 2) return;

    for (const record of group) {
      const others = [];
      for (const [customer, first] of firstRowOfCustomer) {
        if (customer === customerOf(record)) continue;
        others.push(first);
        if (others.length > MAX_ROWS_LISTED) break;
      }
      const listed = others.slice(0, MAX_ROWS_LISTED).map(describe).join(', ');
      const moreCount = firstRowOfCustomer.size - 1 - MAX_ROWS_LISTED;
      record.flags.push(`${text} ${listed}${moreCount > 0 ? ` and ${moreCount} more` : ''}`);
    }
  }

  function countFilled(record) {
    return record.cells.filter(Boolean).length;
  }

  // The spelling most copies agree on, earliest row on a tie, so one typo'd copy can't win.
  function mostCommonName(members) {
    const named = members.filter((r) => r.name);
    const count = (r) => named.filter((other) => other.name === r.name).length;
    return named.reduce((best, r) => (count(r) > count(best) ? r : best), named[0]);
  }

  function mergeGroup(members, columns) {
    const base = members.reduce((best, r) => (countFilled(r) > countFilled(best) ? r : best));
    const cells = base.cells.map((value, col) => value || members.map((r) => r.cells[col]).find(Boolean) || '');

    const nameSource = mostCommonName(members);
    if (nameSource) {
      for (const role of ['name', 'firstName', 'lastName']) {
        if (columns[role] !== null) cells[columns[role]] = nameSource.cells[columns[role]];
      }
    }
    let flags = members.flatMap((r) => r.flags);

    // If any copy has a readable phone, use it and drop the other copies' phone warnings.
    const goodPhone = base.phone || members.map((r) => r.phone).find(Boolean);
    if (columns.phone !== null && goodPhone) {
      cells[columns.phone] = goodPhone;
      flags = flags.filter((f) => !f.startsWith('phone '));
    }
    flags = [...new Set(flags)];

    for (const role of ['phone', 'email']) {
      if (columns[role] === null) continue;
      const values = [...new Set(members.map((r) => r[role]).filter(Boolean))];
      if (values.length > 1) flags.push(`merged rows had different ${role}s: ${values.join(', ')} (kept ${cells[columns[role]]})`);
    }

    // Plain row numbers for a single file ("2, 3"); with several files each needs its file name.
    const rows = members.map(({ source }) => (source.file ? rowLabel(source) : source.row));
    return { cells, flags, rows };
  }

  function formatSummary(s) {
    const n = (x) => x.toLocaleString('en-US');
    const parts = [`${n(s.inputRows)} rows → ${n(s.outputRows)}`, `${n(s.duplicatesMerged)} duplicates merged`];
    if (s.emptyRows) parts.push(`${n(s.emptyRows)} empty ${s.emptyRows === 1 ? 'row' : 'rows'} removed`);
    parts.push(`${n(s.toCheck)} ${s.toCheck === 1 ? 'row' : 'rows'} to check`);
    return parts.join(' · ');
  }

  // A few rows with values in the wrong column are fixed one by one. When most rows need it,
  // the header row itself is out of place, and guessing every row would be risky.
  function checkHeadersMatchData(records, header) {
    const movedRecords = records.filter((r) => r.moved.length);
    if (movedRecords.length < 3 || movedRecords.length * 2 <= records.length) return;
    const { role, from, to } = movedRecords[0].moved[0];
    throw new Error(
      `In most rows the ${role} is not under "${header[to]}" but under "${header[from]}". `
      + 'The header row probably wasn\'t moved together with the data: check that each header is above its own column.',
    );
  }

  // header: array of column names; rows: arrays of cell values (without the header).
  // options.countryCode: for phones written without one (defaults to DEFAULT_COUNTRY_CODE).
  // options.sources: { file, row } for each row, from combineFiles; defaults to rows 2, 3, …
  function cleanList(header, rows, { countryCode, sources } = {}) {
    const columns = detectColumns(header);
    const width = header.length;
    const sourceOf = (index) => (sources ? sources[index] : { file: '', row: index + 2 });
    const records = rows
      .map((row, index) => ({ row, source: sourceOf(index) }))
      .filter(({ row }) => !isBlankRow(row))
      .map(({ row, source }) => cleanRecord(Array.from({ length: width }, (_, c) => row[c]), source, columns, countryCode, header));
    checkHeadersMatchData(records, header);

    const customers = findGroups(records).map((members) => mergeGroup(members, columns));
    const clean = customers.map((c) => c.cells);
    const check = customers
      .filter((c) => c.flags.length)
      .map((c) => [c.rows.join(', '), c.flags.join('; '), ...c.cells]);

    const summary = {
      inputRows: rows.length,
      outputRows: clean.length,
      emptyRows: rows.length - records.length,
      duplicatesMerged: records.length - clean.length,
      toCheck: check.length,
    };
    summary.text = formatSummary(summary);

    return {
      header: [...header],
      clean,
      checkHeader: ['Original row(s)', 'Why check', ...header],
      check,
      summary,
    };
  }

  const api = { cleanList, namesClose, editDistance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
