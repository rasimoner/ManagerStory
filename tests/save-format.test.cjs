/* The save format (src/core/save.js, docs/save-format.md), V7.9.13 refactor B:
   - a new career and every loaded or imported save are in the current format (schemaVersion);
   - the migration chain is one step per format, in order, from 0 to SAVE_SCHEMA;
   - migrating a save that is already current changes nothing;
   - a save from a newer game is refused, not broken;
   - every field a career keeps is described in docs/save-format.md. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./support/game.cjs');
const { FAST } = require('./support/career-sim.cjs');

const legacy = fs.readFileSync(path.join(__dirname, 'fixtures/saves/legacy/v7.8.2.json'), 'utf8');

test('one migration step per format, in order, up to the current format', () => {
  const g = loadGame();
  const steps = g.json('SAVE_MIGRATIONS.map(s=>[s.from,s.to,typeof s.run,s.about])');
  assert.ok(steps.length >= 1);
  steps.forEach(([from, to, run, about], i) => {
    assert.equal(from, i); assert.equal(to, i + 1); assert.equal(run, 'function'); assert.ok(about.length > 20);
  });
  assert.equal(steps.at(-1)[1], g.run('SAVE_SCHEMA'));
});

test('a new career, a loaded old save and an imported old save are all in the current format', async () => {
  const g = loadGame();
  g.run('S=fresh();init()');
  assert.equal(g.run('S.schemaVersion'), g.run('SAVE_SCHEMA'));
  assert.equal(JSON.parse(legacy).schemaVersion, undefined, 'the fixture is a format-0 save');
  const loaded = loadGame({ storage: new Map([['msv4', legacy]]) });
  assert.equal(loaded.run('S.schemaVersion'), loaded.run('SAVE_SCHEMA'));
  assert.equal(loaded.run('S.version'), loaded.run('GAME_VERSION'));
  assert.ok(loaded.storage.get('msv4-v71-backup'), 'the old save is kept as it was');
  const imp = loadGame(); imp.run('S=fresh();init();save()');
  imp.ctx.__file = { size: legacy.length, text: async () => legacy };
  await imp.run('importCareer(__file)');
  assert.deepEqual(imp.alerts, []);
  assert.equal(imp.run('S.schemaVersion'), imp.run('SAVE_SCHEMA'));
});

test('migrating a current save changes nothing', () => {
  const g = loadGame({ storage: new Map([['msv4', legacy]]) });
  const before = g.run('JSON.stringify(S)');
  g.run('migrateSave(S)');
  assert.equal(g.run('JSON.stringify(S)'), before);
});

test('a save from a newer game is refused and left alone', () => {
  const newer = JSON.stringify({ ...JSON.parse(legacy), schemaVersion: 999 });
  const g = loadGame({ storage: new Map([['msv4', newer]]) });
  assert.equal(g.run('S'), null);
  assert.match(g.run('loadError'), /daha yeni/);
  assert.equal(g.storage.get('msv4'), newer, 'not overwritten');
  assert.throws(() => g.run(`validateCareerImport(${newer})`), /daha yeni/);
});

test('every field a career keeps is described in docs/save-format.md', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../docs/save-format.md'), 'utf8');
  const g = loadGame(); g.run(FAST);
  g.run('S=fresh();S.matchSalt=1;init();fastSeason();for(let i=0;i<3;i++)fastRound();S.event=null;nextEvent();startMatch();resumeLive();advanceLive(10);pauseLive();save()');
  const state = JSON.parse(g.storage.get('msv4'));
  const missing = Object.keys(state).filter(k => !doc.includes('`' + k + '`'));
  assert.deepEqual(missing, [], 'career fields not in the doc');
  const playerKeys = [...new Set(state.players.flatMap(p => Object.keys(p)))];
  assert.deepEqual(playerKeys.filter(k => !doc.includes('`' + k + '`')), [], 'player fields not in the doc');
});
