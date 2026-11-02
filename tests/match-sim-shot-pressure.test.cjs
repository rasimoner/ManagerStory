const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab } = require('./support/lab.cjs');

const SEEDS = 150;
const PRESSED = 0.7;
const TOLERANCE = 0.12;

function parkEveryone(input, settings) {
  for (const team of input.teams) for (const [index, player] of team.players.entries()) {
    player.position = { x: settings.parkingX, y: settings.parkingStartY + index * settings.parkingStepY };
  }
}

function shotScenario(api, { seed, distance, pressure }) {
  const data = api.MATCH_SIM_DATA, input = api.createLabScenario({ seed });
  input.match = false;
  parkEveryone(input, data.reporting.controlledShots);
  const shooter = input.teams[0].players.at(-1), keeper = input.teams[1].players[0], marker = input.teams[1].players[1];
  shooter.position = { x: data.pitch.length / 2 - distance, y: 0 };
  keeper.position = { x: data.pitch.length / 2 - 1.8, y: 0 };
  if (pressure > 0) marker.position = { x: shooter.position.x - (1 - pressure) * data.passing.pressureDistance, y: 0 };
  input.ball = { position: { ...shooter.position }, ownerId: shooter.id, teamId: input.teams[0].id };
  return input;
}

function playShot(api, input) {
  const simulation = api.createSimulation(input), data = api.MATCH_SIM_DATA;
  simulation.automaticPasses = false;
  simulation.teams[1].players[0].keeper.setSeconds = 1;
  api.requestSimulationShot(simulation);
  for (let tick = 0; tick < data.reporting.controlledShots.seconds / data.clock.stepSeconds; tick++) api.stepSimulation(simulation);
  return api.readSimulationStatistics(simulation);
}

function controlledShotTotals(api, { distance, pressure }) {
  const totals = { goals: 0, expectedGoals: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const statistics = playShot(api, shotScenario(api, { seed, distance, pressure }));
    totals.goals += statistics.goals;
    totals.expectedGoals += statistics.xg;
  }
  return totals;
}

for (const distance of [8, 11]) {
  test(`a shooter pressed from behind loses as many goals as the chance model charges at ${distance} m`, () => {
    const { api } = loadLab();
    const free = controlledShotTotals(api, { distance, pressure: 0 });
    const pressed = controlledShotTotals(api, { distance, pressure: PRESSED });
    const modelledRetention = pressed.expectedGoals / free.expectedGoals;
    const playedRetention = pressed.goals / free.goals;
    assert.ok(Math.abs(playedRetention - modelledRetention) <= TOLERANCE,
      `pressure keeps ${playedRetention.toFixed(2)} of the goals but the chance model keeps ${modelledRetention.toFixed(2)}`);
  });
}
