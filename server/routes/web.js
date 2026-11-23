'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const CORE_FILES = ['names', 'phones', 'columns', 'combine', 'parse', 'dedupe'];

// The page and exactly the files it loads, at the URLs its relative links resolve to from "/"
// (src/web/index.html loads ../core/*.js and ../../vendor/…). A fixed list, so nothing else in
// the project folder can be fetched.
const FILES = {
  '/': ['src/web/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['src/web/app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['src/web/styles.css', 'text/css; charset=utf-8'],
  '/vendor/xlsx.full.min.js': ['vendor/xlsx.full.min.js', 'text/javascript; charset=utf-8'],
  ...Object.fromEntries(CORE_FILES.map((name) => [`/core/${name}.js`, [`src/core/${name}.js`, 'text/javascript; charset=utf-8']])),
};

async function webRoutes(app) {
  for (const [url, [file, type]] of Object.entries(FILES)) {
    // Read on every request so edits to the page show up on reload, without a server restart.
    app.get(url, async (request, reply) => {
      const content = await fs.readFile(path.join(root, file));
      return reply.type(type).header('cache-control', 'no-cache').send(content);
    });
  }
}

module.exports = webRoutes;
