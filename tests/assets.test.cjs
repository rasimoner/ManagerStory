/* Every picture in public/assets is used by the game, or is on the short list of pictures kept for a planned
   feature. Kept pictures are not in the service-worker list, so phones do not download them.
   (V7.9.13: ~7 MB of old photos, GIFs and webp nothing referenced were removed.) Since the build (refactor E2) the
   pictures the screens name by path are in public/ (published as they are); the code that names them is in src/. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SRC } = require('./support/game.cjs');
const { build, offlineList, ROOT } = require('./support/build.cjs');

const PUBLIC = path.join(ROOT, 'public');
// kept on purpose, not yet used: crowd pictures for weather and night matches
const KEPT = ['assets/atmosphere/fans-day.webp', 'assets/atmosphere/fans-rain.webp', 'assets/atmosphere/fans-night.webp'];

function files(base, dir = '') {
  return fs.readdirSync(path.join(base, dir), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? files(base, path.posix.join(dir, d.name)) : [path.posix.join(dir, d.name)]);
}

// the code that can name a picture: the page, its modules and style sheets, and the web manifest
function gameCode() {
  return [...files(SRC).filter(f => /\.(css|js|html)$/.test(f) && f !== 'sw.js').map(f => fs.readFileSync(path.join(SRC, f), 'utf8')),
    fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8')].join('\n');
}

test('every picture in assets is used by the game or kept on purpose, and kept ones are not cached', () => {
  const code = gameCode();
  // names built at run time, e.g. `assets/atmosphere/goal-club-${index}.webp`
  const patterns = [...code.matchAll(/assets\/[\w\-/]*\$\{[^}]+\}[\w\-.]*/g)]
    .map(m => new RegExp('^' + m[0].split(/\$\{[^}]+\}/).map(s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('\\d+') + '$'));
  const pictures = files(PUBLIC, 'assets').filter(f => /\.(webp|jpe?g|gif|png)$/i.test(f));
  assert.ok(pictures.length > 30, 'the pictures are found');
  const unused = pictures.filter(f => !KEPT.includes(f) && !code.includes(f) && !code.includes(path.posix.basename(f)) && !patterns.some(p => p.test(f)));
  assert.deepEqual(unused, [], 'pictures nothing uses: ' + unused.join(', '));
  for (const f of KEPT) assert.ok(fs.existsSync(path.join(PUBLIC, f)), f);
  const list = offlineList(build());
  for (const f of KEPT) assert.ok(!list.includes(f), `${f} is kept, not cached`);
  for (const f of pictures.filter(f => !KEPT.includes(f))) assert.ok(list.includes(f), `${f} is cached`);
});

test('a style sheet names a public picture from the site root, so the build puts it under the base', () => {
  // a relative url() in a style sheet would resolve against the built style sheet in app/, where no picture is
  const relative = files(SRC).filter(f => f.endsWith('.css'))
    .flatMap(f => [...fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/url\(\s*['"]?(assets\/[^'")]+)/g)].map(m => `${f}: ${m[1]}`));
  assert.deepEqual(relative, []);
});
