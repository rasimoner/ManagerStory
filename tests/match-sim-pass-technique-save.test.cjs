const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');
const { labFixture, plain } = require('./support/lab.cjs');

test('format 9 raw and archived checkpoints add optional pass preparation without changing football', () => {
  const game = loadGame({ quiet: true }), { api, simulation } = labFixture();
  const checkpoint = plain(api.snapshotSimulation(simulation));
  for (const packed of [false, true]) {
    const active = { experimental: true, simulationCheckpoint: checkpoint, events: [] };
    const career = { schemaVersion: 9, players: [], activeMatchV71: packed ? game.api.packExperimentalMatch(active) : active };
    game.api.migrateSave(career);
    assert.equal(career.schemaVersion, 10);
    const after = game.api.unpackMatchSnapshot(career.activeMatchV71).simulationCheckpoint;
    assert.equal(after.state.passing.technique, null);
    delete after.state.passing.technique;
    assert.deepEqual(plain(after), checkpoint);
  }
});
