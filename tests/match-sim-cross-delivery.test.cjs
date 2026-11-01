const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');

function crossFixture(direction = 1, skill = 90) {
  const { api, input } = labFixture({ seed: 73 });
  input.match = false;
  input.durationSeconds = 420;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), taker = simulation.teams[0].players.find(player => player.slot === 'LW');
  Object.assign(taker.attributes, { technique: skill, passing: skill });
  return { api, simulation, taker, direction };
}

function releaseCorner(fixture) {
  const { api, simulation, taker, direction } = fixture;
  api.beginSimulationRestart(simulation, { kind: 'corner', teamId: 'home', position: { x: 52.5 * direction, y: -34 }, taker });
  const spot = plain(simulation.ball.position);
  for (let tick = 0; tick < 1500 && simulation.ball.restart; tick++) {
    const before = simulation.teams.flatMap(team => team.players.map(player => ({ ...player.position })));
    api.stepSimulation(simulation);
    simulation.teams.flatMap(team => team.players).forEach((player, index) => {
      assert.ok(Math.hypot(player.position.x - before[index].x, player.position.y - before[index].y) <= player.limits.maxSpeed * .1 + 1e-8);
      assert.ok(Math.abs(player.position.x) <= 52.5 && Math.abs(player.position.y) <= 34);
    });
  }
  assert.equal(simulation.ball.restart, null, 'an inside-pitch approach must release');
  assert.ok(simulation.events.some(event => event.type === 'corner' && event.nearestOpponentDistance >= 9.15));
  assert.deepEqual(plain(simulation.events.find(event => event.type === 'corner').fromPos), spot);
}

for (const direction of [-1, 1]) for (const skill of [25, 90]) {
  test(`corner chooses short or real box delivery: direction ${direction}, skill ${skill}`, () => {
    const fixture = crossFixture(direction, skill);
    releaseCorner(fixture);
    const { simulation } = fixture, pass = simulation.events.find(event => event.type === 'pass');
    assert.equal(pass.restartKind, 'corner', 'the pass retains restart metadata even after a cross event');
    assert.equal(pass.temporaryRestart, false);
    const cross = simulation.events.find(event => event.type === 'cross');
    if (skill < 50) { assert.equal(cross, undefined); assert.equal(pass.lofted, false); return; }
    assert.ok(cross);
    assert.ok(cross.toPos.x * direction > 36 && Math.abs(cross.toPos.y) < 20);
    assert.ok(simulation.ball.verticalVelocity > 0);
    const receiver = simulation.teams[0].players.find(player => player.id === pass.toId);
    assert.ok(Math.abs(receiver.position.x) > 36);
    assert.equal(simulation.ball.flight.cross, true);
  });
}

test('an indirect wide free kick can serve the area with the same flight', () => {
  const { api, simulation, taker } = crossFixture();
  taker.position = { x: 25, y: -25 };
  api.beginSimulationRestart(simulation, { kind: 'freeKick', teamId: 'home', position: { ...taker.position }, taker, indirect: true });
  for (let tick = 0; tick < 1500 && simulation.ball.restart; tick++) api.stepSimulation(simulation);
  assert.equal(simulation.ball.restart, null);
  assert.ok(simulation.events.some(event => event.type === 'cross' && event.restartKind === 'freeKick'));
  assert.equal(simulation.events.some(event => event.type === 'shot'), false, 'an indirect kick cannot become a direct shot');
});

function openDelivery(fixture, historical = false) {
  const { api, simulation, taker, direction } = fixture;
  simulation.clock.pauseHalfPreparation = !historical;
  taker.position = { x: 30 * direction, y: -25 };
  const receiver = simulation.teams[0].players.find(player => player.slot === 'ST');
  receiver.position = { x: 41 * direction, y: 0 };
  receiver.velocity = { x: direction, y: 1 };
  api.placeSimulationBall(simulation, { teamId: 'home', ownerId: taker.id, position: { ...taker.position } });
  api.releaseSimulationPass(simulation, taker, { toId: receiver.id, lofted: true, target: { x: 41.4 * direction, y: .4 } });
  return receiver;
}

for (const direction of [-1, 1]) {
  test(`open delivery is a physical lofted pass to a moving runner, direction ${direction}`, () => {
    const fixture = crossFixture(direction);
    openDelivery(fixture);
    const { api, simulation } = fixture;
    assert.ok(simulation.events.some(event => event.type === 'cross'));
    const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
    for (let tick = 0; tick < 80; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
    assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
    assert.equal(simulation.ball.flight?.cross ?? false, false, 'delivery resolves through a real arrival, interception or exit');
  });
}

test('historical reference checkpoints retain their original lofted flight and event classification', () => {
  const fixture = crossFixture();
  openDelivery(fixture, true);
  const { api, simulation } = fixture, pass = simulation.events.find(event => event.type === 'pass');
  assert.equal(simulation.events.some(event => event.type === 'cross'), false);
  const flight = api.simulationPassFlight(pass.fromPos, pass.toPos, true);
  assert.equal(simulation.ball.verticalVelocity, flight.verticalVelocity);
});

test('a missed cross can leave the pitch without assigning its intended runner ownership', () => {
  const fixture = crossFixture();
  openDelivery(fixture);
  const { api, simulation } = fixture;
  for (const team of simulation.teams) for (const player of team.players) {
    player.position = { x: -40, y: 25 }; player.sentOff = true;
  }
  simulation.ball.velocity = { x: 20, y: -10 };
  simulation.ball.verticalVelocity = 2;
  for (let tick = 0; tick < 30 && !simulation.ball.restart; tick++) api.stepSimulation(simulation);
  assert.equal(simulation.events.find(event => event.type === 'pass').success, false);
  assert.equal(simulation.ball.ownerId, null);
});

test('format 7 raw and compressed active flights migrate without changing their physical ball or RNG', () => {
  const game = loadGame({ quiet: true }), fixture = crossFixture();
  openDelivery(fixture, true);
  const checkpoint = plain(fixture.api.snapshotSimulation(fixture.simulation));
  for (const packed of [false, true]) {
    const active = { experimental: true, simulationCheckpoint: checkpoint, events: [] };
    const career = { schemaVersion: 7, players: [], activeMatchV71: packed ? game.api.packExperimentalMatch(active) : active };
    game.api.migrateSave(career);
    assert.equal(career.schemaVersion, 8);
    const after = game.api.unpackMatchSnapshot(career.activeMatchV71).simulationCheckpoint;
    assert.equal(after.state.ball.flight.cross, false);
    assert.equal(after.state.ball.flight.crossEventIndex, null);
    delete after.state.ball.flight.cross; delete after.state.ball.flight.crossEventIndex;
    assert.deepEqual(plain(after), checkpoint);
  }
});

test('a cross uses nearby runners instead of unnecessarily moving distant centre backs into the box', () => {
  const { api, simulation, taker } = crossFixture();
  const team = simulation.teams[0];
  for (const player of team.players) player.position = { x: -20, y: 0 };
  for (const [slot, y] of [['ST', 0], ['CAM', -4], ['RW', 4]]) team.players.find(player => player.slot === slot).position = { x: 40, y };
  api.beginSimulationRestart(simulation, { kind: 'corner', teamId: team.id, position: { x: 52.5, y: -34 }, taker });
  api.stepSimulation(simulation);
  const targets = simulation.ball.restart.targets;
  for (const slot of ['LCB', 'RCB']) {
    const defender = team.players.find(player => player.slot === slot);
    assert.equal(targets[defender.id].x, -20, 'nearby attackers make a distant centre-back run unnecessary');
  }
});
