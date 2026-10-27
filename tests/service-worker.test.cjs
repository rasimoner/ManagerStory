/* The service worker caches the game for offline play (refactor E3: dist/sw.js is written by the build from
   src/sw.js, with the build's own file list). Tested on a real build (tests/support/build.cjs):
   - the list is every file the build published, but the worker and the short not-cached list: nothing the page
     can load is missing (V7.9.13: newview/replay.js was missing and the 3D match could not load offline), and the
     3D match and the star transfer scene, loaded on demand, are in it;
   - the cache is filled past the browser's HTTP cache (V7.10.0), under a name that is new for every build;
   - only this build's scripts are served: an older release's page still open in a tab never gets a script of
     this one (V7.11.0, V7.12.0 rules, now by the hashed names). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build, offlineList, ROOT } = require('./support/build.cjs');

const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

test('the offline list is every file the build published, but the worker and the few not cached', async () => {
  const b = build();
  const { NOT_CACHED } = await import(require('node:url').pathToFileURL(path.join(ROOT, 'vite.config.js')).href);
  const list = offlineList(b);
  assert.equal(list[0], '', 'the page itself ("./") first');
  assert.equal(new Set(list).size, list.length, 'each address once');
  const dotfile = f => f.split('/').some(p => p.startsWith('.'));
  const missing = b.files.filter(f => !list.includes(f) && !NOT_CACHED.includes(f) && !dotfile(f));
  assert.deepEqual(missing, [], 'published but not cached');
  const gone = list.filter(f => f && !b.files.includes(f));
  assert.deepEqual(gone, [], 'listed but not published');
  for (const f of NOT_CACHED) assert.ok(b.files.includes(f), `${f} (not cached) is published`);
  for (const f of NOT_CACHED) assert.ok(!list.includes(f), `${f} is not cached`);
});

test('every file the page can load is in the list: its entry, every chunk it imports, now or on demand, and their assets', () => {
  const b = build();
  const list = new Set(offlineList(b));
  const html = b.read('index.html');
  const base = '/ManagerStory/';
  // the page's own addresses (scripts, stylesheets, manifest, icons), under the base
  const pageRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => u.startsWith(base)).map(u => u.slice(base.length));
  assert.ok(pageRefs.some(f => /^app\/index-[\w-]+\.js$/.test(f)), 'the page loads one built entry script');
  const reached = new Set(pageRefs), queue = pageRefs.filter(f => f.endsWith('.js'));
  // a built chunk names the files it loads by their hashed names: imports, import(), the preload map, new URL()
  while (queue.length) {
    const file = queue.shift();
    for (const m of b.read(file).matchAll(/["'`/]((?:app\/)?[\w.-]+-[\w-]{8}\.(?:js|css|json))["'`]/g)) {
      const name = m[1].startsWith('app/') ? m[1] : 'app/' + m[1];
      if (reached.has(name)) continue;
      reached.add(name);
      if (name.endsWith('.js')) queue.push(name);
    }
  }
  const missing = [...reached].filter(f => !list.has(f));
  assert.deepEqual(missing, [], 'loaded by the page but not cached: ' + missing.join(', '));
  const names = [...reached].map(f => path.posix.basename(f));
  for (const chunk of ['three', 'newview', 'match3d-newview', 'star-transfer-scene', 'footballer-rig', 'match3d-career']) {
    assert.ok(names.some(n => n.startsWith(chunk + '-')), `${chunk} is reached (on demand) and cached`);
  }
  // the pictures the page names by path (screens, the stylesheet) are files of the build, all cached
  const css = pageRefs.filter(f => f.endsWith('.css')).map(f => b.read(f)).join('\n');
  for (const [, picture] of css.matchAll(/url\(\/ManagerStory\/(assets\/[^)]+)\)/g)) assert.ok(list.has(picture), `${picture} (style sheet) is cached`);
});

// V7.10.0: the install step fetches past the browser's HTTP cache, so a release can never store an old file
// (GitHub Pages lets browsers keep files ~10 minutes) under the new cache key.
test('the service worker fills its cache past the HTTP cache, under a name of this release and this build', () => {
  const sw = build().read('sw.js');
  const install = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
  assert.match(install, /addAll\(ASSETS\.map\(url => new Request\(url, \{ cache: "reload" \}\)\)\)/);
  assert.doesNotMatch(install, /addAll\(ASSETS\)/);
  const { CACHE } = worker();
  assert.match(CACHE, new RegExp(`^managerstory-v${release.replace(/\./g, '\\.')}-[0-9a-f]{10}$`), CACHE);
});

/* The built worker in a vm, at the live address, with a cache that holds everything. */
const scope = 'https://rasimoner.github.io/ManagerStory/';
function worker() {
  const listeners = {}, opened = [];
  const self = {
    location: new URL(scope + 'sw.js'), registration: { scope },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() },
  };
  const caches = { open: name => { opened.push(name); return Promise.resolve({ match: () => Promise.resolve(new Response('cached')) }); } };
  const ctx = { self, caches, URL, Request, Response, fetch: () => Promise.reject(new Error('offline')), console };
  vm.runInNewContext(build().read('sw.js') + '\n;globalThis.CACHE = CACHE;', ctx);
  const ask = async address => {
    let answer = null;
    listeners.fetch({ request: { method: 'GET', url: scope + address, mode: 'no-cors' }, respondWith: r => { answer = r; } });
    return answer && (await answer);
  };
  return { ask, CACHE: ctx.CACHE };
}

// V7.11.0: a game module asked for without ?v= came from an older release's page still open in a tab; V7.12.0: the
// same for another release's ?v=. Serving it would put a newer file into the old page's game, a second copy of the
// game next to the old one (seen in the V7.10.0 -> V7.11.0 switch: the old tab's star transfer scene brought 32 new
// modules with it). Since the build: every script of this build has a hashed name in the list, and any other
// script (an older release's address, an older build's chunk) is failed, so the old page falls back.
test('the service worker serves this build\'s scripts and never a script of another release', async () => {
  const { ask } = worker();
  const list = offlineList();
  const old = ['main.js', 'core/state.js', 'core/presentation/scenes/star-transfer-scene.js', 'core/presentation/match3d/match3d-newview.js',
    'modes/manager/app.js', 'ui/actions.js', 'data/clubs.js', 'vendor/three/three.module.min.js', 'app/index-0ldBu1ld.js', 'app/three-0ldBu1ld.js'];
  for (const f of old) {
    assert.equal((await ask(f))?.type, 'error', `${f} is failed`);
    for (const other of ['7.12.0', '7.11.0', '7.10.0', release]) assert.equal((await ask(`${f}?v=${other}`))?.type, 'error', `${f}?v=${other} is failed`);
  }
  const own = list.filter(f => f.endsWith('.js'));
  assert.ok(own.length >= 5, own.join(', '));
  for (const f of [...own, '', 'index.html', 'manifest.json', ...list.filter(f => /\.(css|json|webp)$/.test(f)).slice(0, 6)]) {
    const r = await ask(f);
    assert.equal(await r?.text(), 'cached', `${f || './'} is served from the cache`);
  }
});

test('the page registers the worker only in the build, and says when a new release has taken over', () => {
  const html = build().read('index.html');
  assert.doesNotMatch(html, /serviceWorker/, 'no inline registration: the game registers it (ui/updates.js)');
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/updates.js'), 'utf8');
  assert.match(code, /import\.meta\.env\?\.PROD/, 'not on the dev server, not in tests');
  assert.match(code, /register\(`\$\{import\.meta\.env\.BASE_URL\}sw\.js`\)/);
  assert.match(code, /controllerchange/);
});
