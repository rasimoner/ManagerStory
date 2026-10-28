/* Run on Node 22. Compilation, snapshots and JSON writing stay outside the timer. */
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const { loadNativeLab } = require('../tests/support/lab.cjs');
const { shotRows } = require('./sim-report/analysis.cjs');
const { shotSlices, tackleSlices, matchSummary } = require('./sim-report/slices.cjs');
const { strengthExperiments } = require('./sim-report/strength.cjs');
const { reporting, match, clock } = require('../src/data/match-sim.json');

function measureMatch(api, input) {
  const simulation = api.createSimulation(input);
  const started = performance.now();
  for (let tick = 0; tick < match.fullSeconds / clock.stepSeconds; tick++) api.stepSimulation(simulation);
  const milliseconds = performance.now() - started;
  const statistics = api.readSimulationStatistics(simulation);
  const byId = new Map(input.teams.flatMap(team => team.players.map(player => [player.id, team.id])));
  const shots = shotRows(simulation.events, id => byId.get(id));
  const run = { seed: input.seed, milliseconds, score: simulation.match.score, statistics,
    xgPerShot: statistics.shots ? statistics.xg / statistics.shots : 0,
    savePercent: statistics.shotsOnTarget ? statistics.saves / statistics.shotsOnTarget * 100 : 0,
    goalXgDifference: statistics.goals - statistics.xg,
    tackleSuccessPercent: statistics.tackles ? (statistics.tacklesWon + statistics.tacklesLoose) / statistics.tackles * 100 : 0 };
  return { run, shots, tackles: simulation.events.filter(event => event.type === 'tackle') };
}

async function report() {
  const api = await loadNativeLab(['createSimulation', 'createLabScenario', 'stepSimulation', 'readSimulationStatistics']);
  const count = Number(argument('--count') ?? reporting.seedCount);
  if (!Number.isInteger(count) || count < 50) throw new RangeError('At least 50 seeds are required.');
  const seeds = [...new Set([...reporting.referenceSeeds, ...Array.from({ length: count }, (_, index) => index + 1)])].slice(0, count);
  const results = seeds.map(seed => measureMatch(api, api.createLabScenario({ seed })));
  const output = { node: process.version, seeds, minutes: 90, steps: match.fullSeconds / clock.stepSeconds,
    summary: matchSummary(results.map(result => result.run)),
    shots: shotSlices(results.flatMap(result => result.shots)), tackles: tackleSlices(results.flatMap(result => result.tackles)),
    runs: results.map(result => result.run) };
  if (process.argv.includes('--strength')) output.strength = strengthExperiments(api, seeds, measureMatch);
  const json = JSON.stringify(output, null, 2) + '\n';
  const destination = argument('--output');
  if (destination) fs.writeFileSync(destination, json);
  else process.stdout.write(json);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

if (require.main === module) report().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { measureMatch };
