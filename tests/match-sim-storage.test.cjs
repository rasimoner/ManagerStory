const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

test('the simulation archive round-trips Unicode and dictionary resets without browser APIs', () => {
  const game = loadGame();
  const inputs = ['', '⚽ Aras şut çekti. GOL! İstanbul 🟥', 'abcabcabca'.repeat(30000), Array.from({ length: 80000 }, (_, i) => String.fromCharCode(i % 65536)).join('')];
  for (const value of inputs) assert.equal(game.api.decompressSimulationArchive(game.api.compressSimulationArchive(value)), value);
});

test('mid-match persistence stores a compressed archive and restores the exact in-memory match', () => {
  const game = loadGame();
  game.run('S=fresh();init();S.matchSalt=73;S.experimentalMatchEngine=true;startMatch();advanceExperimentalSeconds(120);pauseLive();save()');
  const saved = JSON.parse(game.storage.get('msv4'));
  assert.equal(saved.activeMatchV71.simulationArchive.encoding, 'lzw-varint-utf16');
  assert.equal(saved.activeMatchV71.simulationCheckpoint, undefined);
  const restored = loadGame({ storage: new Map(game.storage) });
  assert.deepEqual(restored.json('M.simulation.events'), game.json('M.simulation.events'));
  assert.equal(restored.run('M.simulation.rngState'), game.run('M.simulation.rngState'));
  assert.equal(restored.run('M.matchElapsedSeconds'), game.run('M.matchElapsedSeconds'));
});

test('completed experimental summaries are compact in storage and remain full records when reopened', () => {
  const game = loadGame();
  game.run('S=fresh();init();S.results=[{matchSummary:{engine:"continuous",players:[],events:[{type:"goal",text:"⚽ Aras"}]}}];save()');
  const saved = JSON.parse(game.storage.get('msv4'));
  assert.equal(saved.results[0].matchSummary.archive.encoding, 'lzw-varint-utf16');
  const restored = loadGame({ storage: new Map(game.storage) });
  assert.deepEqual(restored.json('S.results[0].matchSummary.events'), [{ type: 'goal', text: '⚽ Aras' }]);
});

test('season cleanup cannot restore discarded replay events from an older compressed summary', () => {
  const game = loadGame();
  game.run('S=fresh();init();S.results=[{matchSummary:{engine:"continuous",players:[],events:[{type:"shot"}]}}];save()');
  game.run('delete S.results[0].matchSummary.events;S.results[0].matchSummary.compact=true;save()');
  const restored = loadGame({ storage: new Map(game.storage) });
  assert.equal(restored.run('S.results[0].matchSummary.events'), undefined);
  assert.equal(restored.run('S.results[0].matchSummary.compact'), true);
});

test('an older background autosave cannot overwrite a newer explicit save', async () => {
  const game = loadGame();
  game.run('S=fresh();init();S.experimentalMatchEngine=true;startMatch()');
  let resolve, archive;
  const pending = new Promise(done => { resolve = done; });
  game.api.presentation.archivePersistence = { compress: json => { archive = json; return pending; } };
  game.run('save({automatic:true});S.budget=12345678;save()');
  resolve(game.api.compressSimulationArchive(archive));
  await new Promise(done => setImmediate(done));
  assert.equal(JSON.parse(game.storage.get('msv4')).budget, 12345678);
});
