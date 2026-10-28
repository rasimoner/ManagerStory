const { distribution } = require('./analysis.cjs');

function strengthExperiments(api, seeds, measure) {
  return Object.fromEntries(['equal', 'all5', 'all10', 'all20', 'finishing', 'reflexes', 'defence', 'swapped10'].map(experiment => {
    const runs = seeds.map(seed => {
      const input = api.createLabScenario({ seed });
      // Identical starting squads isolate attribute effects from laboratory roster generation.
      input.teams[1].players.forEach((player, index) => { player.attributes = structuredClone(input.teams[0].players[index].attributes); });
      const strong = experiment === 'swapped10' ? 1 : 0;
      boostTeam(input.teams[strong], experiment);
      const { run } = measure(api, input);
      return strengthResult(run, input.teams[strong].id);
    });
    return [experiment, { wins: runs.filter(run => run.goalDifference > 0).length, draws: runs.filter(run => run.goalDifference === 0).length,
      losses: runs.filter(run => run.goalDifference < 0).length, goalDifference: distribution(runs.map(run => run.goalDifference)),
      shotDifference: distribution(runs.map(run => run.shotDifference)), xgDifference: distribution(runs.map(run => run.xgDifference)), runs }];
  }));
}

function boostTeam(team, experiment) {
  if (experiment === 'equal') return;
  for (const player of team.players) boostPlayer(player, experiment);
}

function boostPlayer(player, experiment) {
  const amount = experiment === 'all5' ? 5 : experiment === 'all20' ? 20 : 10;
  const attributes = player.attributes;
  if (experiment.startsWith('all') || experiment === 'swapped10') {
    boostAllAttributes(attributes, amount);
  }
  boostSpecialist(player, experiment);
}

function boostSpecialist(player, experiment) {
  const attributes = player.attributes, amount = 10;
  if (experiment === 'finishing' && /ST$/.test(player.slot)) attributes.finishing = Math.min(100, attributes.finishing + amount);
  if (experiment === 'reflexes' && player.slot === 'GK') attributes.gk.reflexes = Math.min(100, attributes.gk.reflexes + amount);
  if (experiment === 'defence' && ['LB', 'LCB', 'RCB', 'RB'].includes(player.slot)) {
    attributes.tackling = Math.min(100, attributes.tackling + amount);
    attributes.positioning = Math.min(100, attributes.positioning + amount);
  }
}

function boostAllAttributes(attributes, amount) {
  for (const key of Object.keys(attributes)) {
    if (typeof attributes[key] === 'number') attributes[key] = Math.min(100, attributes[key] + amount);
  }
  for (const key of Object.keys(attributes.gk)) attributes.gk[key] = Math.min(100, attributes.gk[key] + amount);
}

function strengthResult(run, strongId) {
  const strong = run.statistics.teams.find(team => team.id === strongId), weak = run.statistics.teams.find(team => team.id !== strongId);
  return { seed: run.seed, goalDifference: strong.goals - weak.goals, shotDifference: strong.shots - weak.shots, xgDifference: strong.xg - weak.xg };
}

module.exports = { strengthExperiments };
