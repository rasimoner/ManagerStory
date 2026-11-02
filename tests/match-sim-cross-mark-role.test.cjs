// A natural corner's close central marker must remain available during a high cross.
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadLab } = require('./support/lab.cjs');
const archive = require('./reproductions/remaining-cross-mark-checkpoint.json');

function cornerAtDecision(direction, side) {
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
  const team = simulation.teams.find(team => team.id === 'away');
  return { api, simulation, team, marker: team.players.find(player => player.id === 'away-RCB') };
}

for (const direction of [-1, 1]) for (const side of [-1, 1]) {
  test(`a high box cross keeps its close central marker: ${direction}/${side}`, () => {
    const { api, simulation, team, marker } = cornerAtDecision(direction, side);
    assert.equal(marker.laneTargetId, simulation.ball.flight.toId);
    assert.ok(simulation.ball.height > api.MATCH_SIM_DATA.ball.reachableHeight);
    api.advanceSimulationClock(simulation);
    api.updateSimPhase(simulation, team);
    api.updateOffBallDecisions(simulation, team);
    assert.equal(marker.role, 'mark');
    assert.equal(marker.laneTargetId, simulation.ball.flight.toId);
  });
}

for (const cross of [false, undefined]) test(`ordinary and old unflagged passes keep their cover contract: ${cross}`, () => {
  const { api, simulation, team, marker } = cornerAtDecision(1, 1);
  simulation.ball.flight.cross = cross;
  api.advanceSimulationClock(simulation);
  api.updateSimPhase(simulation, team);
  api.updateOffBallDecisions(simulation, team);
  assert.equal(marker.role, 'cover');
});

test('the natural central marker reaches a real aerial contact before the receiver', () => {
  const { api, simulation, marker } = cornerAtDecision(1, 1);
  const start = simulation.events.length;
  for (let tick = 0; tick < 30; tick++) api.stepSimulation(simulation);
  const contact = simulation.events.slice(start).find(event => event.type === 'aerialContact');
  assert.equal(contact?.fromId, marker.id);
  assert.equal(contact.kind, 'header');
  assert.ok(contact.height > 0 && contact.height <= api.MATCH_SIM_DATA.ball.reachableHeight);
  assert.deepEqual(contact.fromPos, contact.toPos, 'the incoming and outgoing flight share the actual contact point');
});
