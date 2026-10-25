// The footballer mesh faces outwards everywhere (V7.9.8). Tubes built downwards (thighs, shins), along +x
// (the left arm) or heel to toe (boots) used to come out inside-out: the near side was culled and the
// outline pass painted over it, so shorts and socks looked dark grey and one sleeve looked swollen.
// Checked on the bind pose: every triangle's normal points away from the bone it hangs on.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname, '..', 'dist');

test('footballer mesh: every body part faces outwards (shorts, socks, sleeves, boots)', async () => {
  const THREE = await import(path.join(dist, 'vendor/three/three.module.min.js'));
  const { loadRig } = await import(path.join(dist, 'newview/rig.js'));
  const { buildFootballerGeometry, bindPositions, PART } = await import(path.join(dist, 'newview/footballer.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(dist, 'assets/models/footballer-rig.json'), 'utf8')));
  const skeleton = rig.newInstance().skeleton, P = bindPositions(skeleton);
  // bone segments the surface wraps round (a point's nearest one is its axis)
  const pairs = [['Hips', 'Spine2'], ['Spine2', 'Neck'], ['Neck', 'Head']];
  for (const L of ['Left', 'Right']) pairs.push([L + 'Arm', L + 'ForeArm'], [L + 'ForeArm', L + 'Hand'], [L + 'UpLeg', L + 'Leg'], [L + 'Leg', L + 'Foot'], [L + 'Foot', L + 'ToeBase']);
  const segs = pairs.filter(([a, b]) => P[a] && P[b]).map(([a, b]) => [P[a], P[b]]);
  // nearest bone segment: its closest point and direction
  const near = c => {
    let best = null, bd = Infinity;
    for (const [a, b] of segs) {
      const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / ab.lengthSq())), q = a.clone().addScaledVector(ab, t);
      const d = q.distanceTo(c); if (d < bd) { bd = d; best = { q, dir: ab.normalize() }; }
    }
    return best;
  };
  for (const style of [{ hair: 'short' }, { hair: 'bald', keeper: true }]) {
    const g = buildFootballerGeometry(skeleton, style), pos = g.attributes.position, part = g.attributes.part, idx = g.index.array;
    const bad = {}, all = {}, v = [0, 1, 2].map(() => new THREE.Vector3());
    for (let i = 0; i < idx.length; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx[i + k]);
      const n = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
      if (n.lengthSq() < 1e-14) continue;
      const c = v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1 / 3), q = near(c);
      // the side of a tube only (caps and the ends of joints face along the bone)
      if (Math.abs(n.clone().normalize().dot(q.dir)) > 0.5) continue;
      // (the two thighs overlap at the crotch: there the nearest bone is the other leg's)
      if (Math.abs(c.x) < 0.03 && c.y < 0.95) continue;
      const pid = Math.round(part.getX(idx[i])), name = Object.keys(PART).find(k => PART[k] === pid);
      all[name] = (all[name] || 0) + 1;
      if (n.dot(c.clone().sub(q.q)) < 0) bad[name] = (bad[name] || 0) + 1;
    }
    if (process.env.MESH_DEBUG) console.log(JSON.stringify(style), JSON.stringify(Object.fromEntries(Object.keys(all).map(k => [k, ((bad[k] || 0) / all[k] * 100).toFixed(1) + "% of " + all[k]]))));
    for (const name of ['shirt', 'shorts', 'socks', 'sockTrim', 'boot']) {
      const share = (bad[name] || 0) / (all[name] || 1);
      assert.ok(all[name] > 20, `${name} faces checked`);
      assert.ok(share < 0.03, `${JSON.stringify(style)} ${name}: ${(share * 100).toFixed(1)}% of ${all[name]} faces point inwards`);
    }
  }
});
