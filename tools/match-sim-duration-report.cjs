const fs = require('node:fs');
const { loadNativeLab } = require('../tests/support/lab.cjs');
const { loadNativeGame } = require('../tests/support/native.cjs');
const { equalDurationInput, measureDurationMatch } = require('./duration-report/measure.cjs');
const { durationSeeds, summarizeDurationRuns } = require('./duration-report/summary.cjs');
const { minutes, secondsPerMinute } = require('../src/data/match-duration.json');

async function report() {
  const lab = await loadNativeLab(['createSimulation', 'createLabScenario', 'stepSimulation', 'readSimulationStatistics', 'resumeSimulation']);
  const career = await loadNativeGame(['simulationPlayerRatings', 'careerSimulationEvent', 'recordMatchEvent', 'recordMinutePlayed', 'seasonRecordMatch', 'setCareer', 'setMatch']);
  const api = { ...lab, ...career }, seeds = durationSeeds();
  const output = { node: process.version, status: 'running', seeds, setup: 'Identical attributes by slot; workload enabled; real events and career goal/card/minute/assist writers; injuries withdraw players without a bench in this laboratory comparison.', durations: {} };
  const destination = process.argv[2] || 'docs/measurements/match-sim-duration.json';
  for (const duration of [undefined, ...minutes.map(value => value * secondsPerMinute)]) measureDurationGroup(api, { output, duration, seeds, destination });
  output.status = 'complete';
  fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
}

function measureDurationGroup(api, { output, duration, seeds, destination }) {
  const key = duration === undefined ? 'reference' : String(duration);
  const result = { durationSeconds: duration ?? 5400, runs: [] };
  output.durations[key] = result;
  for (const seed of seeds) {
    result.runs.push(measureDurationMatch(api, equalDurationInput(api, seed, duration)));
    if (result.runs.length % 10 === 0) fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
  }
  result.summary = summarizeDurationRuns(result.runs);
  process.stderr.write(`Measured ${key}: ${result.runs.length} seeds, ${result.summary.goals.toFixed(2)} goals, ${result.summary.shots.toFixed(2)} shots\n`);
}

if (require.main === module) report().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { report };
