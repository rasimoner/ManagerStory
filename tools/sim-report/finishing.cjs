const { reporting, pitch, clock } = require('../../src/data/match-sim.json');

function controlledFinishing(api, seeds) {
  return { finishingBoost: reporting.controlledShots.finishingBoost, ...controlledShotPair(api, seeds, 'finishing') };
}

function controlledGoalkeeping(api, seeds) {
  return { reflexesBoost: reporting.controlledShots.finishingBoost, ...controlledShotPair(api, seeds, 'reflexes') };
}

function controlledShotPair(api, seeds, attribute) {
  const settings = reporting.controlledShots;
  const baseline = emptyTotals(), improved = emptyTotals();
  let changedStyles = 0;
  for (const seed of seeds) for (const distance of settings.distances) {
    const first = fireTrial(api, trialInput(api, { seed, distance, attribute, bonus: 0 }));
    const second = fireTrial(api, trialInput(api, { seed, distance, attribute, bonus: settings.finishingBoost }));
    addTrial(baseline, first); addTrial(improved, second);
    if (first.style !== second.style) changedStyles++;
  }
  return { distances: settings.distances, baseline, improved, changedStyles };
}

function trialInput(api, { seed, distance, bonus, attribute }) {
  const settings = reporting.controlledShots, input = api.createLabScenario({ seed });
  input.match = false;
  for (const team of input.teams) for (const [index, player] of team.players.entries()) {
    player.position = { x: settings.parkingX, y: settings.parkingStartY + index * settings.parkingStepY };
  }
  const shooter = input.teams[0].players.at(-1), keeper = input.teams[1].players[0];
  shooter.position = { x: pitch.length / 2 - distance, y: 0 };
  keeper.position = { x: pitch.length / 2 - settings.keeperDepth, y: 0 };
  if (attribute === 'finishing') shooter.attributes.finishing = Math.min(100, shooter.attributes.finishing + bonus);
  else keeper.attributes.gk.reflexes = Math.min(100, keeper.attributes.gk.reflexes + bonus);
  input.ball = { position: { ...shooter.position }, ownerId: shooter.id, teamId: input.teams[0].id };
  return input;
}

function fireTrial(api, input) {
  const simulation = api.createSimulation(input);
  simulation.automaticPasses = false;
  simulation.teams[1].players[0].keeper.setSeconds = 1;
  api.requestSimulationShot(simulation);
  const shot = simulation.events.find(event => event.type === 'shot');
  for (let tick = 0; tick < reporting.controlledShots.seconds / clock.stepSeconds; tick++) api.stepSimulation(simulation);
  return { style: shot.style, statistics: api.readSimulationStatistics(simulation) };
}

function emptyTotals() {
  return { shots: 0, goals: 0, saves: 0, onTarget: 0, styles: { drive: 0, placed: 0, chip: 0 } };
}

function addTrial(totals, trial) {
  totals.shots++;
  totals.goals += trial.statistics.goals;
  totals.saves += trial.statistics.saves;
  totals.onTarget += trial.statistics.shotsOnTarget;
  totals.styles[trial.style]++;
}

module.exports = { controlledFinishing, controlledGoalkeeping };
