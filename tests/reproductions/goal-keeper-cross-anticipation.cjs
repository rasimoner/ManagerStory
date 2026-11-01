const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('../support/lab.cjs');

function incomingCross(direction, side) {
  const { api, input } = labFixture({ seed: 901 });
  input.match = false;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), team = simulation.teams[1];
  const flight = api.simulationPassFlight({ x: 52 * direction, y: side * 33.5 }, { x: 41.5 * direction, y: 0 },
    { lofted: true, arrivalHeight: 1.6 });
  Object.assign(simulation.ball, flight, { ownerId: null, carry: null, flight: { cross: true } });
  return { api, simulation, team };
}

for (const direction of [-1, 1]) for (const side of [-1, 1]) {
  test(`keeper prepares the central landing area before a cross arrives: ${direction}/${side}`, () => {
    const { api, simulation, team } = incomingCross(direction, side);
    const before = JSON.stringify(api.snapshotSimulation(simulation));
    const target = api.simulationKeeperTarget(simulation, team);
    assert.ok(Math.abs(target.y) < 1.5, `cover the receiving area, not the distant delivery side: ${JSON.stringify(target)}`);
    assert.ok(target.x * direction > 45, 'anticipation remains on the goalkeeper side of the box');
    assert.equal(JSON.stringify(api.snapshotSimulation(simulation)), before, 'forecasting changes neither football nor RNG');
    Object.assign(simulation.ball, api.predictSimulationBall(simulation.ball, 1));
    const later = api.simulationKeeperTarget(simulation, team);
    assert.ok(Math.hypot(later.x - target.x, later.y - target.y) < 1e-8, 'the same uninterrupted flight keeps the same forecast');
  });
}

test('normal passes and shots retain current-ball goalkeeper positioning', () => {
  const { api, simulation, team } = incomingCross(1, 1);
  simulation.ball.flight.cross = false;
  const pass = plain(api.simulationKeeperTarget(simulation, team));
  simulation.ball.flight = null;
  assert.deepEqual(plain(api.simulationKeeperTarget(simulation, team)), pass);
  assert.ok(pass.y > 3, 'ordinary positioning still reads the actual current ball');
});
