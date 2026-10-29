const assert = require('node:assert/strict');
const fs = require('node:fs');

const counters = ['goals', 'shots', 'shotsOnTarget', 'saves', 'blocks', 'passes', 'completedPasses', 'tackles',
  'tacklesWon', 'tacklesLoose', 'tacklesMissed', 'fouls', 'yellow', 'red'];

function compareSimulationReports(recorded, replay) {
  assert.equal(recorded.status, 'complete');
  assert.equal(replay.status, 'complete');
  assert.deepEqual(replay.seeds, recorded.seeds);
  assert.equal(replay.runs.length, recorded.runs.length);
  recorded.runs.forEach((run, index) => compareMatchRun(run, replay.runs[index]));
  for (const [name, experiment] of Object.entries(recorded.strength ?? {})) compareStrengthRuns(experiment, replay.strength?.[name]);
  assert.deepEqual(replay.controlledFinishing, recorded.controlledFinishing);
  assert.deepEqual(replay.controlledGoalkeeping, recorded.controlledGoalkeeping);
}

function compareMatchRun(recorded, replay) {
  assert.equal(replay.seed, recorded.seed);
  assert.deepEqual(replay.score, recorded.score);
  for (const field of counters) assert.equal(replay.statistics[field], recorded.statistics[field], `seed ${recorded.seed}: ${field}`);
  for (const field of ['xg', 'accuracy', 'averageDistance']) compareScalar(replay.statistics[field], recorded.statistics[field], `seed ${recorded.seed}: ${field}`);
}

function compareStrengthRuns(recorded, replay) {
  assert.ok(replay, 'missing strength experiment');
  assert.equal(replay.runs.length, recorded.runs.length);
  recorded.runs.forEach((run, index) => {
    const repeated = replay.runs[index];
    for (const field of ['seed', 'goalDifference', 'shotDifference', 'goalsFor', 'goalsAgainst', 'savePercent']) assert.equal(repeated[field], run[field], `strength seed ${run.seed}: ${field}`);
    compareScalar(repeated.xgDifference, run.xgDifference, `strength seed ${run.seed}: xg`);
  });
}

function compareScalar(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
}

if (require.main === module) {
  const [recorded, replay] = process.argv.slice(2).map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  compareSimulationReports(recorded, replay);
  console.log('Recorded fifty-seed matches, strength experiments and controlled trials reproduce.');
}
module.exports = { compareSimulationReports };
