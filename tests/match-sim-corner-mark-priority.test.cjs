// The saved natural corner must mark central threats without changing the simulation.
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadLab, plain } = require('./support/lab.cjs');
const archive = require('./reproductions/corner-before-delivery.json');

function releasedCorner(direction, side) {
  const { api } = loadLab();
  const simulation = api.restoreSimulation(JSON.parse(inflateSync(Buffer.from(archive.data, 'base64')).toString()));
  while (simulation.ball.restart) api.stepSimulation(simulation);
  for (const team of simulation.teams) {
    team.direction *= direction;
    for (const player of team.players) { player.position.x *= direction; player.position.y *= -side; }
  }
  simulation.ball.position.x *= direction; simulation.ball.position.y *= -side;
  return { api, simulation };
}

function boxMarks(api, simulation) {
  const team = simulation.teams.find(team => team.id !== simulation.ball.teamId), marks = [];
  const context = { simulation, team, available: team.players.filter(player => player.slot !== 'GK' && !player.sentOff) };
  api.planSimulationBoxDefence(context, (scope, defender, instruction) => {
    if (!defender) return;
    if (instruction.role === 'mark') marks.push(instruction.laneTargetId);
    scope.available = scope.available.filter(player => player.id !== defender.id);
  });
  return marks;
}

for (const direction of [-1, 1]) for (const side of [-1, 1]) {
  test(`central receiver takes priority over the distant corner taker: ${direction}/${side}`, () => {
    const { api, simulation } = releasedCorner(direction, side);
    const before = plain(api.snapshotSimulation(simulation));
    const marks = boxMarks(api, simulation);
    assert.ok(marks.includes('home-ST'), `central receiver omitted: ${marks.join(', ')}`);
    assert.ok(!marks.includes('home-LW'), 'the distant touchline taker must not consume a central marking slot');
    assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  });
}

test('non-cross marking retains its existing compatibility contract', () => {
  const { api, simulation } = releasedCorner(1, -1);
  simulation.ball.flight.cross = false;
  assert.deepEqual(boxMarks(api, simulation), ['home-LW', 'home-LCM']);
});

test('a saved cross resumes with the same marking, decisions and outcome', () => {
  const { api, simulation } = releasedCorner(1, -1);
  for (let tick = 0; tick < 10; tick++) api.stepSimulation(simulation);
  assert.ok(simulation.ball.flight?.cross);
  const resumed = api.restoreSimulation(plain(api.snapshotSimulation(simulation)));
  for (let tick = 0; tick < 80; tick++) {
    api.stepSimulation(simulation);
    api.stepSimulation(resumed);
  }
  assert.deepEqual(plain(api.snapshotSimulation(resumed)), plain(api.snapshotSimulation(simulation)));
});
