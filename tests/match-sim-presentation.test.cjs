const test = require('node:test');
const assert = require('node:assert/strict');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function sample() {
  const player = { id: 1, number: 9, teamId: 'user', direction: 1, slot: 'ST', motionMode: 'run',
    position: { x: 0, y: 0, z: 0 }, velocity: { x: 4, y: 0, z: 0 }, heading: Math.PI / 2, keeper: {}, duel: {} };
  return { players: [player], physicsTime: 0, phase: 'playing', contacts: [],
    ball: { position: { x: 0, y: .11, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, ownerId: 1 } };
}

test('manual cameras retain the original broadcast composition and automatic shots follow observed play', async () => {
  const { api, THREE } = await sceneFixture(), frame = sample();
  for (const mode of ['tv', 'close', 'stand']) {
    const camera = new THREE.PerspectiveCamera(), expected = new THREE.PerspectiveCamera();
    const original = api.createBroadcastCamera(expected), actual = api.createSimulationCamera(camera);
    const actor = { pos: new THREE.Vector3().copy(frame.players[0].position) };
    original.update({ ball: { p: new THREE.Vector3().copy(frame.ball.position) } }, { mode, a: actor }, 0, 390 / 844);
    actual.update(frame, 0, { aspect: 390 / 844, mode });
    assert.ok(camera.position.distanceTo(expected.position) < 1e-8, `${mode}: preserve original gantry`);
    assert.equal(camera.fov, expected.fov);
  }
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'tv');
  frame.contacts = [{ type: 'goal', fromId: 1, teamId: 'user', time: 1 }];
  frame.physicsTime = .99;
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'tv');
  frame.physicsTime = 1.5;
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'close');
});

test('crowd and flag shader clocks move with physics and only the scoring end celebrates', async () => {
  const { api } = await sceneFixture(), frame = sample();
  const material = () => ({ uniforms: Object.fromEntries(['uTime', 'uExcite', 'uExciteAway'].map(key => [key, { value: 0 }])) });
  const stadium = { crowdMat: material(), flagMat: material() };
  frame.contacts = [{ type: 'goal', fromId: 1, teamId: 'user', time: 1 }];
  frame.physicsTime = 1.5;
  api.animateSimulationCrowd(stadium, frame, true);
  for (const mat of [stadium.crowdMat, stadium.flagMat]) {
    assert.equal(mat.uniforms.uTime.value, 1.5);
    assert.ok(mat.uniforms.uExcite.value > .8);
    assert.ok(mat.uniforms.uExciteAway.value < .1);
  }
  api.animateSimulationCrowd(stadium, frame, false);
  assert.ok(stadium.flagMat.uniforms.uExciteAway.value > .8);
});

test('an observed goal raises scorer hands while his running feet and root follow the engine', async () => {
  const fixture = await sceneFixture(), frame = sample();
  frame.physicsTime = 1.6;
  frame.contacts = [{ type: 'goal', fromId: 1, teamId: 'user', time: 1 }];
  fixture.actors.apply(frame);
  const actor = fixture.runtime.players[0], point = name => actor.bones[name].getWorldPosition(new fixture.THREE.Vector3());
  assert.ok(point('LeftHand').y > point('Head').y - .2);
  assert.ok(point('RightHand').y > point('Head').y - .2);
  assert.equal(actor.model.position.x, frame.players[0].position.x);
  frame.contacts.push({ type: 'pass', fromId: 1, time: 1.7 });
  frame.physicsTime = 1.75;
  fixture.actors.apply(frame);
  assert.equal(actor.act.name, 'pass', 'the next real action takes priority');
});

test('running boots plant on the grass instead of dragging through the stance', async () => {
  const fixture = await sceneFixture(), frame = sample();
  let previous = {}, planted = 0, worst = 0;
  for (let i = 0; i < 120; i++) {
    frame.physicsTime = i / 60;
    frame.players[0].position.x = i * 4 / 60;
    fixture.actors.apply(frame);
    const actor = fixture.runtime.players[0];
    for (const side of ['Left', 'Right']) {
      const toe = actor.bones[`${side}ToeBase`].getWorldPosition(new fixture.THREE.Vector3());
      if (previous[side]?.y < .055 && toe.y < .055) { worst = Math.max(worst, toe.distanceTo(previous[side])); planted++; }
      previous[side] = toe;
    }
    assert.equal(actor.model.position.x, frame.players[0].position.x);
  }
  assert.ok(planted > 10, 'both legs have readable ground contacts');
  assert.ok(worst < .025, `stance drift per 60 Hz frame: ${worst}`);
});
