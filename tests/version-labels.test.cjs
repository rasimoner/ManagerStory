/* Every place that says which version this is says the same one. package.json is the one place it is written
   (refactor E2): the game reads it (GAME_VERSION, src/core/version.js) and shows it on the start screen and in the
   settings, the build puts it in the page title, the web manifest and the service worker. The README and the lock
   file are kept equal by hand (npm version does the lock file). (V7.9.5: the README still said V7.9.2.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, gameSources } = require('./support/game.cjs');
const { build } = require('./support/build.cjs');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const v = JSON.parse(read('package.json')).version;

test('package.json, the lock file and the README say one version', () => {
  assert.match(v, /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, v, 'package-lock.json');
  if (lock.packages?.['']) assert.equal(lock.packages[''].version, v, 'package-lock.json packages[""]');
  assert.equal(read('README.md').split('\n')[0], `# ManagerStory V${v}`, 'README title');
});

test('the game reads its version from package.json and shows it', () => {
  const g = loadGame({ quiet: true });
  assert.equal(g.run('GAME_VERSION'), v, 'GAME_VERSION');
  assert.ok(g.html().includes(`V${v} • Hisar Matchday`), 'start screen');
  g.run('S=fresh();S.matchSalt=newMatchSalt();init();showSettings()');
  assert.ok(g.html().includes(`ManagerStory • V${v} • MatchEngine`), 'settings');
  // nowhere else in the code: this release's number is not written by hand (older ones name old saves)
  const written = gameSources({ layers: ['clock', 'view', '3d'] }).filter(s => s.code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').includes(v));
  assert.deepEqual(written.map(s => s.file), [], 'a version written in code');
});

test('the build puts it in the page title, the web manifest and the service worker', () => {
  const b = build();
  assert.ok(b.read('index.html').includes(`<title>ManagerStory V${v} `), 'page title');
  assert.match(JSON.parse(b.read('manifest.json')).name, new RegExp(`^ManagerStory V${v.replace(/\./g, '\\.')} `), 'manifest name');
  assert.match(b.read('sw.js'), new RegExp(`^const RELEASE = "${v.replace(/\./g, '\\.')}";`, 'm'), 'service worker');
  assert.doesNotMatch(b.read('index.html') + b.read('manifest.json'), /%APP_VERSION%/, 'no placeholder left');
});
