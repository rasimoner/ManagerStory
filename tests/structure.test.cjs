/* Refactor C3: how the modules fit together.
   - One entry point: main.js. The other modules only declare (and register their actions, season-end
     steps and hooks); loading them without main.js draws nothing and opens no career.
   - No module replaces another's function at run time. A file that adds to another's behaviour registers
     for a named moment (core/hooks.js), so the code a reader sees is the code that runs.
   - Every page script is an ES module that says what it takes from where (import), and nothing of the
     game is on window.
   - Tests reach the game through one access point (refactor D0): names, never module files. A function can
     move to another module without a test changing.
   - core/ does not know the modes: no core module imports from modes/ (refactor D emptied the list that
     pinned what it still took). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, gameSources, pageScripts, DIST } = require('./support/game.cjs');

const walk = dir => fs.readdirSync(path.join(DIST, dir), { withFileTypes: true }).flatMap(d => {
  const f = path.posix.join(dir, d.name);
  return d.isDirectory() ? (f === 'vendor' ? [] : walk(f)) : (f.endsWith('.js') && f !== 'sw.js' ? [f] : []);
});
const IMPORTS = /(?:^|\n)\s*import\s+(?:\{([^}]*)\}\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

test('only main.js does anything on load', () => {
  const without = loadGame({ skip: ['main.js'], quiet: true });
  assert.equal(without.html(), '', 'nothing drawn');
  assert.equal(without.run('S'), null, 'no career opened');
  const page = loadGame({ quiet: true });
  assert.match(page.html(), /Yeni Kariyer/, 'main.js draws the start screen');
});

test('no script replaces a function at run time', () => {
  // every function a page script declares at its top level is still that declaration once the page is
  // up and a career runs (a wrapper put in its place would be another function)
  const g = loadGame({ quiet: true, layers: ['clock', 'view'] });
  g.run('S=fresh();S.matchSalt=newMatchSalt();init();save();render()');
  const replaced = [];
  for (const { file, code } of gameSources({ layers: ['clock', 'view'] })) {
    for (const m of code.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      const now = g.run(`typeof ${m[1]}==='function'?${m[1]}.toString().slice(0,200):'missing'`);
      if (!now.replace(/^async\s+/, '').startsWith(`function ${m[1]}(`) && !now.replace(/^async\s+/, '').startsWith(`function ${m[1]} (`)) replaced.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(replaced, []);
});

test('extension points: the star transfer and the navigation register for named moments', () => {
  const g = loadGame({ quiet: true });
  const hooks = g.json('Object.fromEntries(Object.entries(HOOKS).map(([k,v])=>[k,v.length]))');
  // main.js: the manager mode redraws and readies a career when core says so (D4)
  // star-transfer.js: before and after a signing, and the transfer list (nav.js needs a document)
  assert.deepEqual(hooks, { changed: 1, careerOpened: 1, decisionsRequested: 1, opponentsEvolved: 1, matchEvent: 1, minutePlayed: 1, seasonStarted: 1, beforeSigning: 1, afterSigning: 1, transferListShown: 1 });
  // a big signing still starts the scene; a small one does not
  g.run('S=fresh();S.matchSalt=newMatchSalt();init();S.budget=1e12;S.v6.transferWindow=true;render()');
  const star = g.run('S.v6.transferPool.find(x=>starSceneQualifies(x))?.id');
  const plain = g.run('S.v6.transferPool.find(x=>!starSceneQualifies(x))?.id');
  g.run(`v6Sign(${JSON.stringify(plain)},1)`);
  assert.equal(g.run('typeof starFlow==="undefined"||!starFlow'), true, 'no scene for an ordinary signing');
  g.run(`v6Sign(${JSON.stringify(star)},1)`);
  assert.equal(g.run('!!starFlow&&starFlow.playerId===S.players.at(-1).id'), true, 'the scene for a star');
});

test('the page is ES modules: no classic script, every file in the game an ES module', () => {
  const page = pageScripts();
  assert.deepEqual(page.filter(s => !s.module).map(s => s.file), [], 'no classic <script src>');
  assert.equal(page[0].file, 'main.js');
  for (const { file, code } of gameSources({ layers: ['clock', 'view', '3d'] })) {
    assert.match(code, /^\s*(?:import|export)\b/m, `${file} imports or exports`);
  }
});

test('nothing of the game is on window', () => {
  // the browser's own (scroll, size, events) and one automation knob for the star scene's clock
  const BROWSER = new Set(['scrollTo', 'scrollY', 'innerHeight', 'addEventListener', '__stsTimeScale']);
  const used = [];
  for (const file of walk('core').concat(walk('modes'), walk('ui'), ['main.js'])) {
    const code = fs.readFileSync(path.join(DIST, file), 'utf8');
    for (const m of code.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)/g)) if (!BROWSER.has(m[1])) used.push(`${file}: window.${m[1]}`);
  }
  assert.deepEqual(used, []);
});

test('core/ does not know the modes: no core module imports anything from modes/ (refactor D)', () => {
  // static imports, re-exports and dynamic import() alike; what core needs a mode to do it says through
  // core/hooks.js (main.js connects the mode), and the mode imports core, never the other way round.
  // After C core took 63 names from modes/ in 11 files; D brought that to none, and it stays none.
  const SPEC = /(?:^|[\s;(])(?:import|export)\s*(?:[^'"()]*?\s+from\s*)?\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  const found = [];
  for (const file of walk('core')) {
    const code = fs.readFileSync(path.join(DIST, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    for (const m of code.matchAll(SPEC)) {
      const to = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (to.startsWith('modes/')) found.push(`${file} → ${to}`);
    }
  }
  assert.deepEqual(found, []);
  // the rule sees what it guards: core imports core, and modes/manager imports core
  const sees = file => [...fs.readFileSync(path.join(DIST, file), 'utf8').matchAll(SPEC)].map(m => m[1]);
  assert.ok(sees('core/engine/match-minute.js').some(x => x.startsWith('./')), 'a core import is seen');
  assert.ok(sees('modes/manager/app.js').some(x => x.includes('/core/')), 'a mode-to-core import is seen');
});

test('tests reach the game by name, through the access point, not by module file', () => {
  // the game's modules (not the presentation layers, whose files are their own subject): a test that read
  // one of them by file name would break when a function moves; the access point, sourceDefining(name)
  // and gameSources() follow the code instead
  const game = new Set(gameSources().map(s => path.posix.basename(s.file)));
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs')).map(f => path.join(dir, f))
    .concat(fs.readdirSync(path.join(dir, 'support')).filter(f => f.endsWith('.cjs')).map(f => path.join(dir, 'support', f)));
  const offenders = [];
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    for (const m of code.matchAll(/\b(?:readDist|locate)\(\s*['"]([^'"]+)['"]/g)) {
      if (game.has(path.posix.basename(m[1]))) offenders.push(`${path.basename(f)}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
  // and every export is on the access point, under its own name, owned by exactly one module
  const g = loadGame({ quiet: true });
  for (const name of ['tick', 'S', 'render', 'save', 'R', 'defineActions']) {
    assert.ok(name in g.api, name);
    assert.ok(g.owner(name), `${name} has an owner`);
  }
  assert.equal(g.api.tick, g.run('tick'), 'run() and api are one game');
});
