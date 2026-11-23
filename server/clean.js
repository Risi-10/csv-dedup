'use strict';

// The same cleaning steps as the offline page (src/web/app.js), for files uploaded to the server.
const XLSX = require('../vendor/xlsx.full.min.js');
const { readFile } = require('../src/core/parse.js');
const { combineFiles } = require('../src/core/combine.js');
const { cleanList } = require('../src/core/dedupe.js');
const { headerInLanguage, HEADER_LABELS } = require('../src/core/columns.js');

const ALLOWED_EXTENSIONS = /\.(csv|xlsx)$/i;
const HEADER_LANGUAGES = ['original', ...Object.keys(HEADER_LABELS)];

// A problem with what the user sent. Its message is safe and meant to be shown to them.
class InputError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

// files: [{ name, bytes }]. Returns what the page shows: the summary, the clean list and the rows
// to check, with column names in headerLanguage ('original' keeps the first file's names).
function cleanUploadedFiles(files, { headerLanguage = 'original', countryCode } = {}) {
  if (files.length === 0) throw new InputError('No files to clean.');
  if (!HEADER_LANGUAGES.includes(headerLanguage)) {
    throw new InputError(`headerLanguage must be one of ${HEADER_LANGUAGES.join(', ')}.`);
  }
  if (countryCode !== undefined && !/^[1-9]\d{0,2}$/.test(countryCode)) {
    throw new InputError('countryCode must be 1 to 3 digits without "+", e.g. 355.');
  }

  const tables = files.map(readUploadedFile);
  // The cleaning code reports bad input (missing columns, misplaced header row) by throwing a
  // plain Error with a message written for the user, which the page shows as is.
  const { header, rows, sources, roles, columnsNotInAllFiles } = asInputError(() => combineFiles(tables));
  const result = asInputError(() => cleanList(header, rows, { sources, countryCode }));
  const outputHeader = headerInLanguage(result.header, roles, headerLanguage);

  return {
    summary: result.summary,
    header: outputHeader,
    clean: result.clean,
    checkHeader: [...result.checkHeader.slice(0, 2), ...outputHeader],
    check: result.check,
    columnsNotInAllFiles,
  };
}

function readUploadedFile({ name, bytes }) {
  if (!ALLOWED_EXTENSIONS.test(name)) throw new InputError(`${name}: Please use a .csv or .xlsx file.`);
  return asInputError(() => ({ name, ...readFile(bytes, name, XLSX) }), name);
}

function asInputError(step, fileName) {
  try {
    return step();
  } catch (error) {
    // TypeError and the like are bugs, not bad input: let them become a 500.
    if (error.constructor !== Error) throw error;
    const prefixed = fileName && !error.message.startsWith(`${fileName}:`);
    throw new InputError(prefixed ? `${fileName}: ${error.message}` : error.message);
  }
}

module.exports = { cleanUploadedFiles, InputError, HEADER_LANGUAGES };
