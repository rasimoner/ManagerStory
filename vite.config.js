/* The build (refactor E2–E6). Sources in src/ (the page, the game's ES modules, its JSON data, the service-worker
   template), files published as they are in public/ (pictures, icons, the web manifest). `npm run build` writes
   dist/, which is what GitHub Pages serves and is not in the repository.
   - base: the game lives at https://rasimoner.github.io/ManagerStory/ (the path is case-sensitive).
   - Every built script, stylesheet and model carries a hash of its content in its name (dist/app/), so a browser
     can never mix a file it kept from an older release with the new ones (this replaced the ?v=<release> stamp).
   - package.json's version is the one place a release is written: the game reads it (src/core/version.js), the
     page title and the web manifest get it here.
   - dist/sw.js is written from src/sw.js with the list of every file this build published (but NOT_CACHED). */
import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
export const BASE = '/ManagerStory/';

// published but not cached for offline play: the worker itself, and the crowd pictures kept for weather and night
// matches, not used yet (tests/assets.test.cjs). Dotfiles (.nojekyll, .gitkeep) are never cached.
export const NOT_CACHED = ['sw.js', 'assets/atmosphere/fans-day.webp', 'assets/atmosphere/fans-rain.webp', 'assets/atmosphere/fans-night.webp'];

const filesUnder = (dir, at = '') => readdirSync(join(dir, at), { withFileTypes: true }).flatMap(d => {
  const f = at ? posix.join(at, d.name) : d.name;
  return d.isDirectory() ? filesUnder(dir, f) : [f];
});

/* What the worker caches, from what the build wrote: the page as "./" and as index.html, then every other file
   (but dotfiles and NOT_CACHED), sorted, as addresses relative to the worker. */
export function offlineList(outDir) {
  const files = filesUnder(outDir).filter(f => !f.split('/').some(p => p.startsWith('.')) && !NOT_CACHED.includes(f) && f !== 'index.html').sort();
  return ['./', './index.html', ...files.map(f => './' + f)];
}

/* dist/sw.js: the release, a hash of this build's list (hashed names: it changes whenever any file does) and
   the list, then the worker (src/sw.js). */
export function serviceWorker(outDir, template) {
  const assets = offlineList(outDir);
  const build = createHash('sha256').update(assets.join('\n')).update(readFileSync(join(outDir, 'index.html'))).digest('hex').slice(0, 10);
  return `const RELEASE = ${JSON.stringify(version)};\nconst BUILD = ${JSON.stringify(build)};\nconst ASSETS = ${JSON.stringify(assets, null, 0).replace(/","/g, '",\n  "')};\n${template}`;
}

function managerStory() {
  let outDir;
  return {
    name: 'managerstory',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    transformIndexHtml: html => html.replaceAll('%APP_VERSION%', version),
    // after everything is written (the bundle and public/): the manifest's name, then the worker and its list
    closeBundle() {
      const manifest = join(outDir, 'manifest.json');
      writeFileSync(manifest, readFileSync(manifest, 'utf8').replaceAll('%APP_VERSION%', version));
      writeFileSync(join(outDir, 'sw.js'), serviceWorker(outDir, readFileSync(join(ROOT, 'src/sw.js'), 'utf8')));
    },
  };
}

export default defineConfig({
  root: 'src',
  base: BASE,
  publicDir: '../public',
  plugins: [managerStory()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'app',
    // the 3D rig and the page's pictures stay files (never inlined into a script)
    assetsInlineLimit: 0,
    // what only the 3D match and the star scene load, on demand: three.js (~520 KB) and the 3D view they share
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'three', test: /node_modules[\\/]three[\\/]/ },
      { name: 'newview', test: /src[\\/]core[\\/]presentation[\\/]match3d[\\/]newview[\\/]/ },
    ] } } },
    chunkSizeWarningLimit: 600,
  },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
});
