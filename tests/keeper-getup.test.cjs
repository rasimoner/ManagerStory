// After the scorpion the keeper gets up off his front (V7.9.8): he pushes up into a crouch and stands, facing
// the way he flew. V7.9.3 rolled him over onto his back first, which on screen read as him turning upside
// down. Checked frame by frame: his chest never turns to the sky, nothing goes into the grass, and the
// recorded get-up carries him from the crouch to his feet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const srcDir = path.join(__dirname, '..', 'src');

test('keeper after the scorpion: up off his front, never rolled onto his back', async () => {
  const THREE = await import('three');
  const { loadRig } = await import(path.join(srcDir, 'core/presentation/match3d/newview/rig.js'));
  const { createRuntime, analyseGait, V } = await import(path.join(srcDir, 'core/presentation/match3d/newview/runtime.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(srcDir, 'assets/models/footballer-rig.json'), 'utf8')));
  const gait = {}; for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
  const rt = createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, numberTexture: null, stride: 0.75 });
  const kit = { shirt: '#ff7a1a', stripe: '#ff7a1a', trim: '#111', shorts: '#111', socks: '#ff7a1a', sockTrim: '#111', boot: '#15171c', sole: '#f2f2f2', stripes: 0, number: '#111', numberEdge: '#fff', glove: '#eee' };
  const gk = rt.addPlayer({ key: 'user:1', id: 1, side: 'user', team: 'user', name: 'Kaleci', role: 'GK', no: 1, kit, keeper: true, moves: ['scorpion'], stars: 1 });
  rt.calibrate();
  const heading = 0.4, dt = 1 / 60;
  rt.place(gk, V(-40, 0, 3), heading);
  // lying face down on his hands and chest, as the scorpion leaves him
  gk.flip = () => ({ pitch: -1.56, lift: -0.82 });
  gk.act = { name: 'scorpion', t0: -99, hold: 1 };   // (the pose he lands in, held)
  for (let i = 0; i < 10; i++) { rt.S.t += dt; rt.pose(gk, dt); }
  const F = V(Math.sin(heading), 0, Math.cos(heading)), chest = () => V(0, 0, 1).applyQuaternion(gk.model.quaternion);
  assert.ok(chest().y < -0.8, 'he starts face down');
  rt.riseFromFront(gk);
  let maxChestUp = -1, low = Infinity, clipAtStand = null, clipAtRise = null;
  for (let i = 0; i < 4 / dt; i++) {
    rt.S.t += dt; rt.updateProne(gk); rt.move(gk, dt); rt.pose(gk, dt);
    gk.model.updateMatrixWorld(true);
    if (gk.prone) maxChestUp = Math.max(maxChestUp, chest().y);
    for (const b of ['Hips', 'Head', 'LeftHand', 'RightHand', 'LeftLeg', 'RightLeg', 'Spine2']) low = Math.min(low, gk.bones[b].getWorldPosition(V()).y);
    const hy = gk.bones.Hips.getWorldPosition(V()).y;
    if (hy > 0.6 && clipAtRise == null) clipAtRise = gk.motion?.name === 'gkGetUp' ? gk.A.gkGetUp.getEffectiveWeight() : 0;
    if (hy > 0.8 && clipAtStand == null) clipAtStand = gk.motion?.name === 'gkGetUp' ? gk.A.gkGetUp.getEffectiveWeight() : 0;
  }
  assert.ok(maxChestUp < 0.35, `his chest never turns to the sky (max ${maxChestUp.toFixed(2)})`);
  assert.ok(low > -0.06, `nothing goes into the grass (lowest ${low.toFixed(3)})`);
  assert.ok(clipAtStand != null && clipAtStand > 0.8, 'the recorded get-up carries him to his feet');
  assert.ok(clipAtRise > 0.8, `he is not tipped up like a board: the recorded get-up has him when his hips rise (${clipAtRise})`);
  assert.equal(gk.prone, null);
  const facing = V(Math.sin(gk.heading), 0, Math.cos(gk.heading));
  assert.ok(facing.dot(F) > 0.95, 'he stands facing the way he flew');
  const hips = gk.bones.Hips.getWorldPosition(V());
  assert.ok(hips.y > 0.85, `standing at the end (hips ${hips.y.toFixed(2)})`);
});
