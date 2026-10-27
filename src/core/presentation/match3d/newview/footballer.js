// Stylized footballer mesh, generated in the bind (T-pose) space of our own
// skeleton so the recorded clips drive it directly. One geometry, one draw call;
// a per-vertex "part" id selects skin / shirt / shorts / socks / boots / hair.
import * as THREE from 'three';

export const PART = { skin: 0, shirt: 1, trim: 2, shorts: 3, socks: 4, sockTrim: 5, boot: 6, sole: 7, hair: 8, dark: 9, glove: 10 };

const SEG = 14;

export function boneIndex(skeleton) {
  const map = {};
  skeleton.bones.forEach((b, i) => { map[b.name] = i; });
  return map;
}

export function bindPositions(skeleton) {
  const out = {}, m = new THREE.Matrix4();
  skeleton.bones.forEach((b, i) => {
    m.copy(skeleton.boneInverses[i]).invert();
    out[b.name] = new THREE.Vector3().setFromMatrixPosition(m);
  });
  return out;
}

export function buildFootballerGeometry(skeleton, style = {}) {
  const B = boneIndex(skeleton), P = bindPositions(skeleton);
  const hair = style.hair ?? 'short';          // 'short' | 'buzz' | 'long' | 'bald'
  const build = style.build ?? 1;              // 0.94 slim .. 1.06 broad
  const keeper = !!style.keeper;

  const pos = [], skinI = [], skinW = [], part = [], idx = [];
  const W = (pairs) => {
    // normalise up to four [boneName, weight] pairs
    const list = pairs.filter(p => p[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = list.reduce((s, p) => s + p[1], 0) || 1;
    const i4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
    list.forEach((p, k) => { i4[k] = B[p[0]]; w4[k] = p[1] / sum; });
    return [i4, w4];
  };
  const vert = (v, weights, pid) => {
    pos.push(v.x, v.y, v.z); skinI.push(...weights[0]); skinW.push(...weights[1]); part.push(pid);
    return pos.length / 3 - 1;
  };

  // A loft: rings of SEG vertices around a centre line, joined into a tube, capped at both ends.
  // ring = { c, u, v, ru, rv, w:[[bone,weight]...], part, partFn?(angle) }
  function loft(rings, capStart = true, capEnd = true) {
    // V7.9.9: the part id is flat per triangle (runtime.js), so where one part meets the next (shirt to sleeve
    // hem, skin to sock top, a hem stepping over the waistband) the edge is drawn as a ring of its own, half
    // way between the two: a clean line where the blend used to sit, not the triangles' saw teeth
    const split = [];
    rings.forEach((r, i) => {
      const n = rings[i + 1];
      split.push(r);
      if (!n || r.partFn || n.partFn || r.part === n.part || (r.c.distanceToSquared(n.c) < 1e-10 && Math.abs(r.ru - n.ru) < 1e-9 && Math.abs(r.rv - n.rv) < 1e-9)) return;
      const mid = part => ({ c: r.c.clone().lerp(n.c, 0.5), u: r.u, v: r.v, ru: (r.ru + n.ru) / 2, rv: (r.rv + n.rv) / 2, w: Object.entries([...r.w, ...n.w].reduce((m, [b, x]) => (m[b] = (m[b] || 0) + x / 2, m), {})), part });
      split.push(mid(r.part), mid(n.part));
    });
    rings = split;
    const ids = rings.map(r => {
      const wts = W(r.w), row = [];
      for (let k = 0; k < SEG; k++) {
        const a = k / SEG * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const p = r.c.clone().addScaledVector(r.u, ca * r.ru).addScaledVector(r.v, sa * r.rv);
        row.push(vert(p, wts, r.partFn ? r.partFn(a, ca, sa) : r.part));
      }
      return row;
    });
    // V7.9.8: the faces must point out of the tube whichever way it runs. A tube drawn downwards (thighs,
    // shins), along +x (the left arm) or heel to toe (boots) used to come out inside-out: the near side was
    // culled and the outline pass painted it, so shorts and socks showed as dark grey and a sleeve looked swollen
    const along = rings[Math.min(1, rings.length - 1)].c.clone().sub(rings[0].c);
    const out = along.lengthSq() < 1e-12 || along.cross(rings[0].v).dot(rings[0].u) >= 0;
    for (let i = 0; i < ids.length - 1; i++) for (let k = 0; k < SEG; k++) {
      const a = ids[i][k], b = ids[i][(k + 1) % SEG], c = ids[i + 1][k], d = ids[i + 1][(k + 1) % SEG];
      if (out) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const cap = (row, r, flip, dir) => {
      const c = vert(r.c.clone().addScaledVector(dir, Math.min(r.ru, r.rv) * .55), W(r.w), r.part);
      if (!out) flip = !flip;
      for (let k = 0; k < SEG; k++) { const a = row[k], b = row[(k + 1) % SEG]; flip ? idx.push(c, a, b) : idx.push(c, b, a); }
    };
    if (capStart) { const r0 = rings[0], r1 = rings[1]; cap(ids[0], r0, true, r0.c.clone().sub(r1.c).normalize()); }
    if (capEnd) { const r0 = rings.at(-1), r1 = rings.at(-2); cap(ids.at(-1), r0, false, r0.c.clone().sub(r1.c).normalize()); }
  }

  // Ellipsoid with optional per-vertex part function on the unit direction.
  function ellipsoid(c, r, w, pid, partFn, rows = 10) {
    const wts = W(w), start = pos.length / 3, cols = SEG;
    for (let i = 0; i <= rows; i++) {
      const th = i / rows * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (let k = 0; k < cols; k++) {
        const ph = k / cols * Math.PI * 2;
        const d = new THREE.Vector3(st * Math.cos(ph), ct, st * Math.sin(ph));
        vert(new THREE.Vector3(c.x + d.x * r.x, c.y + d.y * r.y, c.z + d.z * r.z), wts, partFn ? partFn(d) : pid);
      }
    }
    for (let i = 0; i < rows; i++) for (let k = 0; k < cols; k++) {
      const a = start + i * cols + k, b = start + i * cols + (k + 1) % cols, c2 = a + cols, d = b + cols;
      idx.push(a, b, c2, b, d, c2);
    }
  }

  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const b = build;

  // ---- torso: pelvis to collar, elliptical sections along the spine ----
  const spineW = y => y < P.Spine.y ? [['Hips', 1 - sm(P.Hips.y, P.Spine.y, y) * .5], ['Spine', sm(P.Hips.y, P.Spine.y, y) * .5]]
    : y < P.Spine1.y ? [['Spine', 1 - sm(P.Spine.y, P.Spine1.y, y) * .5], ['Spine1', sm(P.Spine.y, P.Spine1.y, y) * .5], ['Hips', .0]]
    : y < P.Spine2.y ? [['Spine1', 1 - sm(P.Spine1.y, P.Spine2.y, y) * .5], ['Spine2', sm(P.Spine1.y, P.Spine2.y, y) * .5]]
    : y < 1.47 ? [['Spine2', 1]] : [['Spine2', .55], ['Neck', .45]];
  const T = (y, rx, rz, pid, zc = 0) => ({ c: v3(0, y, zc), u: X, v: Z, ru: rx * b, rv: rz * b, w: spineW(y), part: pid });
  loft([
    T(0.86, .085, .07, PART.shorts, .0),
    T(0.90, .158, .112, PART.shorts, .005),
    T(0.99, .160, .110, PART.shorts, .008),
    T(1.005, .158, .108, PART.shorts, .008),
    T(1.005, .170, .121, PART.shirt, .008),     // shirt hem sits over the waistband
    T(1.10, .156, .112, PART.shirt, .010),
    T(1.22, .170, .120, PART.shirt, .016),
    T(1.32, .188, .126, PART.shirt, .016),
    T(1.405, .198, .118, PART.shirt, .006),
    T(1.455, .165, .098, PART.shirt, -.004),
    T(1.49, .085, .072, PART.shirt, -.012),
    T(1.505, .066, .062, PART.trim, -.012),     // collar
  ], true, false);

  // ---- neck and head ----
  loft([
    { c: v3(0, 1.47, -.014), u: X, v: Z, ru: .056, rv: .056, w: [['Neck', 1]], part: PART.skin },
    { c: v3(0, 1.56, -.006), u: X, v: Z, ru: .053, rv: .055, w: [['Neck', .6], ['Head', .4]], part: PART.skin },
    { c: v3(0, 1.63, .002), u: X, v: Z, ru: .05, rv: .052, w: [['Head', 1]], part: PART.skin },
  ], false, false);
  const headC = v3(0, 1.69, .012), headR = v3(.094, .118, .104);
  const hairFn = d => {
    if (hair === 'bald') return PART.skin;
    const top = hair === 'buzz' ? .45 : hair === 'long' ? -.15 : .25;
    const back = hair === 'long' ? .55 : .2;
    if (d.y > top && d.z < .72) return PART.hair;               // crown, stopping above the forehead
    if (d.z < -back && d.y > (hair === 'long' ? -.75 : -.35)) return PART.hair; // back of the head
    if (Math.abs(d.x) > .82 && d.y > .05 && d.z < .25) return PART.hair;   // sideburn area above the ears
    return PART.skin;
  };
  ellipsoid(headC, headR, [['Head', 1]], PART.skin, hairFn, 12);
  if (hair === 'short' || hair === 'long') ellipsoid(v3(0, 1.735, -.004), v3(.098, .085, .1), [['Head', 1]], PART.hair, d => d.y > -.15 && d.z < .78 ? PART.hair : PART.hair, 8);
  for (const s of [-1, 1]) {
    ellipsoid(v3(s * .094, 1.68, .0), v3(.016, .03, .022), [['Head', 1]], PART.skin);                  // ears
    ellipsoid(v3(s * .034, 1.697, .104), v3(.013, .015, .008), [['Head', 1]], PART.dark, null, 6);     // eyes
    ellipsoid(v3(s * .036, 1.727, .106), v3(.024, .006, .009), [['Head', 1]], PART.dark, null, 6);     // brows
  }
  ellipsoid(v3(0, 1.672, .117), v3(.016, .024, .02), [['Head', 1]], PART.skin, null, 6);               // nose
  ellipsoid(v3(0, 1.638, .1), v3(.026, .006, .008), [['Head', 1]], PART.dark, null, 6);                // mouth line

  // ---- arms (built for the left side, mirrored for the right) ----
  for (const s of [1, -1]) {
    const L = s > 0 ? 'Left' : 'Right';
    const sh = P[L + 'Arm'], el = P[L + 'ForeArm'], wr = P[L + 'Hand'];
    const ax = v3(s, 0, 0);
    const up = Y, fw = Z;
    // deltoid under the sleeve
    ellipsoid(v3(sh.x - s * .005, sh.y + .005, sh.z), v3(.072 * b, .07 * b, .068 * b), [[L + 'Arm', .55], ['Spine2', .45]], PART.shirt, null, 8);
    const arm = (t, r, pid, w) => ({ c: sh.clone().lerp(el, t), u: up, v: fw, ru: r * b, rv: r * .95 * b, w, part: pid });
    const armW = t => [[L + 'Arm', 1 - sm(.75, 1, t) * .5], [L + 'ForeArm', sm(.75, 1, t) * .5], [L + 'Shoulder', (1 - sm(0, .2, t)) * .35]];
    loft([
      arm(0.0, .066, PART.shirt, armW(0)),
      arm(0.30, .062, PART.shirt, armW(.3)),
      arm(0.44, .06, PART.trim, armW(.44)),
      arm(0.46, .06, PART.trim, armW(.46)),
      arm(0.46, .047, PART.skin, armW(.46)),      // sleeve edge steps down to the arm
      arm(0.75, .045, PART.skin, armW(.75)),
      arm(1.0, .041, PART.skin, armW(1)),
    ], false, true);
    const fa = (t, r) => ({ c: el.clone().lerp(wr, t), u: up, v: fw, ru: r, rv: r * .9, w: [[L + 'ForeArm', 1 - sm(.8, 1, t) * .5], [L + 'Hand', sm(.8, 1, t) * .5], [L + 'Arm', (1 - sm(0, .15, t)) * .4]], part: PART.skin });
    loft([fa(-.04, .043), fa(.3, .045), fa(.7, .036), fa(1, .031)], true, true);
    ellipsoid(el.clone(), v3(.046, .044, .044), [[L + 'ForeArm', .5], [L + 'Arm', .5]], PART.skin, null, 6);
    const handPart = keeper ? PART.glove : PART.skin;
    const hr = keeper ? 1.25 : 1;
    ellipsoid(v3(wr.x + s * .06, wr.y - .004, wr.z + .006), v3(.058 * hr, .022 * hr, .042 * hr), [[L + 'Hand', 1]], handPart, null, 8);
    ellipsoid(v3(wr.x + s * .03, wr.y - .004, wr.z + .045), v3(.026 * hr, .016 * hr, .018 * hr), [[L + 'Hand', 1]], handPart, null, 6); // thumb
    void ax;
  }

  // ---- legs ----
  for (const s of [1, -1]) {
    const L = s > 0 ? 'Left' : 'Right';
    const hip = P[L + 'UpLeg'], knee = P[L + 'Leg'], ank = P[L + 'Foot'], toe = P[L + 'ToeBase'];
    const thighW = t => [[L + 'UpLeg', 1 - sm(.78, 1, t) * .5], [L + 'Leg', sm(.78, 1, t) * .5], ['Hips', (1 - sm(0, .22, t)) * .45]];
    const th = (t, rx, rz, pid, dz = 0) => ({ c: hip.clone().lerp(knee, t).add(v3(s * .006, 0, dz)), u: X, v: Z, ru: rx * b, rv: rz * b, w: thighW(t), part: pid });
    loft([
      th(-.04, .108, .1, PART.shorts, .004),
      th(.25, .11, .104, PART.shorts, .006),
      th(.52, .106, .1, PART.shorts, .004),        // loose shorts hem
      th(.535, .106, .1, PART.trim, .004),
      th(.535, .076, .078, PART.skin, .006),
      th(.7, .068, .07, PART.skin, .008),
      th(.92, .056, .058, PART.skin, .01),
      th(1.0, .054, .056, PART.skin, .01),
    ], true, true);
    ellipsoid(knee.clone().add(v3(0, 0, .012)), v3(.056, .062, .058), [[L + 'Leg', .5], [L + 'UpLeg', .5]], PART.skin, null, 8);
    const shinW = t => [[L + 'Leg', 1 - sm(.85, 1, t) * .5], [L + 'Foot', sm(.85, 1, t) * .5], [L + 'UpLeg', (1 - sm(0, .12, t)) * .45]];
    const sh = (t, r, pid, dz = 0) => ({ c: knee.clone().lerp(ank, t).add(v3(0, 0, dz)), u: X, v: Z, ru: r * .92, rv: r, w: shinW(t), part: pid });
    loft([
      sh(-.05, .052, PART.skin, .008),
      sh(.14, .058, PART.skin, -.006),
      sh(.2, .059, PART.sockTrim, -.008),
      sh(.26, .06, PART.sockTrim, -.008),
      sh(.26, .06, PART.socks, -.008),
      sh(.4, .058, PART.socks, -.01),
      sh(.7, .045, PART.socks, -.002),
      sh(.95, .038, PART.socks, 0),
      sh(1.05, .037, PART.socks, 0),
    ], true, true);
    // boot: heel to toe, flat sole
    const bootW = z => z > toe.z - .01 ? [[L + 'ToeBase', sm(toe.z - .03, toe.z + .02, z)], [L + 'Foot', 1 - sm(toe.z - .03, toe.z + .02, z)]] : [[L + 'Foot', 1]];
    const solePart = (a, ca, sa) => sa < -.55 ? PART.sole : PART.boot;
    const bt = (z, y, hw, hh) => ({ c: v3(ank.x, y, z), u: X, v: Y, ru: hw, rv: hh, w: bootW(z), part: PART.boot, partFn: solePart });
    loft([
      bt(-.085, .062, .036, .05),
      bt(-.06, .066, .046, .062),
      bt(-.02, .062, .05, .062),
      bt(.04, .05, .052, .05),
      bt(.1, .04, .05, .038),
      bt(.15, .033, .044, .03),
      bt(.19, .028, .032, .022),
    ], true, true);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4));
  g.setAttribute('part', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Back number: a small plane over the shirt back, skinned to the upper spine.
export function buildNumberGeometry(skeleton, build = 1) {
  const B = boneIndex(skeleton);
  const g = new THREE.PlaneGeometry(.2, .2, 2, 2);
  g.rotateY(Math.PI);                    // face backwards (-z)
  g.translate(0, 1.27, .014 - .123 * build - .006);
  const n = g.attributes.position.count, si = [], sw = [];
  for (let i = 0; i < n; i++) {
    const y = g.attributes.position.getY(i), t = Math.min(1, Math.max(0, (y - 1.2) / .15));
    si.push(B.Spine1, B.Spine2, 0, 0); sw.push(1 - t, t, 0, 0);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}
