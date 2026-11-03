const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { SRC } = require('./support/game.cjs');

// The scene code imports three.js and JSON data, so it is bundled the way the native lab tests bundle theirs.
async function loadSceneHands() {
  const entry = `export { poseSimulationHands } from ${JSON.stringify(path.join(SRC, 'core/presentation/sim/scene-hands.js'))};`;
  const { build } = await import('vite');
  const bundled = await build({ configFile: false, logLevel: 'silent',
    plugins: [{ name: 'scene-hands-test', resolveId: id => id.endsWith('scene-hands-test') ? '\0scene-hands-test' : null,
      load: id => id === '\0scene-hands-test' ? entry : null }],
    build: { write: false, minify: false, lib: { entry: 'scene-hands-test', formats: ['es'] } } });
  const output = Array.isArray(bundled) ? bundled[0] : bundled;
  return import('data:text/javascript;base64,' + Buffer.from(output.output[0].code).toString('base64'));
}

function fakeActor(THREE, id, { x, z, heading }) {
  const bone = (px, py, pz) => { const object = new THREE.Object3D(); object.position.set(px, py, pz); return object; };
  return { id, keeper: null, heading, pos: new THREE.Vector3(x, 0, z),
    bones: { LeftArm: bone(x - 0.2, 1.4, z), RightArm: bone(x + 0.2, 1.4, z) } };
}

test('a throw-in taker reaches for the ball above his own head, not for the spot where the ball was placed', async () => {
  const THREE = await import('three');
  const { poseSimulationHands } = await loadSceneHands();
  const taker = fakeActor(THREE, 'taker', { x: 10, z: 5, heading: 0 });
  const reached = [];
  const runtime = { handIK: (actor, side, target) => reached.push({ side, target: target.clone() }) };
  // The restart spot lies 0.9 m beside him; the simulated ball rises over it during the wind-up.
  const frame = { ball: { heldBy: 'taker', position: { x: 10.9, y: 1.9, z: 5.4 } }, contacts: [], physicsTime: 1 };
  poseSimulationHands(runtime, taker, frame);
  assert.equal(reached.length, 2);
  for (const { side, target } of reached) {
    assert.ok(Math.hypot(target.x - taker.pos.x, target.z - taker.pos.z) <= 0.35, `${side} hand aims ${target.x.toFixed(2)}, ${target.z.toFixed(2)}`);
    assert.ok(Math.abs(target.y - 1.9) < 0.01, 'the grip keeps the simulated ball height');
  }
});

test('after the release the thrower\'s hands travel forward and down, then let go', async () => {
  const THREE = await import('three');
  const { poseSimulationHands } = await loadSceneHands();
  const taker = fakeActor(THREE, 'taker', { x: 10, z: 5, heading: 0 });
  const throwEvent = { type: 'pass', restartKind: 'throwIn', fromId: 'taker', time: 1 };
  const reach = physicsTime => {
    const targets = [];
    poseSimulationHands({ handIK: (...reach) => targets.push({ target: reach[2].clone(), weight: reach[3] }) }, taker,
      { ball: { heldBy: null, position: { x: 12, y: 2, z: 5 } }, contacts: [throwEvent], physicsTime });
    return targets;
  };
  const early = reach(1.05), late = reach(1.3);
  assert.equal(early.length, 2);
  assert.equal(late.length, 2);
  assert.ok(late[0].target.z > early[0].target.z + 0.15, 'the hands move forward along the throw');
  assert.ok(late[0].target.y < early[0].target.y - 0.4, 'and down');
  assert.equal(reach(1.5).length, 0, 'after the follow-through the pose keys take over again');
  assert.equal(reach(0.9).length, 0, 'before the release nothing is overridden');
});
