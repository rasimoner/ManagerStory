const test = require('node:test');
const assert = require('node:assert/strict');
const before = require('../docs/measurements/match-sim-balance-before.json');
const after = require('../docs/measurements/match-sim-balance-after.json');

function between(value, minimum, maximum) {
  assert.ok(value >= minimum && value <= maximum, `${value} outside ${minimum}–${maximum}`);
}

test('the balance report covers the same fifty seeds and reconciles real outcomes', () => {
  assert.equal(after.status, 'complete');
  assert.deepEqual(after.seeds, before.seeds);
  assert.equal(new Set(after.seeds).size, 50);
  for (const run of after.runs) {
    assert.equal(run.statistics.shotsOnTarget, run.statistics.goals + run.statistics.saves);
    assert.equal(run.statistics.goals, run.score.home + run.score.away);
  }
});

test('the measured goals, saves, legal tackles and passing meet the basic football ranges', () => {
  const summary = after.summary;
  for (const [key, minimum, maximum] of [['goals', 2.2, 3.4], ['shotsOnTarget', 6, 11], ['blocks', 3, 8],
    ['yellow', 2, 5], ['passes', 750, 1000], ['accuracy', 75, 88], ['averageDistance', 15, 20]]) {
    between(summary[key].mean, minimum, maximum);
  }
  between(summary.weightedXgPerShot, 0.09, 0.14);
  between(summary.weightedSavePercent, 62, 76);
  assert.ok(summary.tackleSuccessPercent.mean > 50);
  if (summary.scoreDistribution['5+'] >= 15) assert.ok(after.limitations.highScoring.length > 40);
  assert.ok(summary.scoreDistribution['0'] > 0 && summary.scoreDistribution['0'] <= 20);
  assert.ok(Math.abs(summary.goalXgDifference.mean) < 0.5);
});

test('out-of-range measurements are explicitly disclosed rather than relabelled as passed', () => {
  for (const [key, minimum, maximum] of [['shots', 18, 30], ['fouls', 16, 26]]) {
    if (after.summary[key].mean < minimum || after.summary[key].mean > maximum) assert.ok(after.limitations[key].length > 40);
  }
  assert.ok(after.limitations.xgSlices.length > 40);
});

test('strength and isolated attribute experiments shift performance in the intended directions', () => {
  const { equal, all5, all10, all20, finishing, reflexes, defence, swapped10 } = after.strength;
  assert.ok(all5.goalDifference.mean > equal.goalDifference.mean);
  assert.ok(all10.wins > 25 && all10.losses <= 10);
  assert.ok(all20.wins > all10.wins && all20.goalDifference.mean > all10.goalDifference.mean);
  assert.ok(finishing.goalsFor.mean >= equal.goalsFor.mean);
  assertPlausibleImprovement(reflexes, equal, { field: 'goalsAgainst', sign: -1 });
  assert.ok(defence.goalsAgainst.mean <= equal.goalsAgainst.mean);
  assert.ok(swapped10.wins > 25 && swapped10.goalDifference.mean > 0);
});

test('controlled finishing trials preserve style and isolate a positive scoring response', () => {
  const trial = after.controlledFinishing;
  assert.equal(trial.baseline.shots, 50 * trial.distances.length);
  assert.equal(trial.improved.shots, trial.baseline.shots);
  assert.equal(trial.changedStyles, 0);
  assert.ok(trial.improved.goals > trial.baseline.goals);
});

test('the same shot flights become more reachable when only keeper reflexes improve', () => {
  const trial = after.controlledGoalkeeping;
  assert.equal(trial.improved.shots, trial.baseline.shots);
  assert.ok(trial.improved.goals <= trial.baseline.goals);
  assert.ok(trial.improved.saves >= trial.baseline.saves);
});

function assertPlausibleImprovement(experiment, control, { field, sign }) {
  const differences = experiment.runs.map((run, index) => sign * (run[field] - control.runs[index][field]));
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  const variance = differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (differences.length - 1);
  const margin = 1.96 * Math.sqrt(variance / differences.length);
  assert.ok(mean + margin >= 0, 'paired match sample shows a statistically adverse attribute response');
}

test('the independent hundred-seed run repeats all first fifty physical match outcomes', () => {
  const hundred = require('../docs/measurements/match-sim-balance-hundred.json');
  assert.equal(new Set(hundred.seeds).size, 100);
  assert.deepEqual(hundred.seeds.slice(0, 50), after.seeds);
  const outcomes = run => ({ seed: run.seed, score: run.score, statistics: run.statistics });
  assert.deepEqual(hundred.runs.slice(0, 50).map(outcomes), after.runs.map(outcomes));
});

test('hundred-seed strength comparisons remain positive on both sides and repeat the original pairs', () => {
  const sides = require('../docs/measurements/match-sim-balance-strength-sides.json');
  assert.equal(sides.status, 'complete');
  for (const name of ['all10', 'swapped10']) {
    assert.equal(sides.strength[name].runs.length, 100);
    assert.ok(sides.strength[name].wins > 50);
    assert.deepEqual(sides.strength[name].runs.slice(0, 50), after.strength[name].runs);
  }
});
