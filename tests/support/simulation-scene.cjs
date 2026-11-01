const fs = require('node:fs');
const path = require('node:path');
const { locate, SRC } = require('./game.cjs');
let pending;

function loadScene() { return pending ??= bundleScene(); }

async function bundleScene() {
  const { build } = await import('vite');
  const modules = ['scene-atmosphere.js', 'scene-ball.js', 'camera.js', 'scene-actors.js', 'scene-camera.js', 'scene-kits.js', 'runtime.js', 'rig.js', 'stadium.js', 'scene-event-label.js', 'scene-offside.js', 'scene-replay.js'];
  const entry = modules.map(name => `export * from ${JSON.stringify(path.join(SRC, locate(name)))};`).join('\n');
  const result = await build({ configFile: false, logLevel: 'silent',
    plugins: [{ name: 'scene-test', resolveId: id => id.endsWith('scene-test') ? '\0scene-test' : null,
      load: id => id === '\0scene-test' ? entry : null }],
    build: { write: false, minify: false, lib: { entry: 'scene-test', formats: ['es'] } },
  });
  const output = Array.isArray(result) ? result[0] : result;
  return import('data:text/javascript;base64,' + Buffer.from(output.output[0].code).toString('base64'));
}

async function sceneFixture() {
  const api = await loadScene(), THREE = await import('three');
  const rig = api.loadRig(JSON.parse(fs.readFileSync(path.join(SRC, locate('footballer-rig.json')), 'utf8')));
  const gait = {};
  for (const name of ['walk', 'run', 'sprint']) gait[name] = api.analyseGait(rig.newInstance().group, rig.clips[name]);
  const runtime = api.createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, retainPoseBase: true });
  const club = { primaryColor: '#e2bc12', secondaryColor: '#d72231' };
  const actors = api.createSimulationActors(runtime, player => ({ key: String(player.id), id: player.id, no: player.number,
    keeper: player.slot === 'GK', role: player.slot, kit: api.simulationSceneKit(club, player) }));
  return { api, runtime, actors, THREE };
}

module.exports = { loadScene, sceneFixture };
