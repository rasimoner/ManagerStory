/* Run with Node 22 and --experimental-vm-modules. Compilation and snapshots stay outside the timer. */
const { performance } = require('node:perf_hooks');
const { loadNativeLab } = require('../tests/support/lab.cjs');

function measureMatch(api, seed, withBall = true) {
  const simulation = api.createSimulation(api.createLabScenario({ seed }));
  const driver = api.createLabBallDriver(seed);
  const started = performance.now();
  for (let tick = 0; tick < 54000; tick++) {
    if (withBall) api.stepSimulation(simulation);
    else api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
  }
  const milliseconds = performance.now() - started;
  if (!withBall) return { milliseconds };
  const statistics = api.readSimulationStatistics(simulation);
  return { seed, milliseconds, score: simulation.match.score, statistics,
    xgPerShot: statistics.shots ? statistics.xg / statistics.shots : 0,
    savePercent: statistics.shotsOnTarget ? statistics.saves / statistics.shotsOnTarget * 100 : 0,
    xgGoalDifference: statistics.goals - statistics.xg,
    tackleMissPercent: statistics.tackles ? statistics.tacklesMissed / statistics.tackles * 100 : 0 };
}

async function report() {
  const api = await loadNativeLab(['createSimulation', 'createLabScenario', 'createLabBallDriver', 'advanceLabBall', 'stepSimulation', 'readSimulationStatistics']);
  const offBall = Array.from({ length: 3 }, () => measureMatch(api, 901, false));
  const shooting = Array.from({ length: 3 }, () => measureMatch(api, 901));
  const seeds = [shooting[0], ...[731, 42, 2026, 508].map(seed => measureMatch(api, seed))];
  console.log(JSON.stringify({ node: process.version, minutes: 90, steps: 54000,
    offBallMilliseconds: offBall.map(run => run.milliseconds), shootingMilliseconds: shooting.map(run => run.milliseconds), seeds }, null, 2));
}

report().catch(error => { console.error(error); process.exitCode = 1; });
