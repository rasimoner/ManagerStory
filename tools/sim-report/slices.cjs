const { bucket, sliceRows, distribution } = require('./analysis.cjs');
const { reporting } = require('../../src/data/match-sim.json');

function shotSlices(rows) {
  return {
    distance: sliceRows(rows, row => bucket(row.distance, reporting.shotDistances)),
    angleDegrees: sliceRows(rows, row => bucket(row.angle * 180 / Math.PI, reporting.shotAngles)),
    technique: sliceRows(rows, row => row.style ?? 'foot'),
    origin: sliceRows(rows, row => row.second ? 'rebound' : 'foot'),
    sequence: sliceRows(rows, row => row.second ? 'second' : 'first'),
    pressure: sliceRows(rows, row => row.pressure >= reporting.pressureThreshold ? 'pressured' : 'open'),
    keeperSet: sliceRows(rows, row => row.keeper?.set ? 'set' : 'unset'),
    calibration: sliceRows(rows, row => bucket(row.xg, reporting.xgBins)),
    keeperSpeed: sliceRows(rows, row => bucket(row.power, reporting.shotSpeeds)),
    keeperDistance: sliceRows(rows, row => bucket(row.keeper?.distance, reporting.keeperDistances)),
    keeperLateralDistance: sliceRows(rows, row => bucket(row.keeper?.lateralDistance, reporting.keeperOffsets)),
    sources: Object.fromEntries(['ballWin', 'throughPass', 'dribbleBeat', 'rebound', 'other'].map(source => [source, {
      shots: rows.filter(row => row.sources.includes(source)).length,
      goals: rows.filter(row => row.goal && row.sources.includes(source)).length,
    }])),
  };
}

function tackleSlices(rows) {
  return Object.fromEntries(Object.entries({ kind: row => row.kind, speed: row => bucket(row.victimSpeed, reporting.carrierSpeeds),
    preparation: row => bucket(row.preparationSeconds, reporting.preparationSeconds), distance: row => bucket(row.distance, reporting.tackleDistances) })
    .map(([name, keyOf]) => [name, tackleGroups(rows, keyOf)]));
}

function tackleGroups(rows, keyOf) {
  const groups = {};
  for (const row of rows) {
    const stats = groups[keyOf(row)] ??= { count: 0, won: 0, loose: 0, missed: 0, foul: 0 };
    stats.count++; stats[row.result]++;
    if (row.contact === 'player') stats.foul++;
  }
  return groups;
}

function matchSummary(runs) {
  const metrics = ['goals', 'shots', 'shotsOnTarget', 'xg', 'xgPerShot', 'savePercent', 'blocks', 'tackleSuccessPercent', 'fouls', 'yellow', 'red', 'passes', 'accuracy', 'averageDistance', 'milliseconds', 'goalXgDifference'];
  const summary = Object.fromEntries(metrics.map(metric => [metric, distribution(runs.map(run => run[metric] ?? run.statistics[metric]))]));
  const totals = runs.reduce((sum, run) => ({ shots: sum.shots + run.statistics.shots, saves: sum.saves + run.statistics.saves,
    onTarget: sum.onTarget + run.statistics.shotsOnTarget, xg: sum.xg + run.statistics.xg }), { shots: 0, saves: 0, onTarget: 0, xg: 0 });
  return { ...summary, weightedXgPerShot: totals.xg / totals.shots, weightedSavePercent: totals.saves / totals.onTarget * 100,
    scoreDistribution: Object.fromEntries(['0', '1', '2', '3', '4', '5+'].map(bin => [bin, runs.filter(run => (run.statistics.goals >= 5 ? '5+' : String(run.statistics.goals)) === bin).length / runs.length * 100])),
    drawPercent: runs.filter(run => run.score.home === run.score.away).length / runs.length * 100 };
}

module.exports = { shotSlices, tackleSlices, matchSummary };
