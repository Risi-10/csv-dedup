(function (root) {
  'use strict';

  // Header names are compared after lowercasing and removing everything but letters/digits,
  // so "E-Mail", "e_mail" and "Email " all become "email".
  const COLUMN_NAMES = {
    id: ['customerid', 'custid', 'clientid', 'customerno', 'customernumber', 'customernr', 'id', 'kundennummer', 'kundenid', 'idklienti', 'kodiklienti'],
    email: ['email', 'emailaddress', 'mail', 'emailadresse', 'emaili', 'postaelektronike'],
    phone: ['phone', 'phonenumber', 'telephone', 'tel', 'mobile', 'mobilephone', 'cell', 'telefon', 'handy', 'telefoni', 'nrtelefoni', 'numritelefonit', 'celulari'],
    firstName: ['firstname', 'first', 'givenname', 'forename', 'vorname', 'emri'],
    lastName: ['lastname', 'last', 'surname', 'familyname', 'nachname', 'mbiemri'],
    name: ['name', 'fullname', 'customername', 'customer', 'kunde', 'kundenname', 'emri', 'emriplotë', 'emriplote', 'emrimbiemri', 'emridhembiemri', 'klienti'],
  };

  function normalizeHeader(header) {
    return String(header ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  // Some headers mean "full name" on their own but "first name" next to a surname column
  // (Albanian "Emri" alongside "Mbiemri"), so they are listed under both roles.
  function resolveSharedNameColumn(columns) {
    if (columns.name === null || columns.name !== columns.firstName) return;
    if (columns.lastName !== null) columns.name = null;
    else columns.firstName = null;
  }

  function detectColumns(headers) {
    const normalized = headers.map(normalizeHeader);
    const columns = {};
    for (const [role, names] of Object.entries(COLUMN_NAMES)) {
      const index = normalized.findIndex((h) => names.includes(h));
      columns[role] = index === -1 ? null : index;
    }
    resolveSharedNameColumn(columns);

    const hasName = columns.name !== null || (columns.firstName !== null && columns.lastName !== null);
    const hasContact = columns.phone !== null || columns.email !== null || columns.id !== null;
    if (!hasName || !hasContact) {
      const missing = [!hasName && 'a name column', !hasContact && 'a phone, email or customer ID column']
        .filter(Boolean)
        .join(' and ');
      const found = headers.filter((h) => String(h).trim()).join(', ') || 'none';
      throw new Error(`Could not find ${missing}. Columns in this file: ${found}.`);
    }
    return columns;
  }

  const api = { detectColumns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
