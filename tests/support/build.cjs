/* The build, for the tests that are about what the build publishes (the service worker and its list, the page
   title and manifest, the pictures that are cached): `vite build` into a temporary folder, once per test file.
   Everything else is tested on the sources (tests/support/game.cjs). */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
let built = null;

function build() {
  if (built) return built;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-build-'));
  const run = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  if (run.status !== 0) throw new Error(`vite build failed (run npm ci first):\n${run.stdout}\n${run.stderr}`);
  process.on('exit', () => fs.rmSync(out, { recursive: true, force: true }));
  const files = (dir = '') => fs.readdirSync(path.join(out, dir), { withFileTypes: true }).flatMap(d => {
    const f = dir ? path.posix.join(dir, d.name) : d.name;
    return d.isDirectory() ? files(f) : [f];
  });
  built = { dir: out, files: files(), read: f => fs.readFileSync(path.join(out, f), 'utf8') };
  return built;
}

/* The service worker's list as the build wrote it: the addresses in dist/sw.js's ASSETS, without "./". */
function offlineList(b = build()) {
  const sw = b.read('sw.js');
  const m = /^const ASSETS = (\[[\s\S]*?\]);$/m.exec(sw);
  if (!m) throw new Error('sw.js has no ASSETS list');
  return JSON.parse(m[1]).map(a => a.replace(/^\.\//, ''));
}

module.exports = { build, offlineList, ROOT };
