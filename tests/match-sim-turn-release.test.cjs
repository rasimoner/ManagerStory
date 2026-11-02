const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');

function turningCarrier(direction, durationSeconds) {
  const { api, input } = labFixture({ seed: 9 });
  input.match = false;
  input.durationSeconds = durationSeconds;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), owner = simulation.teams[0].players.at(-1);
  for (const player of simulation.teams[1].players) player.position = { x: -35 * direction, y: 25 };
  owner.position = { x: 36 * direction, y: -27 }; owner.velocity = { x: 0, y: 0 };
  owner.heading = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
  api.placeSimulationBall(simulation, { teamId: 'home', ownerId: owner.id, position: owner.position });
  api.forceSimulationDribble(simulation, owner.id);
  return { api, simulation, owner };
}

function assertAlignedTouch(fixture) {
  const { simulation, owner } = fixture, target = simulation.ownerDecision.dribble.target;
  const angle = Math.atan2(target.y - owner.position.y, target.x - owner.position.x) - owner.heading;
  assert.ok(Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) <= fixture.api.MATCH_SIM_DATA.passing.angleTolerance,
    'a deliberate carry touch waits for the body to face its chosen lane');
}

for (const direction of [-1, 1]) for (const duration of [180, 300, 420, 600]) {
  test(`turning carrier aligns before touching and escapes in direction ${direction}, ${duration}s`, () => {
    const fixture = turningCarrier(direction, duration), { api, simulation, owner } = fixture;
    const start = { ...owner.position };
    let touches = 0;
    for (let tick = 0; tick < 65; tick++) {
      const before = simulation.ball.carry?.touchTick;
      api.stepSimulation(simulation);
      if (simulation.ball.carry?.touchTick != null && simulation.ball.carry.touchTick !== before) { assertAlignedTouch(fixture); touches++; }
    }
    assert.ok(touches > 0);
    assert.ok(Math.hypot(owner.position.x - start.x, owner.position.y - start.y) > 4);
  });
}

test('saving while turning keeps the same decisions, physical touches and RNG', () => {
  const fixture = turningCarrier(1, 420), { api, simulation } = fixture;
  api.stepSimulation(simulation);
  const restored = api.restoreSimulation(api.snapshotSimulation(simulation));
  for (let tick = 0; tick < 65; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});


test('a brief unsuccessful carry does not renew stationary shielding support', () => {
  const {api, simulation, owner} = turningCarrier(1, 420);
  simulation.tick = 100;
  simulation.ball.ownerSinceTick = 50;
  simulation.ownerDecision = {selected:'shield', forcedPlayerId:null, shieldSinceTick:60};
  const protectedOption = api.evaluateSimulationOwnerOptions(simulation, owner);
  simulation.ownerDecision.selected = 'dribble';
  const repeatedOption = api.evaluateSimulationOwnerOptions(simulation, owner);
  assert.equal(repeatedOption.shield.score, protectedOption.shield.score,
    'a direction flip with no physical progress cannot reset support waiting');
});
