// Small diagnostic only; the unchanged fifty-seed CI contract remains the delivery gate.
const fs = require('node:fs');
const path = require('node:path');
const [root = path.resolve(__dirname, '../..'), destination] = process.argv.slice(2);

async function probe() {
  const { loadNativeLab } = require(path.join(root, 'tests/support/lab.cjs'));
  const { match, clock } = require(path.join(root, 'src/data/match-sim.json'));
  const api = await loadNativeLab(['createLabScenario', 'createSimulation', 'stepSimulation', 'readSimulationStatistics']);
  const runs = [];
  for (const seed of [901, 731, 42]) {
    const simulation = api.createSimulation(api.createLabScenario({ seed }));
    for (let tick = 0; tick < match.fullSeconds / clock.stepSeconds; tick++) api.stepSimulation(simulation);
    const statistics = api.readSimulationStatistics(simulation);
    const counts = Object.fromEntries(['goals', 'shots', 'passes', 'completedPasses', 'fouls', 'saves', 'red', 'ballWins'].map(field => [field, statistics[field]]));
    runs.push({ seed, score: simulation.match.score, ...counts });
    console.log(JSON.stringify(runs.at(-1)));
  }
  if (destination) fs.writeFileSync(destination, JSON.stringify({ node: process.version, steps: match.fullSeconds / clock.stepSeconds, runs }, null, 2) + '\n');
}
probe().catch(error => { console.error(error.message); process.exitCode = 1; });
