/* The one way tests load the game.
   The game is the ES modules index.html loads (refactor C3): main.js and the modules it imports, run in one
   vm context with a small stand-in for the browser, the same files the browser loads. Module entries that
   index.html tags with a data-layer belong to the match presentation and are left out unless asked for,
   so the engine runs on its own:
     data-layer="clock"  the presentation clock that paces the live match for the 2D/3D view
     data-layer="view"   the read-only boundary the 3D view reads the match through
     data-layer="3d"     the 3D view itself (needs WebGL: never loaded here)
   The test access point (refactor D0): tests reach the game by name, never by file. Every export of every
   module the page loaded is gathered into one place, the access point: g.api.<name> in JavaScript, and the
   same names as globals of the context for run('S=fresh();init()'). Each name is read live from whichever
   module exports it today, so a function that moves to another module is still found under its name and
   no test changes; g.owner(name) says where it lives now. Reading code goes the same way: sourceDefining(name)
   is the module that declares a name, wherever that is. Assigning one of the shared state's names goes through its setter
   (S → setCareer, M → setMatch, modal → setModal, loadError → setLoadError, subOut → setSubOut); assigning
   any other export throws, as it would in a module. Releases before C3 (old dist trees, for save
   fixtures) load the old way: their classic scripts in one context.
   Modules need node --experimental-vm-modules; npm test and npm run test:fast pass it.

   loadGame(options) → { run, json, api, owner, app, html, storage, alerts, confirms, ctx, click, actionsOn }
     api        the access point: every export by name (live; assigning the shared state goes through its setter)
     owner      owner(name) → the module that exports that name now (undefined for an old classic release)
     storage    Map used as localStorage (pass one in to load a save)
     layers     extra data-layer entries to load, e.g. ['clock', 'view']
     document   extra querySelector(q, app) handlers tried before the defaults
     prepend    insertAdjacentHTML on #app prepends instead of appends (as the star-transfer test expects)
     quiet      console.warn is silenced
     skip       entry files to leave out: 'main.js' loads the game's modules without running main.js
                (for old classic releases: scripts to leave out)
     entropy    seed for the stand-in crypto.getRandomValues (the device entropy behind new careers and
                kickoffs); a fixed default keeps tests repeatable. Pass null for no crypto at all. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const DIST = path.resolve(__dirname, '../../dist');
const read = (f, dist = DIST) => fs.readFileSync(path.join(dist, f), 'utf8');

/* What the page loads, in order, without cache-busters: [{ file, layer, module }]. A module page lists its
   module entries (main.js, then the presentation layers); an old page lists its classic scripts. */
