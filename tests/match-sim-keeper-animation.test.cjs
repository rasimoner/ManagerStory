const test = require('node:test');
const assert = require('node:assert/strict');
const { keeperScene } = require('./support/keeper-scene.cjs');

test('the real keeper extends his whole body to either side at either goal and in either half', async () => {
  for (const heading of [Math.PI / 2, -Math.PI / 2]) for (const side of [-1, 1]) {
    const scene = await keeperScene({ heading, keeper: { target: { x: 52.61, y: 2.6 * side, height: .4 } } });
    scene.frame.half = heading > 0 ? 1 : 2;
    const actor = scene.draw(1.4), axis = scene.bone('Head').sub(scene.bone('Hips')).normalize();
    assert.ok(axis.z * side > .65, `head and torso extend towards pitch-y ${side}: ${axis.z}`);
    assert.ok(Math.abs(axis.y) < .65, 'a full dive is not upright arms-only reaching');
    const hands = scene.bone('LeftHand').add(scene.bone('RightHand')).multiplyScalar(.5);
    assert.ok((hands.z - scene.sample.position.z) * side > .55, 'both gloves lead the body');
    assert.equal(actor.model.position.x, scene.sample.position.x);
    assert.equal(actor.model.position.z, scene.sample.position.z);
    assert.equal(actor.dive, null, 'the legacy movement solver is not involved');
  }
});

test('a new dive cannot anticipate reactionAt or an unobserved save result', async () => {
  const waiting = await keeperScene(), neutral = await keeperScene({ keeper: { mode: 'reacting' } });
  waiting.draw(.99); neutral.draw(.99);
  for (const name of Object.keys(waiting.points())) assert.ok(waiting.bone(name).distanceTo(neutral.bone(name)) < 1e-7);
  const atBoundary = waiting.draw(1);
  assert.ok(waiting.bone('Head').y > waiting.bone('Hips').y + .35);
  assert.equal(atBoundary.model.position.x, 48);
});

test('low and high reaches differ while a nearby step keeps the keeper on his feet', async () => {
  const low = await keeperScene(), high = await keeperScene({ keeper: { target: { x: 52.61, y: 2.6, height: 2.25 } } });
  const near = await keeperScene({ keeper: { mode: 'step', target: { x: 52.61, y: .35, height: .7 } } });
  low.draw(1.4); high.draw(1.4); near.draw(1.4);
  const gloves = scene => (scene.bone('LeftHand').y + scene.bone('RightHand').y) / 2;
  assert.ok(gloves(high) > gloves(low) + .35, 'high-ball gloves are visibly higher');
  const upright = near.bone('Head').sub(near.bone('Hips')).normalize();
  assert.ok(upright.y > .8, 'a short step does not manufacture a full dive');
});

test('landing, hand/knee support and standing form a continuous grounded chain even after a miss', async () => {
  const scene = await keeperScene();
  let previous, maximumJump = 0, minimum = Infinity, lowestHips = Infinity, supported = false;
  for (let index = 0; index <= 360; index++) {
    const time = 1 + index / 120;
    if (time > 1.5) { scene.sample.keeper.mode = 'positioning'; scene.sample.keeper.shotIndex = null; }
    scene.draw(time);
    const points = scene.points();
    if (previous) for (const name of Object.keys(points)) maximumJump = Math.max(maximumJump, points[name].distanceTo(previous[name]));
    for (const point of Object.values(points)) minimum = Math.min(minimum, point.y);
    if (time > 1.6 && time < 2.4) {
      lowestHips = Math.min(lowestHips, points.Hips.y);
      supported ||= Math.min(points.LeftHand.y, points.RightHand.y) < .25 && Math.min(points.LeftLeg.y, points.RightLeg.y) < .35;
    }
    previous = points;
  }
  assert.ok(lowestHips < .5, `lands on his side (${lowestHips})`);
  assert.ok(supported, 'recovery uses a hand and a knee near the ground');
  assert.ok(minimum > -.025, `no bone penetrates the turf (${minimum})`);
  assert.ok(maximumJump < .13, `no one-frame reset to standing (${maximumJump})`);
  assert.ok(scene.bone('Hips').y > .8, 'fully standing after recovery');
});

