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
  assert.equal(saved.activeMatchV71.simulationArchive.encoding, 'lzw-varint-base64');
  assert.equal(saved.activeMatchV71.simulationCheckpoint, undefined);
  const restored = loadGame({ storage: new Map(game.storage) });
  assert.deepEqual(restored.json('M.simulation.events'), game.json('M.simulation.events'));
  assert.equal(restored.run('M.simulation.rngState'), game.run('M.simulation.rngState'));
  assert.equal(restored.run('M.matchElapsedSeconds'), game.run('M.matchElapsedSeconds'));
});
