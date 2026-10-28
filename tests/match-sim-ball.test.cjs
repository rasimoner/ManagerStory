const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');

function scene(overrides = {}) {
  const fixture = labFixture({ seed: 71 });
  const { api, input } = fixture;
  for (const [index, team] of input.teams.entries()) for (const [slot, player] of team.players.entries()) {
    player.position = { x: index ? 43 : -43, y: -30 + slot * 6 };
    Object.assign(player.attributes, { passing: 100, firstTouch: 100, technique: 100, vision: 100 });
  }
  const passer = input.teams[0].players.find(player => player.slot === 'LCM');
  const receiver = input.teams[0].players.find(player => player.slot === 'RCM');
  const defender = input.teams[1].players.find(player => player.slot === 'LCM');
  passer.position = { x: 0, y: 0 };
  receiver.position = { x: 20, y: 0 };
  defender.position = overrides.defender ?? { x: 10, y: 0 };
  input.ball = { position: { x: 0, y: 0 }, teamId: 'home', ownerId: passer.id };
  return { api, simulation: api.createSimulation(input), passerId: passer.id, receiverId: receiver.id, defenderId: defender.id };
}

function waitForEvent(fixture, type, maximum = 180) {
  for (let tick = 0; tick < maximum; tick++) {
    fixture.api.stepSimulation(fixture.simulation);
    const event = fixture.simulation.events.find(candidate => candidate.type === type);
    if (event) return event;
  }
  assert.fail(`missing ${type}`);
}

test('rolling balls decelerate in metres/second and stop without reversing', () => {
  const { api } = labFixture();
  const ball = { position: { x: 0, y: 0 }, velocity: { x: 10, y: 0 }, height: 0, verticalVelocity: 0 };
  const next = api.predictSimulationBall(ball, 1);
  const friction = api.MATCH_SIM_DATA.ball.rollingDeceleration;
  assert.ok(Math.abs(next.position.x - (10 - friction / 2)) < 1e-9);
  assert.ok(Math.abs(next.velocity.x - (10 - friction)) < 1e-9);
  const stopped = api.predictSimulationBall(ball, 100);
  assert.equal(stopped.velocity.x, 0);
  assert.ok(Math.abs(stopped.position.x - 100 / (2 * friction)) < 1e-9);
  assert.equal(ball.position.x, 0, 'prediction owns its result');
});

test('airborne flight is parabolic, is unreachable in the middle, and lands into rolling physics', () => {
  const { api } = labFixture();
  const ball = { position: { x: 0, y: 0 }, velocity: { x: 12, y: 0 }, height: 0, verticalVelocity: 8 };
  const gravity = api.MATCH_SIM_DATA.ball.gravity;
  const apex = api.predictSimulationBall(ball, 8 / gravity);
  assert.ok(Math.abs(apex.height - 64 / (2 * gravity)) < 1e-9);
  assert.ok(apex.height > api.MATCH_SIM_DATA.ball.reachableHeight);
  const landed = api.predictSimulationBall(ball, 16 / gravity + 1);
  assert.equal(landed.height, 0);
  assert.equal(landed.verticalVelocity, 0);
  assert.ok(landed.velocity.x < 12);
});

test('a defender physically on the ground passing lane intercepts before the receiver', () => {
  const fixture = scene();
  fixture.api.requestSimulationPass(fixture.simulation, { toId: fixture.receiverId });
  const interception = waitForEvent(fixture, 'interception');
  assert.equal(interception.toId, fixture.defenderId);
  assert.equal(interception.success, true);
  assert.ok(interception.toPos.x > 3 && interception.toPos.x < 16);
  const pass = fixture.simulation.events.find(event => event.type === 'pass');
  assert.equal(pass.success, false);
  assert.ok(interception.time > pass.time);
});

test('a defender who cannot reach the lane cannot intercept the same pass', () => {
  const fixture = scene({ defender: { x: 10, y: 25 } });
  fixture.api.requestSimulationPass(fixture.simulation, { toId: fixture.receiverId });
  const touch = waitForEvent(fixture, 'firstTouch');
  assert.equal(touch.toId, fixture.receiverId);
  assert.equal(touch.success, true);
  assert.equal(fixture.simulation.events.filter(event => event.type === 'interception').length, 0);
  assert.equal(fixture.simulation.events.find(event => event.type === 'pass').success, true);
});

test('a lob clears a stationary lane blocker while a low ball can be reached', () => {
  const fixture = scene();
  fixture.api.requestSimulationPass(fixture.simulation, { toId: fixture.receiverId, lofted: true });
  const touch = waitForEvent(fixture, 'firstTouch');
  assert.notEqual(touch.toId, fixture.defenderId, 'the central high section cannot be controlled');
  assert.equal(touch.toId, fixture.receiverId);
});

test('pass evaluation checks the route and rejects unreachable receivers', () => {
  const fixture = scene();
  const blocked = fixture.api.evaluateSimulationPass(fixture.simulation, { fromId: fixture.passerId, toId: fixture.receiverId });
  assert.equal(blocked.safe, false);
  assert.equal(blocked.interceptingId, fixture.defenderId);
  assert.ok(blocked.interceptionSeconds < blocked.ballSeconds);
  const unreachable = fixture.api.evaluateSimulationPass(fixture.simulation, {
    fromId: fixture.passerId, toId: fixture.receiverId, target: { x: 20, y: 25 },
  });
  assert.equal(unreachable.reachable, false);
  assert.equal(unreachable.safe, false);
});

