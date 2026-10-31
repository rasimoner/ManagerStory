const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function restartScene(kind, direction) {
  const { api, input } = labFixture({ seed: 731 });
  input.match = false;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), before = plain(simulation.teams.map(team => team.players.map(player => player.position)));
  if (['freeKick', 'penalty'].includes(kind)) {
    const position = { x: (kind === 'penalty' ? 44 : 25) * direction, y: 2 };
    const restart = api.simulationFoulRestartPosition(position, -direction);
    api.stopSimulationForFoul(simulation, { teamId: 'home', toPos: position, restartPosition: restart.position, penaltyPending: restart.penaltyPending });
  } else {
    const position = kind === 'throwIn' ? { x: 8, y: 34.3 } : { x: 52.8 * direction, y: 20 };
    const start = kind === 'throwIn' ? { x: 8, y: 33.9 } : { x: 52.3 * direction, y: 20 };
    Object.assign(simulation.ball, { position, ownerId: null, lastTouchTeamId: kind === 'corner' ? 'away' : 'home' });
    api.resolveSimulationBallOut(simulation, { position: start }, { startTime: 0, seconds: .1 });
  }
  assert.deepEqual(plain(simulation.teams.map(team => team.players.map(player => player.position))), before, 'a whistle never teleports players');
  return { api, simulation };
}

function releaseRestart(fixture, kind) {
  const { api, simulation } = fixture, spot = plain(simulation.ball.position), rng = simulation.rngState;
  let previous = simulation.teams.flatMap(team => team.players.map(player => ({ ...player.position })));
  for (let index = 0; index < 1500 && simulation.ball.restart; index++) {
    api.stepSimulation(simulation);
    simulation.teams.flatMap(team => team.players).forEach((player, playerIndex) => {
      assert.ok(Math.hypot(player.position.x - previous[playerIndex].x, player.position.y - previous[playerIndex].y) <= player.limits.maxSpeed * .1 + 1e-9, 'restart layouts use ordinary movement');
    });
    previous = simulation.teams.flatMap(team => team.players.map(player => ({ ...player.position })));
    if (simulation.ball.restart) {
      assert.deepEqual(plain(simulation.ball.position), spot);
      assert.equal(simulation.rngState, rng, 'preparation draws no football outcomes');
      assert.equal(simulation.events.filter(event => ['pass', 'shot'].includes(event.type)).length, 0);
    }
  }
  assert.equal(simulation.ball.restart, null, `${kind} must not deadlock`);
  const event = simulation.events.find(event => event.type === kind);
  assert.ok(event, `the engine must emit a real ${kind} release`);
  assert.deepEqual(plain(event.fromPos), spot);
  assert.equal(simulation.referee.stoppage, null);
  return event;
}

for (const direction of [-1, 1]) for (const kind of ['throwIn', 'corner', 'goalKick', 'freeKick', 'penalty']) {
  test(`${kind} in direction ${direction} arranges legal players before the real release`, () => {
    const fixture = restartScene(kind, direction), event = releaseRestart(fixture, kind);
    assert.equal(event.temporaryRestart, false);
    if (kind === 'throwIn') assert.ok(fixture.simulation.ball.height > 1.5);
    if (kind === 'penalty') {
      assert.equal(event.fromPos.x, 41.5 * direction);
      assert.equal(event.fromPos.y, 0);
      assert.equal(fixture.simulation.ball.shot.penalty, true);
      const keeper = fixture.simulation.teams[1].players.find(player => player.slot === 'GK');
      assert.ok(Math.abs(keeper.position.x - 52.5 * direction) < .3);
      assertPenaltyExclusions(fixture.simulation, event, direction);
    }
    if (kind === 'freeKick' || kind === 'corner') assert.ok(event.nearestOpponentDistance >= 9.15);
    if (kind === 'goalKick') assert.equal(fixture.simulation.ball.heldBy, null, 'goal kicks use the feet');
  });
}

function assertPenaltyExclusions(simulation, event, direction) {
  for (const team of simulation.teams) for (const player of team.players) {
    if (player.id === event.fromId || player.slot === 'GK' || player.sentOff) continue;
    assert.ok(player.position.x * direction < 41.5);
    assert.ok(player.position.x * direction <= 36 || Math.abs(player.position.y) >= 20.16);
    assert.ok(Math.hypot(player.position.x - event.fromPos.x, player.position.y) >= 9.15);
  }
}

test('saving during a moving restart preserves the same release, positions and RNG', () => {
  const { api, simulation } = restartScene('corner', 1), game = loadGame({ quiet: true });
  for (let index = 0; index < 20; index++) api.stepSimulation(simulation);
  const restored = game.api.restoreSimulation(game.api.snapshotSimulation(simulation));
  while (simulation.ball.restart) api.stepSimulation(simulation);
  while (restored.ball.restart) game.api.stepSimulation(restored);
  assert.deepEqual(plain(game.api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});

test('a real touchline windup holds the mesh between both hands and releases the old throw animation', async () => {
  const { api, simulation } = restartScene('throwIn', 1), game = loadGame({ quiet: true }), fixture = await sceneFixture();
  while (simulation.ball.restart.stage !== 'ready') api.stepSimulation(simulation);
  const takerId = simulation.ball.restart.takerId;
  const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
  fixture.actors.apply(frame);
  const actor = fixture.runtime.players.find(actor => actor.id === takerId);
  const mesh = new fixture.THREE.Object3D(), shadow = new fixture.THREE.Mesh(new fixture.THREE.CircleGeometry(), new fixture.THREE.MeshBasicMaterial());
  const view = fixture.api.createSimulationBallView(mesh, shadow, { runtime: fixture.runtime });
  view.apply(frame);
  for (const side of ['Left', 'Right']) assert.ok(actor.bones[`${side}Hand`].getWorldPosition(new fixture.THREE.Vector3()).distanceTo(mesh.position) < .2);
  while (simulation.ball.restart) api.stepSimulation(simulation);
  fixture.actors.apply(game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true }));
  assert.equal(actor.act?.name, 'throwIn');
});
