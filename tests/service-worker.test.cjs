/* The service worker caches the game for offline play. Every file the page loads must be in its list:
   the classic scripts and stylesheets in index.html, and every ES module reached through static imports
   from the 3D entry points. (V7.9.13: newview/replay.js was imported but missing, so the 3D match could
   not load offline.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname, '..', 'dist');
const read = f => fs.readFileSync(path.join(dist, f), 'utf8');

function swList() {
  const sw = read('sw.js');
  const raw = [...sw.matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]);
  const list = [...raw, ...raw.map(f => f.replace(/\?v=[\d.]+$/, ''))];
  const loops = [...sw.matchAll(/Array\.from\(\{length:(\d+)\},\(_,i\)=>`\.\/([^`]*)\$\{i\}([^`]*)`\)/g)];
  for (const [, n, pre, post] of loops) for (let i = 0; i < Number(n); i++) list.push(pre + i + post);
  return new Set(list);
}

/* The addresses the page asks for, from its entries through every static and dynamic import: each as
   written, with its ?v= (refactor D stamps the release on imports; an ES module is fetched, and cached
   offline, under exactly that address). */
// the list exactly as written (no address without its ?v=)
function swExact() {
  const sw = read('sw.js');
  const list = new Set([...sw.matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]));
  for (const [, n, pre, post] of sw.matchAll(/Array\.from\(\{length:(\d+)\},\(_,i\)=>`\.\/([^`]*)\$\{i\}([^`]*)`\)/g)) for (let i = 0; i < Number(n); i++) list.add(pre + i + post);
  return list;
}

function moduleGraph(entries) {
  const seen = new Set(), queue = [...entries];
  while (queue.length) {
    const file = path.posix.normalize(queue.shift());
    if (seen.has(file)) continue;
    seen.add(file);
    const src = read(file.replace(/\?.*$/, ''));
    for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g)) {
      queue.push(path.posix.join(path.posix.dirname(file), m[1]));
    }
    for (const m of src.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      queue.push(path.posix.join(path.posix.dirname(file), m[1]));
    }
  }
  return seen;
}

test('every file index.html loads, and every ES module it imports, is in the service-worker list', () => {
  const list = swList();
  const html = read('index.html');
  // the page's module entries keep their cache-buster in the list, as the page asks for them
  const entries = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map(m => m[1]);
  for (const e of entries) assert.ok(list.has(e), `${e} in sw.js`);
  const pageFiles = [
    ...[...html.matchAll(/<script(?: type="module")? src="([^"?]+)/g)].map(m => m[1]),
    ...[...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]),
    ...[...html.matchAll(/href="([^"?]+\.(?:json|png))"/g)].map(m => m[1]),
  ];
  const inlineImports = [...html.matchAll(/import\(\s*'\.\/([^']+)'\s*\)/g)].map(m => m[1]);
  // a dynamic import in a script resolves against that script's own address
  const lazyImports = [];
  for (const f of pageFiles.filter(f => f.endsWith('.js'))) {
    for (const m of read(f).matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) lazyImports.push(path.posix.join(path.posix.dirname(f), m[1]));
  }
  const modules = moduleGraph([...entries.filter(f => f.includes('.js')), ...inlineImports, ...lazyImports]);
  const exact = swExact();
  const missing = [...new Set([...pageFiles.filter(f => !f.endsWith('.js')), ...modules])].filter(f => !exact.has(f));
  assert.deepEqual(missing, [], 'missing from sw.js: ' + missing.join(', '));
  assert.ok([...modules].some(f => /newview\/replay\.js(\?|$)/.test(f)), 'module graph reaches newview/replay.js');
  assert.ok([...modules].some(f => /star-transfer-scene\.js(\?|$)/.test(f)), 'and the star transfer scene, imported on demand');
});

