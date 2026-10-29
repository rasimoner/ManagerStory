const { reporting } = require('../../src/data/match-sim.json');

function durationSeeds() {
  return [...new Set([...reporting.referenceSeeds, ...Array.from({ length: reporting.seedCount }, (_, index) => index + 1)])].slice(0, reporting.seedCount);
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

function measuredPassAccuracy(runs) {
  const resolved = runs.reduce((sum, run) => sum + run.statistics.teams.reduce((count, team) => count + team.resolvedPasses, 0), 0);
  return resolved ? runs.reduce((sum, run) => sum + run.statistics.completedPasses, 0) / resolved * 100 : 0;
}

function summarizeDurationRuns(runs) {
  const fields = ['goals', 'shots', 'shotsOnTarget', 'xg', 'passes', 'completedPasses', 'fouls', 'yellow', 'red'];
  const statistics = Object.fromEntries(fields.map(field => [field, mean(runs.map(run => run.statistics[field]))]));
  const goals = runs.map(run => run.statistics.goals);
  const goalDistribution = Object.fromEntries(['0', '1', '2', '3', '4', '5+'].map(bin => [bin, goals.filter(value => bin === '5+' ? value >= 5 : value === Number(bin)).length]));
  const activity = Object.fromEntries(['playing', 'kickoff', 'restart'].map(field => [field, mean(runs.map(run => run.activitySeconds[field]))]));
  return { ...statistics, goalDistribution, goalDistributionPercent: Object.fromEntries(Object.entries(goalDistribution).map(([bin, count]) => [bin, count / runs.length * 100])),
    passAccuracy: measuredPassAccuracy(runs),
    injuries: mean(runs.map(run => run.injuries)), fitness: Object.fromEntries(['all', 'keeper', 'outfield'].map(key => [key, mean(runs.map(run => run.fitness[key]))])),
    activitySeconds: activity, openPlayPercent: activity.playing / Object.values(activity).reduce((sum, value) => sum + value, 0) * 100,
    consistentMatches: runs.filter(run => run.consistency).length };
}

module.exports = { durationSeeds, summarizeDurationRuns, mean };
