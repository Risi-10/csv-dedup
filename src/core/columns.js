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
    // Not needed for cleaning; known so the same column lines up across files in different
    // languages ("Qyteti" and "City") and can be renamed in the download.
    city: ['city', 'town', 'stadt', 'ort', 'wohnort', 'qyteti', 'qytet', 'vendbanimi'],
    address: ['address', 'streetaddress', 'street', 'adresse', 'strasse', 'straße', 'adresa', 'adresë', 'adrese', 'rruga'],
    country: ['country', 'land', 'shteti', 'shtet'],
    postalCode: ['postalcode', 'postcode', 'zip', 'zipcode', 'plz', 'postleitzahl', 'kodipostar', 'kodiipostes'],
    birthday: ['birthday', 'birthdate', 'dateofbirth', 'dob', 'geburtsdatum', 'datëlindja', 'datelindja', 'ditëlindja', 'ditelindja'],
    notes: ['notes', 'note', 'comment', 'comments', 'remarks', 'bemerkung', 'bemerkungen', 'notizen', 'shënime', 'shenime', 'koment', 'komente'],
  };

  // Column names for the download, by role. Read back by detectColumns, so a clean file can be
  // dropped in again. Columns the app doesn't know keep the name they had in the file.
  const HEADER_LABELS = {
    sq: {
      id: 'ID Klienti', name: 'Emri', firstName: 'Emri', lastName: 'Mbiemri', phone: 'Telefoni',
      email: 'Email', city: 'Qyteti', address: 'Adresa', country: 'Shteti', postalCode: 'Kodi postar',
      birthday: 'Datëlindja', notes: 'Shënime',
    },
    en: {
      id: 'Customer ID', name: 'Name', firstName: 'First name', lastName: 'Last name', phone: 'Phone',
      email: 'Email', city: 'City', address: 'Address', country: 'Country', postalCode: 'Postal code',
      birthday: 'Birthday', notes: 'Notes',
    },
  };

  // roles[i] is the role of column i, or null. language: 'sq', 'en', or anything else for the
  // header as it was in the (first) file.
  function headerInLanguage(header, roles, language) {
    const labels = HEADER_LABELS[language];
    if (!labels) return [...header];
    return header.map((text, i) => (roles[i] ? labels[roles[i]] : text));
  }

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

  const api = { detectColumns, headerInLanguage, HEADER_LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cleaner = Object.assign(root.Cleaner || {}, api);
})(typeof self !== 'undefined' ? self : this);
