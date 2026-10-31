const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { labFixture, loadNativeLab } = require('./support/lab.cjs');

let measuredLab;
function loadMeasuredLab() {
  // The application and report reuse one loaded module; separate tree-shaken imports would benchmark cold JIT variants.
  measuredLab ??= loadNativeLab(['createSimulation', 'createLabScenario', 'createLabBallDriver', 'advanceLabBall', 'stepSimulation', 'readSimulationStatistics', 'resumeSimulation']);
  return measuredLab;
}


test('off-ball optimisation preserves every baseline position over 90 minutes', t => {
  const { api, simulation } = labFixture({ seed: 901 });
  const driver = api.createLabBallDriver(901);
  const positions = Buffer.alloc(54000 * 22 * 2 * 8);
  let offset = 0;
  const started = performance.now();
  for (let tick = 0; tick < 54000; tick++) {
    api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
    for (const team of simulation.teams) for (const player of team.players) {
      positions.writeDoubleLE(player.position.x, offset); offset += 8;
      positions.writeDoubleLE(player.position.y, offset); offset += 8;
    }
  }
  const elapsed = performance.now() - started;
  t.diagnostic(`Node ${process.version}: off-ball 90 minutes ${elapsed.toFixed(1)} ms (including trajectory hashing)`);
  assert.equal(createHash('sha256').update(positions).digest('hex'), '9b1126b840f9ad5ec641b19abbdc01fd4f66afd11acba238e6207aee31d16754');
});

test('the native headless off-ball engine stays within its 3 s CI budget', async t => {
  const api = await loadMeasuredLab();
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const driver = api.createLabBallDriver(901);
  const started = performance.now();
  for (let tick = 0; tick < 54000; tick++) api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
  const elapsed = performance.now() - started;
  t.diagnostic(`Node ${process.version}: native off-ball 90 minutes ${elapsed.toFixed(1)} ms`);
  assert.equal(simulation.time, 5400);
  assert.ok(elapsed < 3000, `native off-ball exceeded 3 s CI budget: ${elapsed.toFixed(1)} ms`);
});

test('each of three complete native shooting/keeper matches stays within the 2 s budget', async t => {
  const api = await loadMeasuredLab();
  const runs = Array.from({ length: 3 }, () => measureCompleteShootingMatch(api));
  const milliseconds = runs.map(run => run.milliseconds);
  const median = [...milliseconds].sort((left, right) => left - right)[1];
  t.diagnostic(`Node ${process.version}: native shooting/keepers 90 minutes median ${median.toFixed(1)} ms; runs ${milliseconds.map(value => value.toFixed(1)).join(', ')} ms; ${JSON.stringify(runs[0].statistics)}`);
  assert.ok(milliseconds.every(value => value < 2000), `native shooting and keepers exceeded 2 s budget: ${milliseconds.map(value => value.toFixed(1)).join(", ")} ms`);
});

test('three complete matches with career fitness and injury processing each remain below 2 s', async t => {
  const api = await loadMeasuredLab();
  const times = [];
  for (const seed of [901, 731, 16]) {
    const simulation = api.createSimulation({ ...api.createLabScenario({ seed }), workload: true });
    const started = performance.now();
    while (simulation.match.phase !== 'ended') {
      if (simulation.paused) api.resumeSimulation(simulation);
      api.stepSimulation(simulation);
    }
    times.push(performance.now() - started);
    assert.equal(simulation.tick - simulation.clock.stoppedTicks, 54000);
  }
  t.diagnostic(`Node ${process.version}: workload/injuries 90 minutes ${times.map(time => time.toFixed(1)).join(', ')} ms`);
  assert.ok(times.every(time => time < 2000), `career processing exceeded 2 s: ${times.join(', ')}`);
});

function measureCompleteShootingMatch(api) {
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const started = performance.now();
  while (simulation.match.phase !== 'ended') api.stepSimulation(simulation);
  const milliseconds = performance.now() - started;
  const statistics = api.readSimulationStatistics(simulation);
  assert.equal(simulation.tick - simulation.clock.stoppedTicks, 54000);
  // Football ranges are reported across five seeds; this test guards completed physical work and wall time.
  assert.equal(simulation.match.phase, 'ended');
  assert.ok(statistics.shots > 0 && statistics.shotsOnTarget > 0 && statistics.saves > 0 && statistics.goals > 0);
  assert.ok(statistics.passes > 0 && statistics.interceptions > 0 && statistics.dribbles > 0 && statistics.tackles > 0);
  return { milliseconds, statistics };
}

test('all active and halftime steps, ball flights, events and scores repeat with the same seed and input', async () => {
  const api = await loadMeasuredLab();
  const first = completeShootingDigest(api), second = completeShootingDigest(api);
  assert.deepEqual(first, second);
});

function completeShootingDigest(api) {
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const hash = createHash('sha256'), positions = Buffer.alloc((22 * 2 + 6) * 8);
  while (simulation.match.phase !== 'ended') {
    api.stepSimulation(simulation);
    let offset = 0;
    for (const team of simulation.teams) for (const player of team.players) {
      positions.writeDoubleLE(player.position.x, offset); offset += 8;
      positions.writeDoubleLE(player.position.y, offset); offset += 8;
    }
    for (const value of [simulation.ball.position.x, simulation.ball.position.y, simulation.ball.height,
      simulation.ball.velocity.x, simulation.ball.velocity.y, simulation.ball.verticalVelocity]) {
      positions.writeDoubleLE(value, offset); offset += 8;
    }
    hash.update(positions);
  }
  assertFullMatchContactLog(simulation.events);
  assertFullMatchScoringLog(simulation);
  return { score: simulation.match.score, ball: simulation.ball, positions: hash.digest('hex'), events: createHash('sha256').update(JSON.stringify(simulation.events)).digest('hex') };
}

function assertFullMatchContactLog(events) {
  for (let index = 0; index < events.length; index++) {
    const foul = events[index];
    if (foul.type !== 'foul') continue;
    const contact = events[index - 1];
    assert.ok(['tackle', 'duel'].includes(contact?.type));
    assert.equal(contact.fromId, foul.fromId);
    assert.equal(contact.toId, foul.toId);
    assert.equal(contact.time, foul.time);
  }
}

function assertFullMatchScoringLog(simulation) {
  const goals = simulation.events.filter(event => event.type === 'goal');
  assert.equal(goals.length, Object.values(simulation.match.score).reduce((sum, value) => sum + value, 0));
  let previousTime = 0;
  simulation.events.forEach((event, index) => {
    assert.ok(event.time + 1e-8 >= previousTime, `${event.type}: chronological event log`);
    previousTime = event.time;
    if (event.type !== 'goal') return;
    assert.ok(event.shotId < index);
    const shot = simulation.events[event.shotId];
    assert.equal(shot.type, 'shot');
    assert.equal(shot.fromId, event.fromId);
    assert.ok(shot.time <= event.time);
  });
  assert.equal(simulation.events.filter(event => event.type === 'half').length, 1);
  assert.equal(simulation.events.filter(event => event.type === 'end').length, 1);
}