test('the rig mesh, including gloves, head and boots, stays above the turf during landing and recovery', async () => {
  const scene = await keeperScene();
  let lowest = Infinity;
  for (let index = 0; index < 20; index++) {
    const actor = scene.draw(1.5 + index / 10);
    actor.body.skeleton.update();
    const positions = actor.body.geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const point = new scene.THREE.Vector3().fromBufferAttribute(positions, vertex);
      actor.body.applyBoneTransform(vertex, point).applyMatrix4(actor.body.matrixWorld);
      lowest = Math.min(lowest, point.y);
    }
  }
  assert.ok(lowest >= -.025, `actual skinned geometry stays out of the ground (${lowest})`);
});

test('absolute physics time gives identical bones at half/normal/double speed, pause and cache rebuild', async () => {
  const target = 2.12, fresh = await keeperScene();
  fresh.draw(target);
  for (const step of [1 / 120, 1 / 60, 1 / 30]) {
    const scene = await keeperScene();
    for (let time = 0; time < target; time += step) scene.draw(time);
    scene.draw(target); scene.draw(target);
    for (const name of Object.keys(fresh.points())) assert.ok(scene.bone(name).distanceTo(fresh.bone(name)) < 1e-6, `${name}: speed ${step}`);
    scene.draw(40); scene.draw(target);
    for (const name of Object.keys(fresh.points())) assert.ok(scene.bone(name).distanceTo(fresh.bone(name)) < 1e-6, `${name}: rewind/rebuild`);
  }
});

test('a rebound reaction and a real distribution take priority over the previous recovery', async () => {
  const scene = await keeperScene();
  scene.draw(1.8);
  scene.sample.keeper = { ...scene.sample.keeper, mode: 'dive', shotIndex: 3, reactionAt: 1.9,
    launchPosition: { x: 48, y: 0 }, target: { x: 52.61, y: -2.6, height: .4 } };
  scene.draw(2.3);
  assert.ok(scene.bone('Head').sub(scene.bone('Hips')).normalize().z < -.65, 'the new shot reaches the opposite side');
  scene.frame.contacts = [{ type: 'keeperDistribution', fromId: 91, time: 2.4, kind: 'throw' }];
  scene.sample.keeper.mode = 'distribution';
  scene.draw(2.7);
  const throwing = await keeperScene({ keeper: { mode: 'distribution', reactionAt: null } });
  throwing.frame.contacts = scene.frame.contacts;
  throwing.draw(2.7);
  for (const name of Object.keys(throwing.points())) assert.ok(scene.bone(name).distanceTo(throwing.bone(name)) < 1e-6,
    `${name}: the actual throw is not blocked by a stale dive`);
  scene.draw(40);
  assert.ok(scene.bone('Hips').y > .8, 'a long skip cannot leave the keeper lying down');
});

test('a second reaction starts from the visible grounded pose, including a cold scene rebuild', async () => {
  const scene = await keeperScene();
  scene.draw(1.8);
  let previous = scene.points(), maximumJump = 0;
  scene.sample.keeperPresentation = { previousSave: { reactionAt: 1, time: 1.4,
    fromPos: { x: 48, y: 0 }, toPos: { x: 52.61, y: 2.6 }, height: .4 } };
  scene.sample.keeper = { ...scene.sample.keeper, reactionAt: 2, mode: 'reacting', shotIndex: 4,
    target: { x: 52.61, y: -2.6, height: .4 } };
  for (let index = 0; index < 85; index++) {
    scene.draw(1.8 + index / 120);
    const points = scene.points();
    for (const name of Object.keys(points)) maximumJump = Math.max(maximumJump, points[name].distanceTo(previous[name]));
    previous = points;
  }
  assert.ok(maximumJump < .13, `a second shot cannot reset a grounded keeper to standing (${maximumJump})`);
  const rebuilt = await keeperScene({ keeper: scene.sample.keeper });
  rebuilt.sample.keeperPresentation = scene.sample.keeperPresentation;
  rebuilt.draw(2.08); scene.draw(2.08);
  for (const name of Object.keys(rebuilt.points())) assert.ok(scene.bone(name).distanceTo(rebuilt.bone(name)) < 1e-6);
});
