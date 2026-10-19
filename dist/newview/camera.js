// The broadcast camera of the new view: where it wants to be for the current shot (tv, stand, close-up,
// shot) and how it eases there. Shared by the page and the tests, so the tests watch the real camera.
import * as THREE from '../vendor/three/three.module.min.js';

export function createBroadcastCamera(camera) {
  const pos = new THREE.Vector3(-8, 12, 26), look = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let wantFov = 46, cut = true, lastMode = null, lastSide = null;
  let cornerKey = '', cornerPos = null;
  const fit = new THREE.PerspectiveCamera(46, 1, 0.1, 400), V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
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
    } else if (mode === 'stand' && Math.abs(b.x) > 36) {
      // a corner: high from the TV side, the corner flag, the penalty spot and both posts all in the
      // picture (it used to look past the flag into the stand for the whole wait before the kick)
      const sx = Math.sign(b.x), gx = sx * 52.5;
      const near = Math.sign(b.z || 1), pts = [b, V(gx, 2.44, near * 3.66), V(gx, 0, -near * 3.66), V(sx * 41.5, 0, 0)];
      const lo = pts[0].clone(), hi = pts[0].clone(); for (const q of pts) { lo.min(q); hi.max(q); }
      wantLook.copy(lo).add(hi).multiplyScalar(0.5).setY(1);
      wantFov = tall ? 50 : 38;
      // the nearest high view that holds them all, never from inside a stand (worked out once per corner)
      const key = [sx, Math.sign(b.z), Math.round(b.x), Math.round(b.z), tall].join();
      if (key !== cornerKey) {
        cornerKey = key; cornerPos = null;
        fit.fov = wantFov; fit.aspect = aspect; fit.updateProjectionMatrix();
        let best = Infinity;
        for (const el of [0.62, 0.78, 0.95, 1.12]) for (let k = 0; k <= 6; k++) {
          const yaw = k / 6 * 1.4, dir = V(-sx * Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
          for (let d = 12; d < best && d <= 70; d += 1.5) {
            const at = wantLook.clone().addScaledVector(dir, d);
            // never inside a stand: behind the near touchline only above its rows (a gantry), the ends not at all
            if (at.z > 54 || at.z < -38 || Math.abs(at.x) > 57 || at.y > 34 || (at.z > 38 && at.y < 5.5 + (at.z - 38.8) / 0.82 * 0.64)) break;
            fit.position.copy(at); fit.lookAt(wantLook); fit.updateMatrixWorld();
            if (pts.every(q => { const p = q.clone().project(fit); return Math.abs(p.x) < 0.86 && Math.abs(p.y) < 0.8 && p.z < 1; })) { best = d; cornerPos = at; break; }
          }
        }
        if (!cornerPos) cornerPos = wantLook.clone().add(V(-sx * 14, 26, Math.sign(b.z || 1) > 0 ? 6 : 30));
      }
      wantPos.copy(cornerPos);
    } else if (mode === 'stand') {
      // high angle from the TV side of the pitch, the far stand behind the ball (corner and touchline
      // views). It never crosses to the other touchline: that would turn left and right round on screen
      const sz = -1, sx = Math.abs(b.x) > 36 ? Math.sign(b.x) : 0;
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
