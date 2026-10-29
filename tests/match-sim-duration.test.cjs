const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab, plain } = require('./support/lab.cjs');

function fixture(durationSeconds) {
  const { api } = loadLab();
  const input = api.createLabScenario({ seed: 731 });
  return { api, simulation: api.createSimulation({ ...input, durationSeconds }) };
}

for (const seconds of [180, 300, 420, 600]) {
  test(`${seconds}s duration derives exact 45:00 and 90:00 from physical ticks`, () => {
    const { api, simulation } = fixture(seconds);
    for (let tick = 0; tick < seconds * 5; tick++) api.stepSimulation(simulation);
    assert.equal(simulation.physicsTime, seconds / 2);
    assert.equal(simulation.matchTime, 2700);
    assert.equal(simulation.match.half, 2);
    assert.equal(simulation.events.find(event => event.type === 'half').matchTime, 2700);
    for (let tick = seconds * 5; tick < seconds * 10; tick++) api.stepSimulation(simulation);
    assert.equal(simulation.physicsTime, seconds);
    assert.equal(simulation.matchTime, 5400);
    assert.equal(simulation.match.phase, 'ended');
    assert.equal(simulation.tick, seconds * 10);
  });
}

test('the generic core duration rejects invalid values and retains the 90-physical-minute default', () => {
  const { api } = loadLab();
  const input = api.createLabScenario();
  for (const durationSeconds of [null, 0, -1, NaN, Infinity, '420', .1, 1.01, 1e-12]) {
    assert.throws(() => api.createSimulation({ ...input, durationSeconds }), /duration/i);
  }
  const reference = api.createSimulation(input);
  assert.equal(reference.clock.model, 'reference');
  assert.equal(reference.clock.durationSeconds, 5400);
  assert.equal(api.createSimulation({ ...input, durationSeconds: 12 }).clock.durationSeconds, 12);
});

test('changing duration leaves the first physical movements, decisions and ball flights identical', () => {
  const short = fixture(180), long = fixture(600);
  for (let tick = 0; tick < 200; tick++) {
    short.api.stepSimulation(short.simulation);
    long.api.stepSimulation(long.simulation);
    const positions = simulation => plain({ ball: simulation.ball, teams: simulation.teams });
    assert.deepEqual(positions(short.simulation), positions(long.simulation));
  }
});

test('workload uses match exposure once, stores real distance and leaves contact cost unscaled', () => {
  const short = fixture(180), long = fixture(600);
  for (const { api, simulation } of [short, long]) {
    simulation.workload.enabled = true;
    const player = simulation.teams[0].players.at(-1);
    player.velocity = { x: 7, y: 0 };
    player.gait = 'sprint';
    api.consumeSimulationFitness(simulation);
    assert.ok(Math.abs(player.workload.distanceMetres - .7) < 1e-9);
    assert.ok(Math.abs(player.workload.playedSeconds - .1) < 1e-9);
  }
  const loss = simulation => 100 - simulation.teams[0].players.at(-1).attributes.fitness;
  assert.ok(Math.abs(loss(short.simulation) / loss(long.simulation) - 600 / 180) < 1e-7);
  for (const { api, simulation } of [short, long]) {
    const player = simulation.teams[0].players.at(-1), before = player.attributes.fitness;
    const ordinary = 100 - before;
    api.emitSimulationEvent(simulation, { type: 'duel', fromId: player.id });
    api.consumeSimulationFitness(simulation);
    assert.ok(Math.abs(before - player.attributes.fitness - ordinary - api.MATCH_SIM_DATA.workload.perContact) < 1e-9);
  }
});
