/* Every picture in dist/assets is used by the game, or is on the short list of pictures kept for a planned
   feature. Kept pictures are not in the service-worker list, so phones do not download them.
   (V7.9.13: ~7 MB of old photos, GIFs and webp nothing referenced were removed.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pageScripts, DIST } = require('./support/game.cjs');

// kept on purpose, not yet used: crowd pictures for weather and night matches
const KEPT = ['assets/atmosphere/fans-day.webp', 'assets/atmosphere/fans-rain.webp', 'assets/atmosphere/fans-night.webp'];

function files(dir) {
  return fs.readdirSync(path.join(DIST, dir), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? files(path.join(dir, d.name)) : [path.posix.join(dir.split(path.sep).join('/'), d.name)]);
}

// the code that can name a picture: the page scripts, the ES modules, the stylesheets and the page itself
function gameCode() {
  const sources = [...pageScripts().map(s => s.file), 'index.html', 'manifest.json',
    ...files('.').filter(f => /\.(css|js)$/.test(f) && !f.startsWith('vendor/') && f !== 'sw.js')];
  return [...new Set(sources)].map(f => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');
}

test('every picture in assets is used by the game or kept on purpose, and kept ones are not cached', () => {
  const code = gameCode();
  // names built at run time, e.g. `assets/atmosphere/goal-club-${index}.webp`
  const patterns = [...code.matchAll(/assets\/[\w\-/]*\$\{[^}]+\}[\w\-.]*/g)]
    .map(m => new RegExp('^' + m[0].split(/\$\{[^}]+\}/).map(s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('\\d+') + '$'));
  const pictures = files('assets').filter(f => /\.(webp|jpe?g|gif|png)$/i.test(f));
  const unused = pictures.filter(f => !KEPT.includes(f) && !code.includes(f) && !code.includes(path.posix.basename(f)) && !patterns.some(p => p.test(f)));
  assert.deepEqual(unused, [], 'pictures nothing uses: ' + unused.join(', '));
  for (const f of KEPT) assert.ok(fs.existsSync(path.join(DIST, f)), f);
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  for (const f of KEPT) assert.ok(!sw.includes(f), `${f} is kept, not cached`);
});
