const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeDurationRuns, durationSeeds } = require('../tools/duration-report/summary.cjs');

test('duration measurements use fifty unique fixed seeds and disclose all goal bins including zero', () => {
  const seeds = durationSeeds();
  assert.equal(seeds.length, 50);
  assert.equal(new Set(seeds).size, 50);
  assert.deepEqual(seeds.slice(0, 5), [901, 731, 42, 2026, 508]);
  const runs = [0, 1, 2, 3, 4, 7].map(goals => ({ statistics: { goals, shots: 10, shotsOnTarget: goals, xg: 2, passes: 30, completedPasses: 20, teams: [{ resolvedPasses: 10 }, { resolvedPasses: 15 }], fouls: 2, yellow: 1, red: 0 },
    injuries: 0, fitness: { all: 80, keeper: 85, outfield: 79.5 }, activitySeconds: { playing: 80, kickoff: 10, restart: 10 }, consistency: true }));
  const summary = summarizeDurationRuns(runs);
  assert.equal(summary.goals, 17 / 6);
  assert.deepEqual(summary.goalDistribution, { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5+': 1 });
  assert.equal(summary.passAccuracy, 80);
  assert.equal(summary.openPlayPercent, 80);
  assert.equal(summary.consistentMatches, 6);
});

test('all 250 measured matches reconcile real events, career writers and physical budgets', () => {
  const report = require('../docs/measurements/match-sim-duration.json');
  assert.equal(report.status, 'complete');
  for (const duration of Object.values(report.durations)) {
    assert.deepEqual(duration.runs.map(run => run.seed), report.seeds);
    assert.equal(duration.runs.length, 50);
    assert.equal(Object.values(duration.summary.goalDistribution).reduce((sum, count) => sum + count, 0), 50);
    for (const run of duration.runs) {
      assert.equal(run.ticks, run.durationSeconds * 10);
      assert.equal(run.matchSeconds, 5400);
      assert.equal(run.career.reduce((sum, team) => sum + team.goals, 0), run.statistics.goals);
      assert.equal(run.career.reduce((sum, team) => sum + team.shots, 0), run.statistics.shots);
      assert.equal(run.career.reduce((sum, team) => sum + team.yellow, 0), run.statistics.yellow);
      assert.equal(run.career.reduce((sum, team) => sum + team.red, 0), run.statistics.red);
      assert.equal(run.career.reduce((sum, team) => sum + team.injuryEvents, 0), run.injuries);
      assert.ok(run.career.every(team => team.minutes.some(player => player.minutes === 90)));
      assert.ok(run.movement.distanceMetres > 0);
      assert.ok(run.injuryTimes.every(event => event.matchTime < 5400));
    }
  }
});
