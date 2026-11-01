// Keeper decisions use the same natural cross and preserve real reachable interceptions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadNativeLab } = require('./support/lab.cjs');
const archive = require('./reproductions/remaining-keeper-cross-checkpoint.json');
const data = require('../src/data/match-sim.json');
let api;

test.before(async () => {
  api = await loadNativeLab(['restoreSimulation', 'advanceSimulationClock', 'updateSimPhase', 'updateOffBallDecisions',
    'updateSimulationBallChasers', 'prepareSimulationKeepers', 'predictSimulationBall', 'simulationPlayerArrival', 'stepSimulation', 'snapshotSimulation']);
});

function naturalKeeperDecision() {
  const simulation = api.restoreSimulation(JSON.parse(inflateSync(Buffer.from(archive.data, 'base64'))));
  api.advanceSimulationClock(simulation);
  for (const team of simulation.teams) {
    api.updateSimPhase(simulation, team);
    api.updateOffBallDecisions(simulation, team);
  }
  const keeper = simulation.teams.find(team => team.id === 'away').players.find(player => player.slot === 'GK');
  return { simulation, keeper };
}

function canInterceptInsidePitch(simulation, keeper) {
  const increment = data.clock.stepSeconds / 10;
  for (let index = 0; index * increment <= data.passing.chaseHorizonSeconds; index++) {
    const seconds = index * increment, ball = api.predictSimulationBall(simulation.ball, seconds);
    if (Math.abs(ball.position.x) > data.pitch.length / 2 || Math.abs(ball.position.y) > data.pitch.width / 2) continue;
    if (ball.height > data.ball.reachableHeight) continue;
    if (api.simulationPlayerArrival(keeper, ball.position) - keeper.limits.reactionSeconds <= seconds) return true;
  }
  return false;
}

function finishKeeperDecision({ simulation }) {
  api.updateSimulationBallChasers(simulation);
  api.prepareSimulationKeepers(simulation);
}

function reflectFixture({ simulation }, direction, side) {
  const reflect = point => { point.x *= direction; point.y *= side; };
  for (const team of simulation.teams) {
    team.direction *= direction;
    for (const player of team.players) {
      reflect(player.position); reflect(player.velocity); reflect(player.target);
      player.heading = Math.atan2(Math.sin(player.heading) * side, Math.cos(player.heading) * direction);
    }
  }
  reflect(simulation.ball.position); reflect(simulation.ball.velocity);
  reflect(simulation.ball.flight.target); reflect(simulation.ball.flight.fromPos);
}

for (const direction of [-1, 1]) for (const side of [-1, 1]) {
  test(`an unreachable cross preserves keeper positioning: ${direction}/${side}`, () => {
    const fixture = naturalKeeperDecision();
    reflectFixture(fixture, direction, side);
    assert.equal(fixture.keeper.role, 'keeper');
    assert.ok(fixture.simulation.ball.flight.cross);
    assert.equal(canInterceptInsidePitch(fixture.simulation, fixture.keeper), false);
    finishKeeperDecision(fixture);
    assert.equal(fixture.keeper.role, 'keeper', `unreachable cross assigned ${fixture.keeper.role}: ${JSON.stringify(fixture.keeper.target)}`);
  });
}

test('an old unreachable interception is cancelled even when no chaser is reassigned', () => {
  const fixture = naturalKeeperDecision();
  fixture.keeper.role = 'intercept';
  fixture.keeper.target = { x: 25, y: 34 };
  api.prepareSimulationKeepers(fixture.simulation);
  assert.equal(fixture.keeper.role, 'keeper');
  assert.notEqual(fixture.keeper.keeper.mode, 'rush');
});

test('a cross continues identically after saving with an invalid keeper interception', () => {
  const { simulation } = naturalKeeperDecision();
  const restored = api.restoreSimulation(api.snapshotSimulation(simulation));
  for (let tick = 0; tick < 40; tick++) {
    api.stepSimulation(simulation);
    api.stepSimulation(restored);
  }
  assert.deepEqual(api.snapshotSimulation(restored), api.snapshotSimulation(simulation));
});

for (const cross of [true, false]) test(`a reachable ${cross ? 'cross' : 'loose ground ball'} still permits the keeper to chase`, () => {
  const fixture = naturalKeeperDecision(), { simulation, keeper } = fixture;
  // Counterexamples alter the ball explicitly; the red natural case above has no overrides.
  Object.assign(simulation.ball, { position: { x: keeper.position.x - 2, y: keeper.position.y }, velocity: { x: 0, y: 0 },
    height: cross ? data.ball.reachableHeight / 2 : 0, verticalVelocity: 0, flight: cross ? simulation.ball.flight : null });
  assert.equal(canInterceptInsidePitch(simulation, keeper), true);
  finishKeeperDecision(fixture);
  assert.equal(keeper.role, cross ? 'intercept' : 'recover');
  assert.equal(keeper.keeper.mode, 'rush');
});
