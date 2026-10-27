/* Refactor E1: the game does not depend on the order its modules run in.
   A bundler may order modules differently from the browser reading main.js's imports one by one (and it splits the
   3D view into a chunk of its own). Two things could then break:
   - a value read before its module has run: in an import cycle (league ↔ clubs ↔ season, app ↔ season-end) a module
     that reads another one's const at load time fails if that one has not run yet. The values computed from the data
     (OPP, CLUBSTYLE, SKILL_NAMES, the tactics' vocabulary…) therefore live in modules that import nothing but data,
     and every module can be the first one to run;
   - what modules register at load time (season-end steps, actions, hooks) ending up in another order.
   These tests run the modules in other orders and check both. (After Vite, the same flows are also played on the
   build output in the browser smoke test.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, gameSources, sourceDefining } = require('./support/game.cjs');

const LAYERS = ['clock', 'view'];
const modules = gameSources({ layers: LAYERS }).filter(s => !s.file.startsWith('data/') && s.file !== 'main.js');
const mainImports = gameSources().find(s => s.file === 'main.js').imports;

test('every module can be the first to run: nothing is read before its module has run', () => {
  assert.ok(modules.length > 30, `${modules.length} modules`);
  for (const { file } of modules) {
    try { loadGame({ first: [file], layers: LAYERS, quiet: true }); } catch (error) { assert.fail(`${file} first: ${error.message}`); }
  }
});

test('the values computed from the data live in modules that import only data', () => {
  const fromData = ['OPP', 'LEAGUE_LIFT', 'OPPONENT_FIRST', 'OPPONENT_LAST', 'CLUBSTYLE', 'SKILL_NAMES', 'MATCH_TACTICS',
    'TACTIC_LABELS', 'TEAM_ORDERS', 'GAME_VERSION', 'V6FN', 'SLOT_POS'];
  for (const name of fromData) {
    const { file, imports } = sourceDefining(name);
    assert.deepEqual(imports.filter(i => !i.startsWith('data/')), [], `${name} (${file}) imports only data`);
  }
});

/* What the modules have registered once the game is open: the season-end steps in order, the actions, the hooks
   with their handlers in order. */
const registered = g => ({
  seasonSteps: g.json('SEASON_END_STEPS.map(s => s.id)'),
  actions: g.json('Object.keys(ACTIONS).sort()'),
  hooks: g.json('Object.fromEntries(Object.entries(HOOKS).map(([k, list]) => [k, list.map(f => f.name)]))'),
});

test('registrations are the same whatever order the modules run in', () => {
  const page = registered(loadGame());
  assert.deepEqual(page.seasonSteps, ['summary', 'aging', 'retire', 'loans', 'report', 'contracts', 'academy', 'rivals', 'market', 'cleanup', 'newSeason'],
    'the season end: core steps, the manager steps in their places');
  assert.ok(page.actions.length > 80, `${page.actions.length} actions`);
  for (const order of [[...mainImports].reverse(), [...mainImports].sort(), [...mainImports].sort().reverse()]) {
    assert.deepEqual(registered(loadGame({ first: order })), page, order.slice(0, 3).join(', ') + ' …');
  }
  // the manager mode's modules first: they still register after core's (they depend on it)
  const modeFirst = mainImports.filter(f => f.startsWith('modes/')).concat(mainImports);
  assert.deepEqual(registered(loadGame({ first: modeFirst })), page, 'modes first');
});
