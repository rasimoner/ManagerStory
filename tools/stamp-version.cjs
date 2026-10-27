#!/usr/bin/env node
/* Stamps the release (package.json version) on every address the page asks the browser for, so that after a
   release no browser can mix a module it kept in its HTTP cache (GitHub Pages lets it keep files ~10 minutes)
   with the new ones. Refactor D: the module paths of D are the same as V7.10.0's, so the imports must carry the
   release too, not only the page's entries. (Refactor E replaces this with content hashes from the build.)

   usage: node tools/stamp-version.cjs          rewrite dist/ (index.html entries, every relative import, sw.js)
          node tools/stamp-version.cjs --check  exit 1 if anything is not stamped with the current version

   What it stamps, each as "<path>?v=<version>":
   - index.html's module entries;
   - in every game module (every .js under dist but vendor/ and sw.js): every relative import, export-from and dynamic
     import() of another game module (vendor/ code is pinned to its own version and keeps its plain path);
   - sw.js: every module in its list, so the offline cache holds exactly the addresses the page asks for, and its
     RELEASE (a game module asked for with another release's ?v= is failed: it comes from an older page).
   An ES module is one instance per address: every import of a file must use the same one, which is why this
   stamps all of them at once, from one version. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const check = process.argv.includes('--check');

const walk = (dir = '') => fs.readdirSync(path.join(DIST, dir), { withFileTypes: true }).flatMap(d => {
  const f = path.posix.join(dir, d.name);
  if (d.isDirectory()) return f === 'vendor' ? [] : walk(f);
  return f.endsWith('.js') && f !== 'sw.js' ? [f] : [];
});
const stamp = spec => spec.replace(/\?v=[^'"`]*$/, '') + `?v=${version}`;
const isGameModule = (from, spec) => {
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec.replace(/\?.*$/, '')));
  return !target.startsWith('vendor/') && target.endsWith('.js');
};

// static import/export ... from '…', side-effect import '…', dynamic import('…')
const SPECIFIERS = /(\b(?:import|export)\s*(?:[^'"`;]*?\s+from\s*)?|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;

const changed = [];
for (const file of walk()) {
  const full = path.join(DIST, file);
  const code = fs.readFileSync(full, 'utf8');
  const next = code.replace(SPECIFIERS, (all, head, q, spec) => isGameModule(file, spec) ? `${head}${q}${stamp(spec)}${q}` : all);
  if (next !== code) { changed.push(file); if (!check) fs.writeFileSync(full, next); }
}

const html = path.join(DIST, 'index.html');
const page = fs.readFileSync(html, 'utf8');
const nextPage = page.replace(/(<script type="module" src=")([^"]+)(")/g, (_, a, src, b) => a + stamp(src) + b);
if (nextPage !== page) { changed.push('index.html'); if (!check) fs.writeFileSync(html, nextPage); }

const swFile = path.join(DIST, 'sw.js');
const sw = fs.readFileSync(swFile, 'utf8');
const nextSw = sw.replace(/"\.\/([^"]+\.js)(\?v=[^"]*)?"/g, (all, file) => file.startsWith('vendor/') ? all : `"./${stamp(file)}"`)
  .replace(/const CACHE = "managerstory-v[^-"]+/, `const CACHE = "managerstory-v${version}`)
  .replace(/const RELEASE = "[^"]*"/, `const RELEASE = "${version}"`);
if (nextSw !== sw) { changed.push('sw.js'); if (!check) fs.writeFileSync(swFile, nextSw); }

if (check) {
  if (changed.length) { console.error(`not stamped with ${version}: ${changed.join(', ')}`); process.exit(1); }
  console.log(`every address carries ?v=${version}`);
} else console.log(changed.length ? `stamped ${version}: ${changed.join(', ')}` : `already stamped with ${version}`);
