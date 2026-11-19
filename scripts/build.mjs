// Builds dist/list-cleaner.html: one self-contained file (CSS and all scripts inlined) that
// works offline when opened straight from disk. This is the file to hand over.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const outFile = join(root, 'dist', 'list-cleaner.html');

const read = (relativePath) => readFileSync(join(srcDir, relativePath), 'utf8');

// Stop inlined code from closing the <script>/<style> tag early.
const escapeTag = (code, tag) => code.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

let html = read('index.html');
let replaced = 0;

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  replaced++;
  return `<style>\n${escapeTag(read(href), 'style')}\n</style>`;
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  replaced++;
  return `<script>\n${escapeTag(read(src), 'script')}\n</script>`;
});

if (/<(script|link)[^>]+(src|href)=/.test(html)) {
  throw new Error('Build left an external reference in the page; check src/index.html tags.');
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html);
console.log(`Built ${outFile} (${replaced} files inlined, ${(html.length / 1024).toFixed(0)} KB)`);
