// V7.9.9 the dark outline round each player follows his size on screen. The outline effect draws it as a
// fixed share of the screen, so on a wide landscape picture (tribune and broadcast views) a far-away player
// was wrapped in a 4–5 pixel grey halo that swallowed his legs and kit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname, '..', 'dist');

test('player outlines: thin and light far away, full close up, never wider than ~3 px', async () => {
  const THREE = await import(path.join(dist, 'vendor/three/three.module.min.js'));
  const { loadRig } = await import(path.join(dist, 'core/presentation/match3d/newview/rig.js'));
  const { createRuntime, analyseGait, V } = await import(path.join(dist, 'core/presentation/match3d/newview/runtime.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(dist, 'assets/models/footballer-rig.json'), 'utf8')));
  const gait = {}; for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
  const rt = createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, numberTexture: null });
  const kit = { shirt: '#f4c430', stripe: '#f4c430', trim: '#c8102e', shorts: '#c8102e', socks: '#f4c430', sockTrim: '#c8102e', boot: '#15171c', sole: '#f2f2f2', stripes: 0, number: '#fff', numberEdge: '#111' };
  const near = rt.addPlayer({ key: 'user:1', id: 1, side: 'user', team: 'user', name: 'A', role: 'CM', no: 8, kit });
  const far = rt.addPlayer({ key: 'user:2', id: 2, side: 'user', team: 'user', name: 'B', role: 'CM', no: 6, kit });
  rt.place(near, V(0, 0, 0)); rt.place(far, V(0, 0, 0)); near.model.position.set(0, 0, 0); far.model.position.set(0, 0, -60);
  const camera = new THREE.PerspectiveCamera(40, 2532 / 1170, 0.1, 400); camera.position.set(0, 1.2, 4); camera.lookAt(0, 1, -10); camera.updateMatrixWorld(true);
  const W = 2532, H = 1170;      // a phone on its side, device pixels
  rt.scaleOutlines(camera, W, H);
  const px = p => p.body.material.userData.outlineParameters.thickness * Math.max(W, H) / 2;
  const nearPx = px(near), farPx = px(far);
  assert.ok(nearPx > 2.5 && nearPx <= 3.21, `close up: a full outline (${nearPx.toFixed(2)} px)`);
  assert.ok(farPx < 1.2, `far away: a thin one (${farPx.toFixed(2)} px; the fixed outline was ${(0.0042 * W / 2).toFixed(1)} px)`);
  assert.ok(far.body.material.userData.outlineParameters.alpha < near.body.material.userData.outlineParameters.alpha, 'and lighter');
  // the match view and the star transfer scene both scale before the outline pass
  for (const f of ['match3d-newview.js', 'star-transfer-scene.js']) {
    const src = require('./support/game.cjs').readDist(f, dist);
    assert.ok(src.indexOf('rt.scaleOutlines(camera') >= 0 && src.indexOf('rt.scaleOutlines(camera') < src.indexOf('outline.renderOutline('), f);
  }
});
