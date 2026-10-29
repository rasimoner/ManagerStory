const test = require('node:test');
const assert = require('node:assert/strict');
const { loadNativeGame } = require('./support/native.cjs');
let pending;
const native = () => pending ??= loadNativeGame(['createSimulation', 'createSimulationPlayback', 'advanceSimulationPlayback', 'commandSimulationTactics', 'snapshotSimulation']);
const { loadLab } = require('./support/lab.cjs');

async function watch(options) {
  const api = await native();
  const input = structuredClone(loadLab().api.createLabScenario({ seed: 42 }));
  const simulation = api.createSimulation({ ...input, durationSeconds: options.seconds });
  const playback = api.createSimulationPlayback(simulation);
  let elapsed = 0, applied = false;
  while (simulation.match.phase !== 'ended') {
    if (simulation.tick === 100 && !applied) {
      api.commandSimulationTactics(simulation, { teamId: 'home', tactics: { press: 'Yüksek' } });
      applied = true;
    }
    api.advanceSimulationPlayback(playback, simulation, { seconds: 1 / options.fps, speed: options.speed, maxSteps: 512 });
    elapsed += 1 / options.fps;
    assert.equal(playback.currentRate, options.speed);
  }
  return { elapsed, simulation, playback };
}

for (const seconds of [180, 300, 420, 600]) {
  test(`automatic clock: ${seconds}s at 1x with no danger-dependent playback rate`, async () => {
    const result = await watch({ seconds, fps: 60, speed: 1 });
    assert.ok(Math.abs(result.elapsed - seconds) < .05);
    assert.equal(result.simulation.tick, seconds * 10);
    assert.equal(result.simulation.matchTime, 5400);
    assert.equal(result.playback.metrics.budgetLimitedFrames, 0);
  });
}

test('manual half/double rates affect wall time uniformly and keep the same football at different drawing cadences', async () => {
  const normal = await watch({ seconds: 180, fps: 60, speed: 1 });
  const slow = await watch({ seconds: 180, fps: 60, speed: .5 });
  const fast = await watch({ seconds: 180, fps: 30, speed: 2 });
  assert.ok(Math.abs(slow.elapsed - 360) < .1);
  assert.ok(Math.abs(fast.elapsed - 90) < .1);
  for (const result of [slow, fast]) {
    assert.deepEqual(result.simulation.events, normal.simulation.events);
    assert.equal(result.simulation.rngState, normal.simulation.rngState);
    assert.deepEqual(result.simulation.teams, normal.simulation.teams);
  }
});

test('exhausting a rendering budget stretches viewing without skipping any physical step', async () => {
  const api = await native(), input = loadLab().api.createLabScenario();
  const simulation = api.createSimulation({ ...input, durationSeconds: 180 });
  const playback = api.createSimulationPlayback(simulation);
  api.advanceSimulationPlayback(playback, simulation, { seconds: 10, speed: 1, maxSteps: 2 });
  assert.equal(simulation.tick, 2);
  assert.equal(playback.metrics.budgetLimitedFrames, 1);
  assert.equal(simulation.physicsTime, .2);
});