function pageScripts(dist = DIST) {
  const html = read('index.html', dist);
  return [...html.matchAll(/<script\s+(type="module"\s+)?src="([^"?]+)(?:\?[^"]*)?"([^>]*)><\/script>/g)]
    .map(m => ({ file: m[2], module: !!m[1], layer: /data-layer="([^"]+)"/.exec(m[3])?.[1] || 'game' }));
}

/* Every module a module page loads: [{ file, layer, code, imports }], each once, in the order the entries
   reach them. A module belongs to the first entry that reaches it (the game, then a layer). */
const IMPORT = /(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
const resolveFrom = (file, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(file), spec.replace(/\?.*$/, '')));
function moduleGraph(dist = DIST) {
  const seen = new Map();
  for (const entry of pageScripts(dist).filter(s => s.module)) {
    const visit = file => {
      if (seen.has(file) || file.startsWith('vendor/')) return;
      const code = read(file, dist);
      const imports = [...code.matchAll(IMPORT)].map(m => resolveFrom(file, m[1]));
      seen.set(file, { file, layer: entry.layer, code, imports });
      imports.forEach(visit);
    };
    visit(entry.file);
  }
  return [...seen.values()];
}

const cache = new Map();
function sources(dist = DIST) {
  if (!cache.has(dist)) {
    const page = pageScripts(dist);
    cache.set(dist, page.some(s => s.module) ? moduleGraph(dist) : page.map(s => ({ ...s, code: read(s.file, dist) })));
  }
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
  let access = { api: ctx, owner: () => undefined };
  if (pageScripts(dist).some(s => s.module)) access = loadModules(ctx, { layers, skip, dist });
  else for (const { file, layer, code } of sources(dist)) {
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
    run, ctx, app, storage, alerts, confirms, click, actionsOn, api: access.api, owner: access.owner,
    html: () => app.innerHTML,
    json: code => JSON.parse(run(`JSON.stringify(${code})`)),
  };
}

/* The module page in the context: each entry (main.js, then the asked-for layers) is linked and run, as
   the browser runs index.html's module scripts in order. Then the access point is built: one object with
   every export of every module (a getter on its module, and for the shared state a setter that calls the
   module's own setter). The context's globals are that same object's names, so run('…') and g.api.… see
   one game. A name exported by two modules is an error: the access point would not know which one. */
const SETTERS = { S: 'setCareer', M: 'setMatch', modal: 'setModal', loadError: 'setLoadError', subOut: 'setSubOut' };
function loadModules(ctx, { layers, skip, dist }) {
  if (!vm.SourceTextModule) throw new Error('the game is ES modules: run the tests with node --experimental-vm-modules (npm test does)');
  const graph = new Map(sources(dist).map(m => [m.file, m]));
  const records = new Map();
  const build = file => {
    if (records.has(file)) return records.get(file);
    if (file.startsWith('vendor/')) throw new Error(`${file}: the game's modules do not import vendor code (only the 3D view does)`);
    const info = graph.get(file);
    const mod = new vm.SourceTextModule(info.code, { context: ctx, identifier: file,
      importModuleDynamically: () => { throw new Error('dynamic import is not available in the test harness'); } });
    records.set(file, mod);
    mod.linkRequests(mod.moduleRequests.map(r => build(resolveFrom(file, r.specifier))));
    return mod;
  };
  const entries = pageScripts(dist).filter(s => s.module && (s.layer === 'game' || layers.includes(s.layer)));
  const run = file => {
    const mod = build(file);
    if (mod.status === 'unlinked') mod.instantiate();
    if (mod.status === 'linked') mod.evaluate();
    if (mod.status === 'errored') throw mod.error;
  };
  for (const entry of entries) {
    if (skip.includes(entry.file)) graph.get(entry.file).imports.forEach(run); // its modules, without it
    else run(entry.file);
  }
  const owner = new Map();
  const api = Object.create(null);
  for (const [file, mod] of records) {
    if (mod.status !== 'evaluated') continue;
    for (const name of Object.keys(mod.namespace)) {
      if (owner.has(name)) throw new Error(`${name} is exported by both ${owner.get(name)} and ${file}`);
      owner.set(name, file);
      const ns = mod.namespace;
      Object.defineProperty(api, name, {
        enumerable: true,
        get: () => ns[name],
        set: value => {
          if (SETTERS[name] && typeof api[SETTERS[name]] === 'function') return api[SETTERS[name]](value);
          throw new TypeError(`${name} is a binding of ${file}: a module cannot be assigned from outside`);
        },
      });
    }
  }
  Object.freeze(api);
  // the context's globals are the access point's names
  for (const name of owner.keys()) {
    Object.defineProperty(ctx, name, {
      configurable: true, enumerable: true,
      get: () => api[name],
      set: value => { api[name] = value; },
    });
  }
  return { api, owner: name => owner.get(name) };
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
   modules (or an old page's scripts), or of those that define the given functions, found by what they
   define rather than by file name, so the rules follow the code when it moves. */
const gameSources = ({ layers = [], dist = DIST } = {}) => sources(dist).filter(s => s.layer === 'game' || layers.includes(s.layer));
function scriptsDefining(names, options) {
  const defines = (code, name) => new RegExp(`function\\s+${name}\\s*\\(`).test(code);
  const found = gameSources(options).filter(s => names.some(n => defines(s.code, n)));
  for (const n of names) if (!found.some(s => defines(s.code, n))) throw new Error(`no page script defines ${n}`);
  return found;
}

/* The page module that declares a top-level name (function, class, const, let or var), found by the name,
   so a test that reads some code follows it when it moves to another module. */
function sourceDefining(name, options) {
  const declares = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:(?:async\\s+)?function\\*?|class|const|let|var)\\s+(?:[^=;(]*[,{\\s])?${name.replace(/\$/g, '\\$')}\\b`);
  const found = gameSources({ layers: ['clock', 'view', '3d'], ...options }).filter(s => declares.test(s.code));
  if (found.length !== 1) throw new Error(`sourceDefining(${name}): ${found.length} modules`);
  return found[0];
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

module.exports = { loadGame, actionsOn, pageScripts, gameSources, scriptsDefining, sourceDefining, locate, readDist, DIST };
