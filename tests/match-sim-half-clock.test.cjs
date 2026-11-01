const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');

function halfFixture(seconds = 180) {
  const { input } = labFixture({ seed: 731 });
  const { api } = loadGame({ quiet: true });
  const simulation = api.createSimulation({ ...input, workload: true, durationSeconds: seconds });
  simulation.match.phase = 'playing';
  simulation.tick = simulation.clock.totalTicks / 2 - 1;
  simulation.time = simulation.physicsTime = simulation.tick * .1;
  simulation.matchTime = 2700 - 5400 / simulation.clock.totalTicks;
  api.stepSimulation(simulation);
  return { api, simulation };
}

for (const seconds of [180, 300, 420, 600]) {
  test(`${seconds}s halftime freezes football and exposure until the physical kickoff layout is ready`, () => {
    const { api, simulation } = halfFixture(seconds);
    const before = plain({ statistics: simulation.statistics, workload: simulation.teams.map(team => team.players.map(player => player.workload)), rng: simulation.rngState });
    settleHalf({ api, simulation });
    assert.equal(simulation.match.phase, 'playing');
    const kickoff = simulation.events.findLast(event => event.type === 'kickoff');
    assert.equal(kickoff.half, 2);
    assert.equal(kickoff.matchTime, 2700);
    assert.equal(kickoff.teamId, simulation.teams[1].id);
    assert.equal(simulation.rngState === before.rng, false, 'only the real kickoff pass may draw execution error');
    assert.deepEqual(plain(simulation.teams.map(team => team.players.map(player => player.workload))), before.workload);
    assertKickoffShape({ api, simulation }, kickoff);
    api.stepSimulation(simulation);
    assert.equal(simulation.matchTime, 2700 + 5400 / simulation.clock.totalTicks);
  });
}

function settleHalf({ api, simulation }) {
  const directions = simulation.teams.map(team => team.direction), halfTick = simulation.tick;
  let previous = simulation.teams.flatMap(team => team.players.map(player => ({ ...player.position })));
  while (simulation.match.phase === 'half' && simulation.tick < halfTick + 2000) {
    const rng = simulation.rngState;
    api.stepSimulation(simulation);
    assert.equal(simulation.matchTime, 2700);
    assert.deepEqual(simulation.teams.map(team => team.direction), directions);
    if (simulation.match.phase === 'half') assert.equal(simulation.rngState, rng);
    simulation.teams.flatMap(team => team.players).forEach((player, index) => {
      assert.ok(Math.hypot(player.position.x - previous[index].x, player.position.y - previous[index].y) <= player.limits.maxSpeed * .1 + 1e-9);
    });
    previous = simulation.teams.flatMap(team => team.players.map(player => ({ ...player.position })));
  }
  assert.ok(simulation.tick > halfTick + 1);
}

function assertKickoffShape({ api, simulation }, kickoff) {
  for (const team of simulation.teams) for (const player of team.players) {
    if (player.sentOff) continue;
    assert.ok(player.id === kickoff.fromId || player.position.x * team.direction <= 1e-9);
    if (team.id !== kickoff.teamId) assert.ok(Math.hypot(player.position.x, player.position.y) >= api.MATCH_SIM_DATA.pitch.centerCircleRadius);
  }
}

test('checkpoint, pause and skip retain halftime clock debt and end exactly at 90:00', () => {
  const { api, simulation } = halfFixture();
  for (let index = 0; index < 20; index++) api.stepSimulation(simulation);
  const snapshot = api.snapshotSimulation(simulation), restored = api.restoreSimulation(snapshot);
  assertPausedHalf({ api, simulation: restored });
  while (simulation.match.phase === 'half') api.stepSimulation(simulation);
  while (restored.match.phase === 'half') api.stepSimulation(restored);
  assert.equal(restored.clock.stoppedTicks, simulation.clock.stoppedTicks);
  simulation.tick = simulation.clock.totalTicks + simulation.clock.stoppedTicks - 1;
  simulation.time = simulation.physicsTime = simulation.tick * .1;
  const playback = api.createSimulationPlayback(simulation);
  api.advanceSimulationPlayback(playback, simulation, { skip: true, seconds: 0, speed: 1, maxSteps: 50 });
  assert.equal(simulation.matchTime, 5400);
  assert.equal(simulation.match.phase, 'ended');
  assert.equal(simulation.events.findLast(event => event.type === 'end').matchTime, 5400);
  const ended = plain(api.readSimulation(simulation));
  api.stepSimulation(simulation);
  assert.deepEqual(plain(api.readSimulation(simulation)), ended);
});

function assertPausedHalf({ api, simulation }) {
  const original = simulation.matchTime;
  api.pauseSimulation(simulation);
  const paused = plain(api.readSimulation(simulation));
  api.advanceSimulation(simulation, { seconds: 10 });
  assert.deepEqual(plain(api.readSimulation(simulation)), paused);
  api.resumeSimulation(simulation);
  assert.equal(simulation.matchTime, original);
}

test('format 5 raw and archived career checkpoints migrate without rewriting their football', () => {
  const { api, simulation } = halfFixture();
  const snapshot = plain(api.snapshotSimulation(simulation));
  delete snapshot.state.clock.stoppedTicks;
  for (const archived of [false, true]) {
    const active = { experimental: true, simulationCheckpoint: snapshot, events: [] };
    const career = { schemaVersion: 5, players: [], xi: [], activeMatchV71: archived ? api.packExperimentalMatch(active) : active };
    api.migrateSave(career);
    assert.equal(career.schemaVersion, api.SAVE_SCHEMA);
    const migrated = api.unpackMatchSnapshot(career.activeMatchV71).simulationCheckpoint;
    assert.equal(migrated.state.clock.stoppedTicks, 0);
    assert.equal(migrated.state.matchTime, snapshot.state.matchTime);
    assert.deepEqual(plain(migrated.state.ball), snapshot.state.ball);
    assert.equal(api.restoreSimulation(snapshot).clock.stoppedTicks, 0);
  }
});
