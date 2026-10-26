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

function moduleGraph(entries) {
  const seen = new Set(), queue = [...entries];
  while (queue.length) {
    const file = path.posix.normalize(queue.shift());
    if (seen.has(file)) continue;
    seen.add(file);
    const src = read(file);
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
  const modules = moduleGraph([...pageFiles.filter(f => f.endsWith('.js')), ...inlineImports, ...lazyImports]);
  const missing = [...new Set([...pageFiles, ...modules])].filter(f => !list.has(f));
  assert.deepEqual(missing, [], 'missing from sw.js: ' + missing.join(', '));
  assert.ok([...modules].some(f => f.endsWith('newview/replay.js')), 'module graph reaches newview/replay.js');
  assert.ok([...modules].some(f => f.endsWith('star-transfer-scene.js')), 'and the star transfer scene, imported on demand');
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
