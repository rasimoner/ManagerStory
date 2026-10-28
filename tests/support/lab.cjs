const { loadGame } = require('./game.cjs');

function loadLab() {
  return loadGame({ page: 'lab.html', skip: ['core/presentation/lab/main.js'], quiet: true });
}

function labFixture(options = {}) {
  const { api } = loadLab();
  const input = api.createLabScenario(options);
  const simulation = api.createSimulation(input);
  return { api, input, simulation };
}

function runLabSeconds(fixture, seconds, ball = fixture.simulation.ball) {
  const ticks = Math.round(seconds / fixture.api.MATCH_SIM_DATA.clock.stepSeconds);
  for (let tick = 0; tick < ticks; tick++) fixture.api.stepSimulation(fixture.simulation, ball);
}

const plain = value => JSON.parse(JSON.stringify(value));
module.exports = { loadLab, labFixture, runLabSeconds, plain };
