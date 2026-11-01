const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture } = require('../support/lab.cjs');

function crossingRace(cross = true) {
  const { api, simulation } = labFixture({ seed: 901 });
  const player = simulation.teams[1].players.find(player => player.slot === 'LCB');
  player.position = { x: 43, y: 0 }; player.velocity = { x: 0, y: 0 }; player.heading = 1.3;
  const ball = { position: { x: 42, y: 3 }, velocity: { x: -5, y: -15 }, height: 1.8, verticalVelocity: -3,
    flight: { cross } };
  return { api, player, ball };
}

test('an unreachable cross keeps the defender near the closest playable approach', () => {
  const { api, player, ball } = crossingRace();
  const before = JSON.stringify({ player, ball });
  const target = api.simulationInterceptTarget(player, ball);
  assert.ok(target.x > 38 && Math.abs(target.y) < 5,
    `defend the arriving receiver instead of abandoning the area for ${JSON.stringify(target)}`);
  assert.equal(JSON.stringify({ player, ball }), before, 'the prediction writes no football state');
});

test('a reachable cross still selects the physically reachable interception', () => {
  const { api, player, ball } = crossingRace();
  player.position = { ...ball.position };
  const target = api.simulationInterceptTarget(player, ball);
  assert.deepEqual(JSON.parse(JSON.stringify(target)), ball.position);
});

test('ordinary non-cross chasing retains the established full-horizon prediction', () => {
  const { api, player, ball } = crossingRace(false);
  const target = api.simulationInterceptTarget(player, ball);
  assert.ok(target.x < 30 && target.y <= -30, 'normal loose-ball pursuit is unchanged');
});
