/* Run with Node 22 and --experimental-vm-modules. Compilation and snapshots stay outside the timer. */
const { performance } = require('node:perf_hooks');
const { loadNativeLab } = require('../tests/support/lab.cjs');

function measureMatch(api, passing) {
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const driver = api.createLabBallDriver(901);
  const started = performance.now();
  for (let tick = 0; tick < 54000; tick++) {
    if (passing) api.stepSimulation(simulation);
    else api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
  }
  return { milliseconds: performance.now() - started, statistics: passing ? api.readSimulationStatistics(simulation) : undefined };
}

async function report() {
  const api = await loadNativeLab(['createSimulation', 'createLabScenario', 'createLabBallDriver', 'advanceLabBall', 'stepSimulation', 'readSimulationStatistics']);
  const offBall = Array.from({ length: 3 }, () => measureMatch(api, false));
  const passing = Array.from({ length: 3 }, () => measureMatch(api, true));
  console.log(JSON.stringify({ node: process.version, seed: 901, minutes: 90, steps: 54000,
    offBallMilliseconds: offBall.map(run => run.milliseconds), passingMilliseconds: passing.map(run => run.milliseconds), statistics: passing[0].statistics }, null, 2));
}

report().catch(error => { console.error(error); process.exitCode = 1; });
