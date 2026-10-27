/* Every place that says which version this is says the same one: package.json is the source, and the README,
   the lock file, the game (GAME_VERSION, the start screen, settings), the page title, the manifest, the script
   cache-busters and the service worker follow it. (V7.9.5: the README still said V7.9.2.) */
const test = require('node:test');
const { gameSources, sourceDefining } = require('./support/game.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('one version everywhere: README, lock file, game, page, manifest, cache-busters, service worker', () => {
  const v = JSON.parse(read('package.json')).version;
  assert.match(v, /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, v, 'package-lock.json');
  if (lock.packages?.['']) assert.equal(lock.packages[''].version, v, 'package-lock.json packages[""]');
  assert.equal(read('README.md').split('\n')[0], `# ManagerStory V${v}`, 'README title');
  assert.match(sourceDefining('GAME_VERSION').code, new RegExp(`const GAME_VERSION = "${v.replace(/\./g, '\\.')}";`), 'GAME_VERSION');
  const html = read('dist/index.html');
  assert.ok(html.includes(`<title>ManagerStory V${v} `), 'page title');
  const busters = [...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1]);
  // the page's module entries carry the release (the modules they import are cached under the release's cache key)
  assert.ok(busters.length >= 4 && busters.every(x => x === v), 'index.html ?v= ' + [...new Set(busters)]);
  assert.match(JSON.parse(read('dist/manifest.json')).name, new RegExp(`^ManagerStory V${v.replace(/\./g, '\\.')} `), 'manifest name');
  const sw = read('dist/sw.js');
  assert.match(sw, new RegExp(`const CACHE = "managerstory-v${v.replace(/\./g, '\\.')}-`), 'service-worker cache key');
  const swBusters = [...sw.matchAll(/\?v=([\d.]+)/g)].map(m => m[1]);
  assert.ok(swBusters.length >= 4 && swBusters.every(x => x === v), 'sw.js ?v= ' + [...new Set(swBusters)]);
  const game = gameSources().map(s => s.code).join('\n');
  assert.ok(game.includes(`V${v} • Hisar Matchday`), 'start screen');
  assert.ok(game.includes(`ManagerStory • V${v} • MatchEngine`), 'settings');
});
