// A real central delivery must not pull the keeper toward the departing touchline shadow.
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadLab, plain } = require('../support/lab.cjs');
const archive = require('./cross-threat-window-checkpoint.json');

function incomingCross(direction = 1, side = 1) {
  const { api } = loadLab();
  const simulation = api.restoreSimulation(JSON.parse(inflateSync(Buffer.from(archive.data, 'base64'))));
  api.advanceSimulationClock(simulation);
  for (const team of simulation.teams) { api.updateSimPhase(simulation, team); api.updateOffBallDecisions(simulation, team); }
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
  const team = simulation.teams.find(team => team.id === 'away');
  return { api, simulation, team, keeper: team.players.find(player => player.slot === 'GK') };
}

for (const direction of [-1, 1]) for (const side of [-1, 1]) {
  test(`a central incoming cross permits central keeper preparation: ${direction}/${side}`, () => {
    const { api, simulation, keeper } = incomingCross(direction, side);
    const ball = plain(simulation.ball), rng = simulation.rngState;
    api.prepareSimulationKeepers(simulation);
    assert.equal(keeper.role, 'keeper');
    assert.ok(Math.abs(keeper.target.y) < api.MATCH_SIM_DATA.goalkeeper.bodyReach,
      `the real central delivery pulled its keeper to y=${keeper.target.y}`);
    assert.deepEqual(plain(simulation.ball), ball);
    assert.equal(simulation.rngState, rng);
  });
}

test('the playable side takes priority over a later ground landing on the opposite side', () => {
  const { api, simulation, team } = incomingCross();
  Object.assign(simulation.ball, { position: { x: 42, y: -10.8 }, velocity: { x: 0, y: 12 }, height: 6, verticalVelocity: -1 });
  const landing = api.predictSimulationBall(simulation.ball, api.simulationBallLandingSeconds(simulation.ball));
  assert.ok(landing.position.y > 0, 'this isolated counterexample has an opposite-side ground landing');
  assert.ok(api.simulationKeeperTarget(simulation, team).y < 0, 'the still playable incoming contact is on the left');
});

for (const cross of [false, undefined]) test(`ordinary and old unflagged lobs still track the live ball: ${cross}`, () => {
  const { api, simulation, team } = incomingCross();
  simulation.ball.flight.cross = cross;
  assert.equal(Math.abs(api.simulationKeeperTarget(simulation, team).y), api.MATCH_SIM_DATA.goalkeeper.bisectorSideLimit);
});