test('a first-touch error deflects the real ball and leaves it free', () => {
  const fixture = scene({ defender: { x: 10, y: 25 } });
  const receiver = fixture.simulation.teams[0].players.find(player => player.id === fixture.receiverId);
  Object.assign(receiver.attributes, { firstTouch: 0, technique: 0 });
  fixture.api.placeSimulationBall(fixture.simulation, {
    position: { ...receiver.position }, teamId: 'home', velocity: { x: 35, y: 0 },
  });
  // A fixed seed is chosen from real failed controls, without replacing the seeded generator.
  let loose;
  for (let attempt = 0; attempt < 20 && !loose; attempt++) {
    fixture.api.placeSimulationBall(fixture.simulation, { position: { ...receiver.position }, teamId: 'home', velocity: { x: 35, y: 0 } });
    fixture.api.stepSimulation(fixture.simulation);
    loose = fixture.simulation.events.find(event => event.type === 'looseBall');
  }
  assert.ok(loose);
  assert.equal(fixture.simulation.ball.ownerId, null);
  assert.ok(Math.hypot(fixture.simulation.ball.velocity.x, fixture.simulation.ball.velocity.y) > 0);
});

test('an out-of-play ball gives the opponent a temporary restart at the actual crossing', () => {
  const fixture = scene();
  const before = plain(fixture.simulation.teams.map(team => team.players.map(player => player.position)));
  fixture.api.placeSimulationBall(fixture.simulation, { position: { x: 52, y: 3 }, teamId: 'home', velocity: { x: 20, y: 0 } });
  const out = waitForEvent(fixture, 'ballOut');
  assert.equal(out.temporaryRestart, true);
  assert.equal(out.restartTeamId, 'away');
  assert.equal(out.toPos.x, 52.5);
  assert.equal(fixture.simulation.ball.ownerId, null, 'restart taker must physically reach the line');
  assert.equal(fixture.simulation.ball.restart.teamId, 'away');
  for (const [index, team] of fixture.simulation.teams.entries()) for (const [slot, player] of team.players.entries()) {
    assert.ok(Math.hypot(player.position.x - before[index][slot].x, player.position.y - before[index][slot].y) <= player.limits.maxSpeed * 0.1 + 1e-9);
  }
});

module.exports = { scene, waitForEvent };

test('swept contacts include ground crossings and low launch/landing intervals, excluding high flight', () => {
  const { api } = labFixture();
  const player = { position: { x: 1, y: 0 } }, previous = { x: 1, y: 0 };
  const motion = (height, verticalVelocity) => {
    const before = { position: { x: 0, y: 0 }, velocity: { x: 20, y: 0 }, height, verticalVelocity };
    return { before, after: api.predictSimulationBall(before, 0.1) };
  };
  assert.equal(api.simulationContactFraction(player, previous, motion(0, 0)), 0);
  assert.equal(api.simulationContactFraction(player, previous, motion(0, 8)), 0);
  assert.equal(api.simulationContactFraction(player, previous, motion(3, 0)), null);
  const landing = api.simulationContactFraction(player, previous, motion(2, -8));
  assert.ok(landing > 0 && landing < 1);
});

test('equal-time contested contact favours the real defender over the intended receiver', () => {
  const fixture = scene();
  const players = fixture.simulation.teams.flatMap(team => team.players);
  for (const player of players) player.position = { x: -40, y: -30 };
  players.find(player => player.id === fixture.receiverId).position = { x: 10, y: 0 };
  players.find(player => player.id === fixture.defenderId).position = { x: 10, y: 0 };
  fixture.api.placeSimulationBall(fixture.simulation, { position: { x: 8, y: 0 }, teamId: 'home', velocity: { x: 20, y: 0 } });
  fixture.simulation.ball.flight = { teamId: 'home', toId: fixture.receiverId };
  fixture.api.captureSimulationPlayerPositions(fixture.simulation);
  const before = fixture.api.predictSimulationBall(fixture.simulation.ball, 0);
  const contact = fixture.api.earliestSimulationBallContact(fixture.simulation, { before, after: fixture.api.predictSimulationBall(before, 0.1) });
  assert.equal(contact.player.id, fixture.defenderId);
});

test('a ball crossing the line before a later reachable contact is out, never controlled outside', () => {
  const fixture = scene();
  const defender = fixture.simulation.teams[1].players.find(player => player.id === fixture.defenderId);
  defender.position = { x: 52.5, y: 2.8 };
  fixture.api.placeSimulationBall(fixture.simulation, { position: { x: 52, y: 0 }, teamId: 'home', velocity: { x: 20, y: 40 } });
  fixture.api.stepSimulation(fixture.simulation);
  assert.equal(fixture.simulation.events.filter(event => event.type === 'firstTouch').length, 0);
  assert.ok(fixture.simulation.events.some(event => event.type === 'ballOut'));
});

test('pass direction and speed errors depend on skill, with a seeded execution draw', () => {
  const perfect = scene({ defender: { x: 10, y: 25 } }), inaccurate = scene({ defender: { x: 10, y: 25 } });
  const execute = (fixture, passing) => {
    const owner = fixture.simulation.teams[0].players.find(player => player.id === fixture.passerId);
    owner.attributes.passing = passing;
    const option = fixture.api.evaluateSimulationPass(fixture.simulation, { toId: fixture.receiverId });
    fixture.api.releaseSimulationPass(fixture.simulation, owner, option);
    return plain(fixture.simulation.ball.velocity);
  };
  const exact = execute(perfect, 100), miss = execute(inaccurate, 0);
  assert.equal(exact.y, 0);
  assert.notDeepEqual(exact, miss);
  assert.deepEqual(miss, execute(scene({ defender: { x: 10, y: 25 } }), 0));
});
