const { loadGame, SRC } = require('./game.cjs');
const path = require('node:path');

async function loadNativeLab(names) {
  const { owner } = loadLab();
  const entry = names.map(name => `export { ${name} } from ${JSON.stringify(path.join(SRC, owner(name)))};`).join('\n');
  const { build } = await import('vite');
  const bundled = await build({ configFile: false, logLevel: 'silent',
    plugins: [{ name: 'native-lab-test', resolveId: id => id.endsWith('native-lab-test') ? '\0native-lab-test' : null,
      load: id => id === '\0native-lab-test' ? entry : null }],
    build: { write: false, minify: false, lib: { entry: 'native-lab-test', formats: ['es'] } },
  });
  const output = Array.isArray(bundled) ? bundled[0] : bundled;
  return import('data:text/javascript;base64,' + Buffer.from(output.output[0].code).toString('base64'));
}

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
module.exports = { loadLab, loadNativeLab, labFixture, runLabSeconds, plain };
