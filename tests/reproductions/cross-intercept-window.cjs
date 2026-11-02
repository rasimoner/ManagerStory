// A saved delivery has a real playable boundary between two ordinary chase samples.
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadLab, plain } = require('../support/lab.cjs');
const archive = require('./intercept-window-checkpoint.json');

function crossingWindow(direction = 1, side = 1) {
  const { api } = loadLab();
  const simulation = api.restoreSimulation(JSON.parse(inflateSync(Buffer.from(archive.data, 'base64'))));
  const reflect = point => { point.x *= direction; point.y *= side; };
  for (const team of simulation.teams) {
    team.direction *= direction;
    for (const player of team.players) {
      reflect(player.position); reflect(player.velocity); reflect(player.target);
      player.heading = Math.atan2(Math.sin(player.heading) * side, Math.cos(player.heading) * direction);
    }
  }
  reflect(simulation.ball.position); reflect(simulation.ball.velocity);
  reflect(simulation.ball.flight.fromPos); reflect(simulation.ball.flight.target);
  const player = simulation.teams.flatMap(team => team.players).find(player => player.id === 'home-RB');
  return { api, simulation, player };
}

for (const direction of [-1, 1]) for (const side of [-1, 1]) {
  test(`a playable descending contact between chase samples is not discarded: ${direction}/${side}`, () => {
    const { api, simulation, player } = crossingWindow(direction, side), ball = simulation.ball;
    // Use the existing landing equation with the playable plane as its height datum.
    const seconds = api.simulationBallLandingSeconds({ ...ball, height: ball.height - api.MATCH_SIM_DATA.ball.reachableHeight });
    const contact = api.predictSimulationBall(ball, seconds);
    const arrival = api.simulationPlayerArrival(player, contact.position) - player.limits.reactionSeconds;
    assert.ok(arrival <= seconds);
    assert.ok(Math.abs(contact.height - api.MATCH_SIM_DATA.ball.reachableHeight) < 1e-9);
    const before = plain(api.snapshotSimulation(simulation));
    const plan = api.simulationInterceptPlan(player, ball);
    assert.equal(plan.reachable, true, `a real ${seconds}s window became ${JSON.stringify(plan)}`);
    assert.ok(Math.hypot(plan.target.x - contact.position.x, plan.target.y - contact.position.y) < api.MATCH_SIM_DATA.ball.controlRadius);
    assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  });
}

for (const cross of [false, undefined]) test(`ordinary and old unflagged passes keep the same chase fallback: ${cross}`, () => {
  const { api, simulation, player } = crossingWindow();
  simulation.ball.flight.cross = cross;
  const plan = api.simulationInterceptPlan(player, simulation.ball);
  assert.equal(plan.reachable, false);
  assert.equal(plan.target.y, api.MATCH_SIM_DATA.pitch.width / 2);
});

test('the new contact window does not make a distant goalkeeper able to intercept', () => {
  const { api, simulation } = crossingWindow();
  const keeper = simulation.teams.find(team => team.id === 'home').players.find(player => player.slot === 'GK');
  assert.equal(api.simulationInterceptPlan(keeper, simulation.ball).reachable, false);
});

test('saving before the narrow contact window preserves physical continuation and RNG', () => {
  const { api, simulation } = crossingWindow();
  const resumed = api.restoreSimulation(plain(api.snapshotSimulation(simulation)));
  for (let tick = 0; tick < 35; tick++) {
    api.stepSimulation(simulation);
    api.stepSimulation(resumed);
  }
  assert.deepEqual(plain(api.snapshotSimulation(resumed)), plain(api.snapshotSimulation(simulation)));
});
