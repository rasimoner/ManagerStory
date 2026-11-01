// A proposed acceptance for an unmodified natural corner, outside the default CI suite.
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadNativeLab } = require('../support/lab.cjs');
const archive = require('./remaining-keeper-cross-checkpoint.json');
const data = require('../../src/data/match-sim.json');
let api;

test.before(async () => {
  api = await loadNativeLab(['restoreSimulation', 'advanceSimulationClock', 'updateSimPhase', 'updateOffBallDecisions',
    'updateSimulationBallChasers', 'prepareSimulationKeepers', 'predictSimulationBall', 'simulationPlayerArrival']);
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

test('a keeper without any playable cross interception must retain its goal-positioning job', () => {
  const fixture = naturalKeeperDecision();
  assert.equal(fixture.keeper.role, 'keeper');
  assert.ok(fixture.simulation.ball.flight.cross);
  assert.equal(canInterceptInsidePitch(fixture.simulation, fixture.keeper), false);
  finishKeeperDecision(fixture);
  assert.equal(fixture.keeper.role, 'keeper', `unreachable cross assigned ${fixture.keeper.role}: ${JSON.stringify(fixture.keeper.target)}`);
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
