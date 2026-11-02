const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');
const { labFixture, plain } = require('./support/lab.cjs');

test('format 8 raw and compressed carry records add optional skill intent without changing football', () => {
  const game = loadGame({ quiet: true }), { api, simulation } = labFixture();
  const owner = simulation.teams[0].players.at(-1);
  api.placeSimulationBall(simulation, { teamId: owner.teamId, ownerId: owner.id, position: owner.position });
  api.startCarry(simulation, owner);
  const checkpoint = plain(api.snapshotSimulation(simulation));
  for (const packed of [false, true]) {
    const active = { experimental: true, simulationCheckpoint: checkpoint, events: [] };
    const career = { schemaVersion: 8, players: [], activeMatchV71: packed ? game.api.packExperimentalMatch(active) : active };
    game.api.migrateSave(career);
    assert.equal(career.schemaVersion, game.api.SAVE_SCHEMA);
    const after = game.api.unpackMatchSnapshot(career.activeMatchV71).simulationCheckpoint;
    assert.equal(after.state.ball.carry.skill, null);
    delete after.state.ball.carry.skill;
    assert.equal(after.state.passing.technique, null);
    delete after.state.passing.technique;
    assert.deepEqual(plain(after), checkpoint);
  }
});
