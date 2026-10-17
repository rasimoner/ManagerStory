// The broadcast camera of the new view: where it wants to be for the current shot (tv, stand, close-up,
// shot) and how it eases there. Shared by the page and the tests, so the tests watch the real camera.
import * as THREE from '../vendor/three/three.module.min.js';

export function createBroadcastCamera(camera) {
  const pos = new THREE.Vector3(-8, 12, 26), look = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let wantFov = 46, cut = true, lastMode = null, lastSide = null;
  function shot(rt, cam, aspect) {
    const b = rt.ball.p, tall = aspect < 1.25, { mode, a, b: o } = cam;
    if (mode === 'close' && a && o) {
      const d = o.pos.clone().sub(a.pos).setY(0); if (d.lengthSq() < 1e-4) d.set(1, 0, 0); d.normalize();
      const side = new THREE.Vector3(-d.z, 0, d.x);
      // the camera stays on the near (TV) side; when the two players stand along the pitch's length
      // it keeps the side it is on instead of flipping across with every small step
      if (lastSide && Math.abs(side.z) < 0.35) { if (side.dot(lastSide) < 0) side.negate(); } else if (side.z < 0) side.negate();
      lastSide = side.clone();
      wantPos.copy(a.pos).addScaledVector(d, -4.8).addScaledVector(side, 2.6).setY(2.0);
      wantLook.copy(a.pos).lerp(o.pos, 0.55).setY(0.8); wantFov = tall ? 52 : 40;
    } else if (mode === 'close' && a) {
      wantPos.copy(a.pos).add(new THREE.Vector3(-Math.sign(a.pos.x || 1) * 4.5, 2.6, 6.5)); wantLook.copy(a.pos).setY(1.1); wantFov = tall ? 50 : 38;
    } else if (mode === 'shot' && a) {
      const gx = Math.sign(o ? o.pos.x : a.pos.x || 1) * 52.5, g = new THREE.Vector3(gx, 0, 0).sub(a.pos).setY(0).normalize();
      const side = new THREE.Vector3(-g.z, 0, g.x); if (side.z < 0) side.negate();
      wantPos.copy(a.pos).addScaledVector(g, -5.4).addScaledVector(side, 1.6).setY(2.0); wantLook.copy(a.pos).addScaledVector(g, 9).setY(1.0); wantFov = tall ? 54 : 42;
    } else if (mode === 'stand') {
      // high angle from the pitch side, the crowd wall behind the ball (corner and touchline views)
      const sz = Math.sign(b.z || -1), sx = Math.abs(b.x) > 36 ? Math.sign(b.x) : 0;
      const back = new THREE.Vector3(-sx * 0.8, 0, -sz).normalize();
      wantPos.copy(b).addScaledVector(back, tall ? 20 : 24).setY(tall ? 17 : 15);
      wantPos.x = Math.max(-56, Math.min(56, wantPos.x)); wantPos.z = Math.max(-36, Math.min(36, wantPos.z));
      wantLook.set(b.x + sx * 4, 2, b.z + sz * 6); wantFov = tall ? 50 : 38;
    } else {
      const back = tall ? 19 : 30, z = Math.min(b.z + back, 45), lift = b.z + back - z;
      wantPos.set(b.x - 2, (tall ? 10.5 : 14) + lift * 0.9, z); wantLook.set(b.x + 2, 0, b.z - 2); wantFov = tall ? 46 : 34;
    }
  }
  const api = {
    pos, look, cutFrame: false,
    cut() { cut = true; },
    // eases towards the shot in real time, as a TV operator would
    update(rt, cam, dtReal, aspect) {
      shot(rt, cam, aspect);
      // a new shot far from the current one is a cut, as a director would make it, not a fast swing
      if (cam.mode !== lastMode && lastMode != null && pos.distanceTo(wantPos) > 12) cut = true;
      lastMode = cam.mode;
      const k = 1 - Math.exp(-dtReal * (cam.mode === 'stand' ? 1.8 : cam.mode === 'shot' ? 2.4 : 3));
      api.cutFrame = cut || pos.distanceTo(wantPos) > 30;
      if (cut || pos.distanceTo(wantPos) > 30) { pos.copy(wantPos); look.copy(wantLook); camera.fov = wantFov; cut = false; }
      else { pos.lerp(wantPos, k); look.lerp(wantLook, k); camera.fov += (wantFov - camera.fov) * k; }
      camera.aspect = aspect; camera.updateProjectionMatrix();
      camera.position.copy(pos); camera.lookAt(look);
    },
  };
  return api;
}
