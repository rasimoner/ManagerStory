const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { labFixture, loadNativeLab } = require('./support/lab.cjs');

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
  const api = await loadNativeLab(['createSimulation', 'createLabScenario', 'createLabBallDriver', 'advanceLabBall', 'stepSimulation']);
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const driver = api.createLabBallDriver(901);
  const started = performance.now();
  for (let tick = 0; tick < 54000; tick++) api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
  const elapsed = performance.now() - started;
  t.diagnostic(`Node ${process.version}: native off-ball 90 minutes ${elapsed.toFixed(1)} ms`);
  assert.equal(simulation.time, 5400);
  assert.ok(elapsed < 3000, `native off-ball exceeded 3 s CI budget: ${elapsed.toFixed(1)} ms`);
});

test('the native headless passing engine stays within its 4.5 s CI budget', async t => {
  const api = await loadNativeLab(['createSimulation', 'createLabScenario', 'stepSimulation', 'readSimulationStatistics']);
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const started = performance.now();
  for (let tick = 0; tick < 54000; tick++) api.stepSimulation(simulation);
  const elapsed = performance.now() - started;
  const stats = api.readSimulationStatistics(simulation);
  t.diagnostic(`Node ${process.version}: native passing 90 minutes ${elapsed.toFixed(1)} ms; ${JSON.stringify(stats)}`);
  assert.equal(simulation.time, 5400);
  assert.ok(stats.passes > 0 && stats.interceptions > 0);
  assert.ok(elapsed < 4500, `native passing exceeded 4.5 s CI budget: ${elapsed.toFixed(1)} ms`);
});
