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
  /* Press a button drawn on the screen, as the page's dispatcher would: the first element with that
     data-action whose data-* values match (a value of undefined: the attribute is absent). Its data-*
     values are handed to the action as the browser would (strings); extra element fields such as a
     select's value go in `element`. A disabled button cannot be pressed. */
  const click = (action, match = {}, element = {}) => {
    const all = actionsOn(app.innerHTML).filter(a => a.action === action);
    const found = all.find(a => Object.entries(match).every(([k, v]) => v === undefined ? !(k in a.data) : a.data[k] === String(v)));
    if (!found) throw new Error(`no "${action}" button on the screen matching ${JSON.stringify(match)} (${all.length} with that action)`);
    if ('disabled' in found.attrs) throw new Error(`"${action}" is disabled`);
    return ctx.runAction(action, { tagName: found.tag, dataset: { ...found.data }, ...element }, { type: FORM_CONTROLS.has(found.tag) ? 'change' : 'click' });
  };
  return {
    run, ctx, app, storage, alerts, confirms, click, actionsOn,
    html: () => app.innerHTML,
    json: code => JSON.parse(run(`JSON.stringify(${code})`)),
  };
}

/* The elements in some HTML that run an action: [{ tag, action, data, attrs }]; data is the dataset
   (camelCase keys, decoded values), attrs every attribute. */
const FORM_CONTROLS = new Set(['SELECT', 'INPUT', 'TEXTAREA']);
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function actionsOn(html) {
  const out = [];
  for (const tag of html.matchAll(/<([a-zA-Z]+)\s((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const attrs = {};
    for (const a of tag[2].matchAll(/([a-zA-Z-]+)(?:=("[^"]*"|'[^']*'|[^\s"'>]+))?/g)) attrs[a[1].toLowerCase()] = a[2] == null ? '' : decode(a[2].replace(/^["']|["']$/g, ''));
    if (!attrs['data-action']) continue;
    const data = {};
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) data[camel(k.slice(5))] = v;
    out.push({ tag: tag[1].toUpperCase(), action: data.action, data, attrs });
  }
  return out;
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

/* Where a file lives under dist, found by its name, so a test that reads one file (its source, a constant
   in it) follows the file when it moves to another folder. One match only; vendor/ is not searched. */
function locate(name, dist = DIST) {
  const walk = dir => fs.readdirSync(path.join(dist, dir), { withFileTypes: true }).flatMap(d => {
    const f = path.posix.join(dir, d.name);
    return d.isDirectory() ? (f === 'vendor' ? [] : walk(f)) : [f];
  });
  const found = walk('').filter(f => f === name || f.endsWith('/' + name));
  if (found.length !== 1) throw new Error(`locate(${name}): ${found.length} files`);
  return found[0];
}
const readDist = (name, dist = DIST) => read(locate(name, dist), dist);

module.exports = { loadGame, actionsOn, pageScripts, gameSources, scriptsDefining, locate, readDist, DIST };
