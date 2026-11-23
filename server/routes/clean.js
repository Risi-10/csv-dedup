'use strict';

const { cleanUploadedFiles, InputError } = require('../clean.js');

// POST /api/clean: multipart form with one or more "files" (.csv / .xlsx) and optional
// "headerLanguage" and "countryCode" fields. Nothing is stored: files are read into memory,
// cleaned and forgotten.
async function cleanRoutes(app, { maxFileMb, maxFiles }) {
  app.post('/api/clean', async (request) => {
    const files = [];
    const fields = {};
    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value;
          continue;
        }
        if (part.fieldname !== 'files') throw new InputError(`Unexpected file field "${part.fieldname}"; use "files".`);
        files.push({ name: part.filename, bytes: await part.toBuffer() });
      }
    } catch (error) {
      throw friendlyLimitError(error, { maxFileMb, maxFiles });
    }
    return cleanUploadedFiles(files, { headerLanguage: fields.headerLanguage, countryCode: fields.countryCode });
  });
}

function friendlyLimitError(error, { maxFileMb, maxFiles }) {
  const messages = {
    FST_REQ_FILE_TOO_LARGE: `A file is larger than ${maxFileMb} MB.`,
    FST_FILES_LIMIT: `Too many files: send at most ${maxFiles} at once.`,
    FST_INVALID_MULTIPART_CONTENT_TYPE: 'Send the files as multipart/form-data.',
  };
  if (!messages[error.code]) return error;
  return Object.assign(new Error(messages[error.code]), { statusCode: error.statusCode });
}

module.exports = cleanRoutes;