// published but deliberately not cached for offline play
const NOT_CACHED = new Set([
  'sw.js',                    // the service worker itself
  '.nojekyll', 'README.txt', 'assets/.gitkeep', 'assets/atmosphere/.gitkeep', 'vendor/three/LICENSE',
  // kept for weather and night matches, not used yet (tests/assets.test.cjs)
  'assets/atmosphere/fans-day.webp', 'assets/atmosphere/fans-rain.webp', 'assets/atmosphere/fans-night.webp',
]);
function published(dir = '') {
  return fs.readdirSync(path.join(dist, dir), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? published(path.posix.join(dir, d.name)) : [path.posix.join(dir, d.name)]);
}

test('every published file is in the service-worker list, or on the short not-cached list', () => {
  const list = swList();
  const missing = published().filter(f => !list.has(f) && !NOT_CACHED.has(f));
  assert.deepEqual(missing, [], 'published but not cached: ' + missing.join(', '));
  const stale = [...NOT_CACHED].filter(f => !fs.existsSync(path.join(dist, f)));
  assert.deepEqual(stale, [], 'not-cached list names files that are gone');
});

test('every file in the service-worker list exists', () => {
  const missing = [...swList()].filter(f => f && !fs.existsSync(path.join(dist, f.replace(/\?.*$/, ''))));
  assert.deepEqual(missing, []);
});

// V7.10.0: the install step fetches past the browser's HTTP cache, so a release can never store an old file
// (GitHub Pages lets browsers keep files ~10 minutes) under the new cache key.
test('the service worker fills its cache past the HTTP cache', () => {
  const sw = read('sw.js');
  const install = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
  assert.match(install, /addAll\(ASSETS\.map\(url => new Request\(url, \{ cache: "reload" \}\)\)\)/);
  assert.doesNotMatch(install, /addAll\(ASSETS\)/);
});

// V7.11.0: a game module asked for without ?v= can only come from an older release's page still open in a tab (since
// V7.11.0 every address carries the release). Serving it would put this release's file into the old page's game, a
// second copy of the game next to the old one (seen in the V7.10.0 -> V7.11.0 switch: the old tab's star transfer
// scene brought 32 new modules with it). The service worker fails such a request, so the old page falls back.
test('the service worker never serves a game module by its plain path (only an older page asks for one)', async () => {
  const vm = require('node:vm');
  const listeners = {}, opened = [];
  const scope = 'https://rasimoner.github.io/ManagerStory/';
  const self = {
    location: new URL(scope + 'sw.js'), registration: { scope },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() },
  };
  const caches = { open: name => { opened.push(name); return Promise.resolve({ match: () => Promise.resolve(new Response('cached')) }); } };
  vm.runInNewContext(read('sw.js'), { self, caches, URL, Request, Response, fetch: () => Promise.reject(new Error('offline')), console });
  const ask = async address => {
    let answer = null;
    listeners.fetch({ request: { method: 'GET', url: scope + address, mode: 'no-cors' }, respondWith: r => { answer = r; } });
    return answer && (await answer);
  };
  const release = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
  for (const old of ['main.js', 'core/state.js', 'core/presentation/scenes/star-transfer-scene.js',
    'core/presentation/match3d/match3d-newview.js', 'modes/manager/app.js', 'ui/actions.js', 'data/clubs.js']) {
    const r = await ask(old);
    assert.equal(r?.type, 'error', `${old} without ?v= is failed`);
  }
  for (const ok of [`main.js?v=${release}`, `core/presentation/scenes/star-transfer-scene.js?v=${release}`,
    'vendor/three/three.module.min.js', 'assets/models/footballer-rig.json', 'core/presentation/match3d/match3d-career.css',
    'index.html', '', 'style.css']) {
    const r = await ask(ok);
    assert.equal(await r?.text(), 'cached', `${ok || './'} is served from the cache`);
  }
  // and every module address the page itself asks for carries the release (the stamp), so the rule never fails it
  const stamped = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'tools/stamp-version.cjs'), '--check'], { encoding: 'utf8' });
  assert.equal(stamped.status, 0, stamped.stderr);
});
