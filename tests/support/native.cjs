const path = require('node:path');
const { loadGame, SRC } = require('./game.cjs');

async function loadNativeGame(names) {
  const { owner } = loadGame({ skip: ['main.js'], quiet: true });
  const entry = names.map(name => `export { ${name} } from ${JSON.stringify(path.join(SRC, owner(name)))};`).join('\n');
  const { build } = await import('vite');
  const bundled = await build({ configFile: false, logLevel: 'silent',
    plugins: [{ name: 'native-game-test', resolveId: id => id.endsWith('native-game-test') ? '\0native-game-test' : null,
      load: id => id === '\0native-game-test' ? entry : null }],
    build: { write: false, minify: false, lib: { entry: 'native-game-test', formats: ['es'] } },
  });
  const output = Array.isArray(bundled) ? bundled[0] : bundled;
  return import('data:text/javascript;base64,' + Buffer.from(output.output[0].code).toString('base64'));
}

module.exports = { loadNativeGame };
