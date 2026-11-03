const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');

function naturalMatch(api, seed = 1) {
  const input = api.createLabScenario({ seed });
  input.durationSeconds = 420;
  return api.createSimulation(input);
}

function stepUntilHalfBreak(api, simulation) {
  for (let tick = 0; tick < 6000 && simulation.match.phase !== 'half'; tick++) {
    if (simulation.paused) api.resumeSimulation(simulation);
    api.stepSimulation(simulation);
  }
  assert.equal(simulation.match.phase, 'half');
}

function distanceToTarget(player) {
  return Math.hypot(player.position.x - player.target.x, player.position.y - player.target.y);
}

test('a natural-length match starts the second half with every player already at the kickoff position', () => {
  const { api } = loadLab(), simulation = naturalMatch(api);
  stepUntilHalfBreak(api, simulation);
  for (const team of simulation.teams) for (const player of team.players) {
    assert.ok(distanceToTarget(player) < 0.01, `${player.id} walks to ${distanceToTarget(player).toFixed(1)} m away`);
    assert.equal(Math.hypot(player.velocity.x, player.velocity.y), 0);
  }
});

test('the reference laboratory still walks to the second-half positions', () => {
  const { api } = loadLab(), simulation = api.createSimulation(api.createLabScenario({ seed: 1 }));
  for (let tick = 0; tick < 30000 && simulation.match.phase !== 'half'; tick++) api.stepSimulation(simulation);
  assert.equal(simulation.match.phase, 'half');
  const farthest = Math.max(...simulation.teams.flatMap(team => team.players.map(player => distanceToTarget(player))));
  assert.ok(farthest > 5, `reference players stayed put (${farthest})`);
});

test('the scene announces no preparation once the teams were relocated', () => {
  const { api } = loadLab(), simulation = naturalMatch(api);
  stepUntilHalfBreak(api, simulation);
  const scene = loadGame({ quiet: true }).api, frame = plain(scene.captureSimulationFrame(simulation));
  assert.equal(frame.teamsRelocated, true);
  assert.deepEqual(plain(scene.simulationSceneStatus(frame)), { preparing: false, label: '' });
  assert.equal(scene.simulationDisplayMatchTime(frame), 2700);
});

test('a displacement no player can run in one step is shown as a relocation, not as a slide', () => {
  const game = loadGame({ quiet: true });
  const player = (x, heading) => ({ id: 'p', heading, position: { x, y: 0 }, velocity: { x: 0, y: 0 } });
  const frame = (x, physicsTime) => ({ tick: 1, half: 2, phase: 'half', physicsTime, matchTime: 2700, players: [player(x, 0)], contacts: [],
    ball: { position: { x: 0, y: 0 }, height: 0, velocity: { x: 0, y: 0 } } });
  const sampled = game.api.sampleSimulationScene({ previousFrame: frame(-40, 0), frame: frame(40, .1), accumulatorSeconds: .05 });
  assert.equal(sampled.players[0].position.x, 40);
});

test('the sampled 3D scene carries the relocation flag, so its status shows no preparation mask', () => {
  const { api } = loadLab(), simulation = naturalMatch(api);
  stepUntilHalfBreak(api, simulation);
  const scene = loadGame({ quiet: true }).api, frame = plain(scene.captureSimulationFrame(simulation));
  const sampled = scene.sampleSimulationScene({ previousFrame: frame, frame, accumulatorSeconds: 0 });
  assert.equal(sampled.phase, 'half');
  assert.deepEqual(plain(scene.simulationSceneStatus(sampled)), { preparing: false, label: '' });
});
