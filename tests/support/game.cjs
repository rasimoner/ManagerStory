/* The one way tests load the game.
   The game is the classic scripts index.html loads, in index.html's order, run in one vm context with a
   small stand-in for the browser. Scripts index.html tags with a data-layer belong to the match
   presentation and are left out unless asked for, so the engine runs on its own:
     data-layer="clock"  the presentation clock that paces the live match for the 2D/3D view
     data-layer="view"   the read-only boundary the 3D view reads the match through
   No test keeps its own file list: moving, renaming or splitting a script only needs index.html updated. (Before V7.9.13 six tests each had a copy of the list.)

   loadGame(options) → { run, json, app, html, storage, alerts, confirms, ctx }
     storage    Map used as localStorage (pass one in to load a save)
     layers     extra data-layer scripts to load, e.g. ['clock', 'view']
     document   extra querySelector(q, app) handlers tried before the defaults
     prepend    insertAdjacentHTML on #app prepends instead of appends (as the star-transfer test expects)
     quiet      console.warn is silenced
     skip       script files to leave out (only for old releases whose index.html has no data-layer tags)
     entropy    seed for the stand-in crypto.getRandomValues (the device entropy behind new careers and
                kickoffs); a fixed default keeps tests repeatable. Pass null for no crypto at all. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const DIST = path.resolve(__dirname, '../../dist');
const read = (f, dist = DIST) => fs.readFileSync(path.join(dist, f), 'utf8');

/* The classic (non-module) scripts the page loads, in order, without cache-busters: [{ file, layer }]. */
function pageScripts(dist = DIST) {
  const html = read('index.html', dist);
  return [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^"]*)?"([^>]*)><\/script>/g)]
    .map(m => ({ file: m[1], layer: /data-layer="([^"]+)"/.exec(m[2])?.[1] || 'game' }));
}

const cache = new Map();
function sources(dist = DIST) {
  if (!cache.has(dist)) cache.set(dist, pageScripts(dist).map(s => ({ ...s, code: read(s.file, dist) })));
  return cache.get(dist);
}

/* A small, seeded stand-in for crypto.getRandomValues (mulberry32, like the game's R). */
function fakeCrypto(seed) {
  let x = seed >>> 0;
  const next = () => { x = (x + 0x6D2B79F5) | 0; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return (t ^ t >>> 14) >>> 0; };
  return { getRandomValues(array) { for (let i = 0; i < array.length; i++) array[i] = next(); return array; } };
}

function loadGame({ storage = new Map(), layers = [], document: extra = null, skip = [], prepend = false, quiet = false, entropy = 0x5eed, dist = DIST } = {}) {
  const alerts = [], confirms = [];
  const app = {
    innerHTML: '', classList: { toggle() {} },
    insertAdjacentHTML(_where, html) { this.innerHTML = prepend ? html + this.innerHTML : this.innerHTML + html; },
  };
  const querySelector = q => {
    if (extra) { const found = extra(q, app); if (found !== undefined) return found; }
    if (q === '#app') return app;
    if (q === '.bottomnav') return app.innerHTML.includes('class=bottomnav') ? {} : null;
    return null;
  };
  const ctx = {
    console: quiet ? { ...console, warn() {} } : console,
    structuredClone, AbortController, URL, Blob, setTimeout, clearTimeout, Math, queueMicrotask,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    document: { body: { classList: { toggle() {}, contains: () => false } }, querySelector },
    alert: message => alerts.push(message),
    confirm: message => { confirms.push(message); return true; },
    prompt: () => null,
  };
  if (entropy != null) ctx.crypto = fakeCrypto(entropy);
  ctx.window = ctx; ctx.window.scrollTo = () => {};
  vm.createContext(ctx);
  for (const { file, layer, code } of sources(dist)) {
    if ((layer !== 'game' && !layers.includes(layer)) || skip.includes(file)) continue;
    vm.runInContext(code, ctx, { filename: file });
  }
  const run = code => vm.runInContext(code, ctx);
  return {
    run, ctx, app, storage, alerts, confirms,
    html: () => app.innerHTML,
    json: code => JSON.parse(run(`JSON.stringify(${code})`)),
  };
}

/* For the few rules about the code itself ("the engine never calls Math.random"): the source of the page
   scripts, or of the scripts that define the given functions, found by what they define rather than by
   file name, so the rules follow the code when it moves. */
const gameSources = ({ layers = [], dist = DIST } = {}) => sources(dist).filter(s => s.layer === 'game' || layers.includes(s.layer));
function scriptsDefining(names, options) {
  const defines = (code, name) => new RegExp(`function\\s+${name}\\s*\\(`).test(code);
  const found = gameSources(options).filter(s => names.some(n => defines(s.code, n)));
  for (const n of names) if (!found.some(s => defines(s.code, n))) throw new Error(`no page script defines ${n}`);
  return found;
}

module.exports = { loadGame, pageScripts, gameSources, scriptsDefining, DIST };
