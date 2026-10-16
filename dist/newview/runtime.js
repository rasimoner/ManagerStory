// Shared pitch runtime: footballers, ball physics, locomotion, actions and keeper dives.
// Used by the real-match director. No DOM.
import * as THREE from '../vendor/three/three.module.min.js';
import { buildFootballerGeometry, buildNumberGeometry } from './footballer.js';
import { ACTIONS, applyAction, envelope, rigOf, footClearance } from './actions.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
export const GOAL_X = 52.5, BALL_R = 0.11, G = 9.81, ROLL_K = 1.1, AIR_K = 0.06;
// Recorded full-body motions (Quaternius UAL, CC0) played over the locomotion blend.
// contact: seconds into the clip where the foot/head meets the ball.
export const MOTIONS = {
  tackle: { contact: 0.36, fadeIn: 0.1, fadeOut: 0.22, slideEnd: 1.15 },
  header: { contact: 0.4, fadeIn: 0.08, fadeOut: 0.3, takeoff: 0.12, land: 0.72, lift: 0.4 },
  cheer: { fadeIn: 0.3, fadeOut: 0.5 },
};
const LOCO = ['idle', 'walk', 'run', 'sprint'];
// engine coordinates are pitch percent: x along the length, y across
export const toWorld = p => V((p[0] / 100 - 0.5) * 105, 0, (p[1] / 100 - 0.5) * 68);

export function analyseGait(source, clip) {
  const mixer = new THREE.AnimationMixer(source);
  const act = mixer.clipAction(clip); act.play();
  const toe = source.getObjectByName('LeftToeBase');
  const fallback = { walk: 1.6, run: 3.4, sprint: 6.5 }[clip.name] ?? 2;
  if (!toe) { act.stop(); return { speed: fallback, dur: clip.duration, off: 0, dist: fallback * clip.duration }; }
  const N = 90, smp = [], w = V();
  for (let i = 0; i <= N; i++) {
    const t = clip.duration * i / N; mixer.setTime(t); source.updateMatrixWorld(true);
    toe.getWorldPosition(w); smp.push({ t, y: w.y, z: w.z });
  }
  const minY = Math.min(...smp.map(s => s.y)), v = [];
  for (let i = 1; i < smp.length; i++) if (smp[i].y < minY + 0.035 && smp[i - 1].y < minY + 0.035) v.push(-(smp[i].z - smp[i - 1].z) / (smp[i].t - smp[i - 1].t));
  v.sort((a, b) => a - b);
  const speed = Math.max(0.6, Math.abs(v[Math.floor(v.length / 2)] || fallback));
  const tPlant = smp.reduce((a, b) => b.y < a.y ? b : a).t;
  act.stop(); mixer.uncacheRoot(source);
  return { speed, dur: clip.duration, off: tPlant / clip.duration, dist: speed * clip.duration };
}

function kitMaterial(kit, skin, hair, ramp) {
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: ramp });
  const C = c => new THREE.Color(c);
  const pal = [C(skin), C(kit.shirt), C(kit.trim), C(kit.shorts), C(kit.socks), C(kit.sockTrim), C(kit.boot), C(kit.sole), C(hair), C('#16120f'), C(kit.glove || skin)];
  const u = { kPal: { value: pal }, kStripe: { value: C(kit.stripe || kit.shirt) }, kStripes: { value: kit.stripes || 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float part;\nvarying float vPart;\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = part; vBind = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying float vPart; varying vec3 vBind; uniform vec3 kPal[11]; uniform vec3 kStripe; uniform float kStripes;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      int pid = int(vPart + 0.5);
      vec3 kc = kPal[pid];
      if (pid == 1 && kStripes > 0.5) kc = mix(kc, kStripe, step(0.5, fract(vBind.x * 7.0 + 0.25)));
      vec4 diffuseColor = vec4(kc, opacity);`);
  };
  m.customProgramCacheKey = () => 'footballer-kit-v2';
  return m;
}

const SKINS = ['#f0c8a8', '#e0b08f', '#c58c64', '#a8714b', '#8d5a3b', '#6b4430'];
const HAIRS = ['#1f1712', '#3b2416', '#0f0f10', '#6b4a2b', '#c9a165', '#2a1d14'];
const HAIR_STYLES = ['short', 'buzz', 'short', 'long', 'short', 'bald', 'buzz', 'short'];
// stable per-player look from the player id
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// cadence: step-rate multiplier while running (1 = the recorded clips' natural rate)
// stride: how far the legs open at jogging pace (1 = the recorded jog, which opens wider than the
// sprint; smaller is more compact). Full sprint keeps the recorded opening.
export function createRuntime({ scene, rig, gait, ramp, numberTexture, cadence = 1, stride = 1 }) {
  const clips = rig.clips;
  const template = rig.newInstance();
  // the jog cycle's average pose per limb bone: a compact stride swings less far either side of it
  const COMPACT = { LeftUpLeg: 1, RightUpLeg: 1, LeftLeg: 0.6, RightLeg: 0.6, LeftArm: 0.6, RightArm: 0.6, LeftForeArm: 0.5, RightForeArm: 0.5 };
  const jogMean = {};
  if (stride < 1) {
    const m = new THREE.AnimationMixer(template.group), a = m.clipAction(clips.run); a.play();
    const acc = Object.fromEntries(Object.keys(COMPACT).map(b => [b, new THREE.Vector4()]));
    for (let i = 0; i < 60; i++) {
      m.setTime(clips.run.duration * i / 60);
      for (const b in COMPACT) {
        const q = template.bones[b].quaternion, v = acc[b], s = v.x * q.x + v.y * q.y + v.z * q.z + v.w * q.w < 0 ? -1 : 1;
        v.x += s * q.x; v.y += s * q.y; v.z += s * q.z; v.w += s * q.w;
      }
    }
    for (const b in COMPACT) jogMean[b] = new THREE.Quaternion(acc[b].x, acc[b].y, acc[b].z, acc[b].w).normalize();
    a.stop(); m.uncacheRoot(template.group);
  }
  const geoCache = new Map();
  const geometryFor = style => {
    const key = JSON.stringify(style);
    if (!geoCache.has(key)) geoCache.set(key, buildFootballerGeometry(template.skeleton, style));
    return geoCache.get(key);
  };
  const numberGeo = buildNumberGeometry(template.skeleton);
  const players = [];
  const S = { t: 0 };
  // allowOut: only the engine may put the ball out of play (wide shot, goal, ballOut event)
  const ball = { p: V(0, BALL_R, 0), v: V(), owner: null, allowOut: false, out: false, keptIn: 0 };

  function addPlayer(d) {
    const inst = rig.newInstance(), model = inst.group, identity = new THREE.Matrix4();
    const h = hash(d.key);
    const style = { hair: HAIR_STYLES[h % HAIR_STYLES.length], build: 0.95 + (h >> 4) % 4 * 0.035, keeper: !!d.keeper };
    const body = new THREE.SkinnedMesh(geometryFor(style), kitMaterial(d.kit, SKINS[(h >> 8) % SKINS.length], HAIRS[(h >> 12) % HAIRS.length], ramp));
    body.castShadow = true; body.frustumCulled = false; body.layers.enable(1);
    model.add(body); body.bind(inst.skeleton, identity);
    if (numberTexture) {
      const nm = new THREE.MeshBasicMaterial({ map: numberTexture(d.no, d.kit), transparent: true, alphaTest: .4, depthWrite: false });
      nm.userData.outlineParameters = { visible: false };
      const num = new THREE.SkinnedMesh(numberGeo, nm); num.frustumCulled = false;
      model.add(num); num.bind(inst.skeleton, identity);
    }
    scene.add(model);
    const mixer = new THREE.AnimationMixer(model), A = {};
    for (const k of LOCO) { A[k] = mixer.clipAction(clips[k]); A[k].play(); A[k].setEffectiveWeight(0); }
    for (const k of Object.keys(MOTIONS)) if (clips[k]) { A[k] = mixer.clipAction(clips[k]); A[k].play(); A[k].setEffectiveWeight(0); }
    const p = Object.assign({
      model, mixer, A, bones: inst.bones, body,
      pos: V(), vel: V(), heading: 0, target: V(), want: 0, face: null, faceLock: false,
      phase: (h % 1000) / 1000, idleT: (h % 300) / 100, lean: 0, lastTouch: -9,
      act: null, motion: null, loops: { jockey: 0, keeperReady: 0, throwHold: 0 }, loopsWant: { jockey: 0, keeperReady: 0, throwHold: 0 },
      warp: null, dive: null, ground: 0, busy: false,
    }, d);
    p.toes = [p.bones.LeftToeBase, p.bones.RightToeBase];
    players.push(p); return p;
  }

  // measured once: where the kicking toe / the keeper's hands are at the contact frame
  let toeAt = {}, diveReach = 1.85, diveFwd = 0.3, slideToe = V(0, 0, 1.1), headAt = V(0, 2.1, 0.1);
  // entry speed kept into the drop, then the slide dies away on the grass
  const slideProfile = t => 1 - smooth(t, 0.18, MOTIONS.tackle.slideEnd);
  function calibrate() {
    const probe = players[0];
    const at = (name, u, bones) => {
      const m = probe.model, sp = m.position.clone(), sr = m.rotation.clone();
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
      probe.A.idle.time = 0; probe.A.idle.setEffectiveWeight(1); probe.A.walk.setEffectiveWeight(0); probe.A.run.setEffectiveWeight(0); probe.A.sprint.setEffectiveWeight(0);
      probe.mixer.update(0); applyAction(probe.bones, name, u, 1); m.updateMatrixWorld(true);
      const out = V(); bones.forEach(b => out.add(probe.bones[b].getWorldPosition(V()))); out.multiplyScalar(1 / bones.length);
      out.y -= footClearance(probe.bones);
      m.position.copy(sp); m.rotation.copy(sr); return out;
    };
    toeAt = {
      pass: at('pass', ACTIONS.pass.contact, ['RightToeBase']).add(V(-0.02, 0, 0.05)),
      shot: at('shot', ACTIONS.shot.contact, ['RightToeBase']).add(V(0, 0, 0.06)),
    };
    // recorded motions: the sliding boot and the forehead at their contact frames
    const atMotion = (name, bones) => {
      const m = probe.model, sp = m.position.clone(), sr = m.rotation.clone();
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
      for (const k of LOCO) probe.A[k].setEffectiveWeight(0);
      probe.A[name].setEffectiveWeight(1); probe.A[name].time = MOTIONS[name].contact; probe.mixer.update(0); m.updateMatrixWorld(true);
      const pts = bones.map(b => probe.bones[b].getWorldPosition(V()));
      probe.A[name].setEffectiveWeight(0); m.position.copy(sp); m.rotation.copy(sr);
      return pts;
    };
    if (probe.A.tackle) slideToe = atMotion('tackle', ['LeftToeBase', 'RightToeBase']).reduce((a, b) => (b.z > a.z ? b : a));
    if (probe.A.header) { const [h] = atMotion('header', ['Head']); headAt = h.add(V(0, 0.1 + MOTIONS.header.lift, 0.08)); }
    const hands = at('diveRight', ACTIONS.diveRight.contact, ['LeftHand', 'RightHand']);
    diveReach = Math.hypot(hands.x, hands.y); diveFwd = hands.z;
  }

  function place(p, w, heading) {
    p.pos.set(w.x, 0, w.z); p.vel.set(0, 0, 0); p.target.copy(p.pos); if (heading !== undefined) p.heading = heading;
    p.want = 0; p.act = null; p.motion = null; p.warp = null; p.dive = null; p.faceLock = false;
    p.loopsWant.jockey = p.loopsWant.keeperReady = p.loopsWant.throwHold = 0; p.loops.jockey = p.loops.keeperReady = p.loops.throwHold = 0;
  }
  function startAction(p, name, delay = 0) { p.act = { name, t0: S.t + delay }; p.motion = null; }
  function startMotion(p, name, delay = 0, extra = {}) {
    if (!p.A[name]) return false;
    p.motion = { name, t0: S.t + delay, dur: clips[name].duration, ...extra }; p.act = null;
    p.loopsWant.jockey = p.loopsWant.keeperReady = 0;
    return true;
  }
  const motionEl = p => (p.motion ? S.t - p.motion.t0 : -1);
  function motionAtContact(p) { return !p.motion || motionEl(p) >= MOTIONS[p.motion.name].contact; }
  // where the boot (slide) or forehead (header) of a motion is on its contact frame
  function contactPoint(p) {
    const off = p.motion?.name === 'tackle' ? slideToe : p.motion?.name === 'header' ? headAt : null;
    return off ? off.clone().applyAxisAngle(V(0, 1, 0), p.heading).add(p.pos) : null;
  }
  // how far a point is from what plays the ball: the whole outstretched leg in a slide (hip to boot),
  // the forehead in a header
  function contactDistance(p, pt) {
    const tip = contactPoint(p); if (!tip) return Infinity;
    if (p.motion?.name !== 'tackle') return tip.distanceTo(pt);
    const a = p.pos.clone().setY(0.1), ab = tip.clone().sub(a), k = clamp(pt.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    return a.addScaledVector(ab, k).distanceTo(pt);
  }
  // sliding tackle at a spot: the entry speed is chosen so the leading boot gets there on the contact frame
  // `spot` may be a function (where the ball will be on the contact frame): the slide steers onto it
  function slideAt(p, spot, delay = 0) {
    const at = typeof spot === 'function' ? spot : () => spot;
    const s0 = at(MOTIONS.tackle.contact), dir = V(s0.x - p.pos.x, 0, s0.z - p.pos.z).normalize();
    p.heading = Math.atan2(dir.x, dir.z);
    const ok = startMotion(p, 'tackle', delay, { dir, v0: 4, at });
    if (ok) steerSlide(p, 0);
    return ok;
  }
  // travel still to come before the contact frame, per 1 m/s of entry speed
  function slideLeft(el) { let r = 0; for (let t = Math.max(0, el); t < MOTIONS.tackle.contact; t += 1 / 240) r += slideProfile(t) / 240; return r; }
  function steerSlide(p, el) {
    const m = p.motion, c = MOTIONS.tackle.contact; if (el >= c) return;
    const spot = m.at(c - el), left = slideLeft(el);
    const root = V(spot.x, 0, spot.z).sub(slideToe.clone().setY(0).applyAxisAngle(V(0, 1, 0), p.heading));
    const need = root.sub(p.pos); need.y = 0;
    const d = need.length(); if (d < 1e-3) return;
    const want = Math.atan2(need.x, need.z), dh = Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading));
    p.heading += clamp(dh, -0.05, 0.05);                       // small corrections only: he is already committed
    m.dir.set(Math.sin(p.heading), 0, Math.cos(p.heading));
    m.v0 = clamp(d * Math.cos(dh) / Math.max(left, 0.02), 0.3, 8.5);
  }
  // header jump: the forehead meets the ball at `spot` (height included) on the contact frame
  function headerAt(p, spot, heading, delay = 0) {
    const off = headAt.clone().setY(0).applyAxisAngle(V(0, 1, 0), heading);
    return startMotion(p, 'header', delay, { from: null, to: V(spot.x, 0, spot.z).sub(off), spot: V(spot.x, 0, spot.z), heading });
  }
  function actionDone(p) { return !p.act || S.t - p.act.t0 >= ACTIONS[p.act.name].dur; }
  function actionAtContact(p) { const a = ACTIONS[p.act?.name]; return a && S.t - p.act.t0 >= a.dur * (a.contact ?? 0.5); }

  function predictBall(t) {
    const f = (1 - Math.exp(-ROLL_K * t)) / ROLL_K;
    return V(ball.p.x + ball.v.x * f, BALL_R, ball.p.z + ball.v.z * f);
  }
  // move the root so the kicking toe meets the ball at the action's contact frame
  // where the root must be on the contact frame for the kicking toe to meet the ball
  function kickPlan(p, name, dir) {
    const a = ACTIONS[name], tc = a.dur * a.contact;
    const ballAt = ball.p.y > BALL_R + 0.05 ? ball.p.clone() : predictBall(tc);
    const h = Math.atan2(dir.x, dir.z);
    const toe = toeAt[name].clone().applyAxisAngle(V(0, 1, 0), h);
    return { to: ballAt.sub(toe).setY(0), h, tc };
  }
  // how far the kick may still move the body: about a running step over the wind-up
  const kickReach = name => 3.4 * ACTIONS[name].dur * ACTIONS[name].contact;
  function kickNeed(p, name, dir) { const k = kickPlan(p, name, dir); return { dist: Math.hypot(k.to.x - p.pos.x, k.to.z - p.pos.z), to: k.to, reach: kickReach(name) }; }
  function kickWarp(p, name, dir) {
    const k = kickPlan(p, name, dir);
    p.heading = k.h;
    // carry only his speed towards the plant spot into the step (a sideways drift would make it swerve)
    const along = V(k.to.x - p.pos.x, 0, k.to.z - p.pos.z), len = along.length();
    const v0 = len > 1e-3 ? along.multiplyScalar(clamp(p.vel.dot(along) / len, 0, 4) / len) : V();
    p.warp = { from: p.pos.clone(), to: k.to, t0: S.t, tc: k.tc, v0 };
  }
  function toeNear(p, maxD) {
    let best = null;
    for (const toe of p.toes) {
      const w = toe.getWorldPosition(V());
      const d = Math.hypot(w.x - ball.p.x, w.z - ball.p.z);
      if (d < maxD && w.y < 0.4 && (!best || d < best.d)) best = { d, w };
    }
    return best;
  }
  function kickGround(to, arrive = 3) {
    const d = Math.hypot(to.x - ball.p.x, to.z - ball.p.z);
    // a driven pass, not a cannon shot: past ~26 m/s it simply arrives slower
    ball.v.set(to.x - ball.p.x, 0, to.z - ball.p.z).normalize().multiplyScalar(Math.min(26, arrive + ROLL_K * d));
    ball.owner = null;          // a bouncing ball played on keeps its height and drops
  }
  // a ball taken into the hands travels there over a moment instead of popping into them
  function pickUp(hands, blend = 0.35) {
    const from = ball.p.clone(), t0 = S.t;
    return () => { const h = hands(), k = smooth(S.t - t0, 0, blend); return from.clone().lerp(h, k); };
  }
  function kickAir(to, flight) {
    // air drag (see stepBall) is allowed for, so the ball really arrives at `to` after `flight` s
    const k = AIR_K, f = k / (1 - Math.exp(-k * flight));
    ball.v.set((to.x - ball.p.x) * f, (to.y - ball.p.y + G * flight / k) * f - G / k, (to.z - ball.p.z) * f);
    ball.owner = null;
  }
  function dribble(p, goal, speed) {
    // run with the ball, not at it: aim a little past it towards where he is taking it, so he
    // keeps his pace between touches instead of braking onto the ball every time
    const g = V(goal.x - ball.p.x, 0, goal.z - ball.p.z), gl = g.length(); if (gl > 1e-3) g.multiplyScalar(1 / gl);
    const ballAhead = (ball.p.x - p.pos.x) * g.x + (ball.p.z - p.pos.z) * g.z;      // ball in front of him along his line
    const lead = ball.p.clone().addScaledVector(ball.v, 0.22).addScaledVector(g, ballAhead > 0.25 ? Math.min(1.2, gl) : -0.3);
    p.target.set(lead.x, 0, lead.z); p.want = speed; p.face = null; p.faceLock = false;
    if (ball.out) return false;
    const touch = toeNear(p, 0.34);
    const ahead = Math.sin(p.heading) * (ball.p.x - p.pos.x) + Math.cos(p.heading) * (ball.p.z - p.pos.z);
    if (S.t - p.lastTouch > 0.3 && ((touch && ahead > 0.05) || Math.hypot(ball.p.x - p.pos.x, ball.p.z - p.pos.z) < 0.42)) {
      const dir = V(goal.x - ball.p.x, 0, goal.z - ball.p.z);
      const d = dir.length(); dir.normalize();
      const pace = Math.min(Math.max(p.vel.length(), 2.2) + 1.5, 1.2 + d * ROLL_K);
      ball.v.copy(dir).multiplyScalar(pace); ball.v.y = 0;
      p.lastTouch = S.t; return true;
    }
    return false;
  }
  // meet the ball on its line and cushion it
  function receive(p, spot) {
    const toBall = Math.hypot(ball.p.x - p.pos.x, ball.p.z - p.pos.z);
    const slowBall = Math.hypot(ball.v.x, ball.v.z) < 1.5 && ball.p.y < 0.5;
    // wait at the spot the pass is played to, unless the ball has already gone past it (then go after it)
    const passed = spot && (ball.v.x * (spot.x - ball.p.x) + ball.v.z * (spot.z - ball.p.z) < 0);
    const meet = toBall < 10 || slowBall || !spot || passed ? ball.p.clone().addScaledVector(ball.v, Math.min(0.5, toBall / 12)) : spot;
    // close in at pace, slow down to take it: a ball rolling away is sprinted after
    const away = (ball.v.x * (ball.p.x - p.pos.x) + ball.v.z * (ball.p.z - p.pos.z)) / Math.max(toBall, 0.01);
    p.target.set(meet.x, 0, meet.z); p.want = toBall < 4 ? 4 : toBall < 10 && away < 2 ? 6 : 7.4; p.face = ball.p;
    if (ball.p.y > 1.6 || ball.out) return false;
    const touch = toeNear(p, 0.48);
    if (touch || toBall < 0.55) {
      // cushioned: a ball taken on the chest or thigh drops to his feet, it is not snapped down
      ball.v.multiplyScalar(0.1).add(V(Math.sin(p.heading), 0, Math.cos(p.heading)).multiplyScalar(1.4));
      ball.v.y = ball.p.y > BALL_R + 0.05 ? -0.5 : 0;
      ball.owner = p; p.lastTouch = S.t; return true;
    }
    return false;
  }

  // keeper dive: roll towards the ball's side so the gloves reach where it crosses his line
  function planDive(gk, at, tArrive, save) {
    const reaction = 0.12;
    const h0 = gk.heading, R = V(-Math.cos(h0), 0, Math.sin(h0)), F = V(Math.sin(h0), 0, Math.cos(h0));
    const rel = at.clone().sub(gk.pos);
    let d = rel.dot(R); const side = d >= 0 ? 1 : -1; d = Math.abs(d);
    // the gloves reach out in front of the body: step the body that much short of the ball
    const h = Math.max(0.15, at.y), fwd = clamp(rel.dot(F) - diveFwd, -0.6, 1.2);
    const tc = Math.max(0.22, tArrive - reaction);
    const reach = save ? diveReach : diveReach * 0.82;           // a beaten keeper falls just short
    const r = clamp(Math.atan2(d, h), 0.25, 1.6);
    const off = Math.hypot(d, h) - reach;
    // a dive is explosive but human: the body covers at most about 6.5 m/s on average to the ball
    const slide = Math.min(Math.max(-0.2, off * Math.sin(r)), 6.5 * tc);
    gk.dive = { start: S.t + reaction, tc, roll: r * side, slide: slide * side, lift: Math.min(Math.max(0, off * Math.cos(r)), 0.9),
      base0: gk.pos.clone(), base: gk.pos.clone().addScaledVector(F, fwd), save, done: false };
    startAction(gk, side > 0 ? 'diveRight' : 'diveLeft');
    gk.act.t0 = S.t + reaction + tc - ACTIONS.diveRight.dur * ACTIONS.diveRight.contact;
    gk.loopsWant.keeperReady = 0;
  }
  function updateDive(gk) {
    const D = gk.dive; if (!D) return;
    const k = clamp((S.t - D.start) / D.tc, 0, 1), e = 1 - Math.pow(1 - k, 1.5);   // explosive start, peak 1.5x the average
    let roll = D.roll * e, slide = D.slide * e, lift = D.lift * e;
    if (k >= 1) {
      const f = clamp((S.t - D.start - D.tc) / 0.45, 0, 1), sgn = Math.sign(D.roll) || 1;
      roll = lerp(D.roll, 1.45 * sgn, f); slide = D.slide + f * 0.35 * sgn; lift = lerp(D.lift, 0, f);
      // back on his feet after a short lie
      const up = clamp((S.t - D.start - D.tc - 1.3) / 0.9, 0, 1), g = up * up * (3 - 2 * up);
      roll *= 1 - g; lift *= 1 - g;
      if (up >= 1) {
        const right = V(-Math.cos(gk.heading), 0, Math.sin(gk.heading));
        gk.pos.copy(D.base).addScaledVector(right, slide); gk.dive = null; if (gk.act?.name.startsWith('dive')) gk.act = null; return;
      }
    }
    D.cur = { roll, slide, lift, base: D.base0.clone().lerp(D.base, e) };
  }
  // where the gloves will be on the dive's contact frame (the same pose and body transform pose() uses)
  function diveHands(gk) {
    const D = gk.dive, name = gk.act?.name; if (!D || !name) return handsOf(gk);
    const probe = players.find(q => q !== gk) || gk, m = probe.model, sp = m.position.clone(), sq = m.quaternion.clone();
    m.position.set(0, 0, 0); m.quaternion.identity();
    for (const k of LOCO) probe.A[k].setEffectiveWeight(0); probe.A.idle.setEffectiveWeight(1); probe.A.idle.time = 0;
    for (const k of Object.keys(MOTIONS)) if (probe.A[k]) probe.A[k].setEffectiveWeight(0);
    probe.mixer.update(0); applyAction(probe.bones, name, ACTIONS[name].contact, 1); m.updateMatrixWorld(true);
    const local = probe.bones.LeftHand.getWorldPosition(V()).add(probe.bones.RightHand.getWorldPosition(V())).multiplyScalar(0.5);
    m.position.copy(sp); m.quaternion.copy(sq); m.updateMatrixWorld(true);
    const right = V(-Math.cos(gk.heading), 0, Math.sin(gk.heading));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, gk.heading, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), D.roll));
    return D.base.clone().addScaledVector(right, D.slide).add(V(0, D.lift + 0.13 * Math.abs(Math.sin(D.roll)), 0)).add(local.applyQuaternion(q));
  }
  function handsOf(gk) { return gk.bones.LeftHand.getWorldPosition(V()).add(gk.bones.RightHand.getWorldPosition(V())).multiplyScalar(0.5); }

  // --- movement ---
  const tmp = V();
  function move(p, dt) {
    if (p.warp) {
      // carries on from his running speed into the plant (Hermite: no restart from standstill)
      const w = p.warp, k = clamp((S.t - w.t0) / w.tc, 0, 1), k2 = k * k, k3 = k2 * k;
      const prev = p.pos.clone();
      p.pos.copy(w.from).multiplyScalar(2 * k3 - 3 * k2 + 1).addScaledVector(w.to, -2 * k3 + 3 * k2).addScaledVector(w.v0, (k3 - 2 * k2 + k) * w.tc);
      p.vel.copy(p.pos).sub(prev).multiplyScalar(1 / Math.max(dt, 1e-4));
      if (k >= 1) { p.warp = null; p.vel.multiplyScalar(0.5); }
      return;
    }
    if (p.dive) { p.vel.set(0, 0, 0); return; }
    const el = motionEl(p);
    if (p.motion && el >= 0 && el < p.motion.dur) {
      const m = p.motion, prev = p.pos.clone();
      if (m.name === 'tackle') { steerSlide(p, el); p.vel.copy(m.dir).multiplyScalar(m.v0 * slideProfile(el)); p.pos.addScaledVector(p.vel, dt); }
      else if (m.name === 'header' && m.to) {
        if (!m.from) {
          m.from = p.pos.clone();
          // a jump can step in a little, not glide: if he is still far, he jumps from where he got to
          const gap = m.to.clone().sub(m.from); gap.y = 0;
          if (gap.length() > 1.6) { m.to = m.from.clone().addScaledVector(gap.normalize(), 1.6); m.capped = true; }
        }
        const c = MOTIONS.header.contact;
        const dh = Math.atan2(Math.sin(m.heading - p.heading), Math.cos(m.heading - p.heading));
        p.heading += clamp(dh, -8 * dt, 8 * dt);
        // keep the forehead on the ball's spot while he is still turning into it
        if (!m.capped) m.to.copy(m.spot).sub(headAt.clone().setY(0).applyAxisAngle(V(0, 1, 0), p.heading));
        p.pos.lerpVectors(m.from, m.to, smooth(el, 0, c));
        p.vel.copy(p.pos).sub(prev).multiplyScalar(1 / Math.max(dt, 1e-4));
      } else { p.vel.multiplyScalar(Math.exp(-6 * dt)); p.pos.addScaledVector(p.vel, dt); }
      p.pos.x = clamp(p.pos.x, -58, 58); p.pos.z = clamp(p.pos.z, -37, 37);
      p.lean = lerp(p.lean, 0, Math.min(1, dt * 6));
      return;
    }
    if (p.motion && el >= p.motion.dur) p.motion = null;
    const to = tmp.copy(p.target).sub(p.pos); to.y = 0;
    const d = to.length();
    const want = Math.min(p.want, d > 0.05 ? Math.sqrt(2 * 5 * Math.max(0, d - 0.12)) : 0);
    const desired = d > 1e-3 ? to.multiplyScalar(want / d) : to.set(0, 0, 0);
    const acc = desired.length() > p.vel.length() ? 6 : 9;
    const dv = desired.sub(p.vel), m = dv.length();
    if (m > acc * dt) dv.multiplyScalar(acc * dt / m);
    p.vel.add(dv);
    const sp = p.vel.length();
    p.pos.addScaledVector(p.vel, dt);
    p.pos.x = clamp(p.pos.x, -58, 58); p.pos.z = clamp(p.pos.z, -37, 37);
    let face = p.heading;
    if (p.faceLock && p.face) face = Math.atan2(p.face.x - p.pos.x, p.face.z - p.pos.z);
    else if (sp > 0.45) face = Math.atan2(p.vel.x, p.vel.z);
    else if (p.face) face = Math.atan2(p.face.x - p.pos.x, p.face.z - p.pos.z);
    const dh = Math.atan2(Math.sin(face - p.heading), Math.cos(face - p.heading));
    const turn = clamp(dh, -(sp > 4.5 ? 3 : 6) * dt, (sp > 4.5 ? 3 : 6) * dt);
    p.heading += turn;
    p.lean = lerp(p.lean, clamp(-turn / Math.max(dt, 1e-4) * sp * 0.012, -0.16, 0.16), Math.min(1, dt * 6));
  }

  const qNod = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), xAxis = V(1, 0, 0);
  function pose(p, dt) {
    const sp = p.vel.length(), Wk = gait.walk, R = gait.run, Sp = gait.sprint;
    const along = sp > 0.05 ? (p.vel.x * Math.sin(p.heading) + p.vel.z * Math.cos(p.heading)) / sp : 1;
    const dirSign = along < -0.25 ? -1 : 1;       // moving against the facing plays the cycle backwards
    const wIdle = 1 - smooth(sp, 0.1, 0.65);
    const fwd = dirSign < 0 ? 0 : 1;
    // the open (CC0) jog clip is a long-striding run: full weight from ~3 m/s, cadence kept
    // natural at football speeds by shortening its stride up to 30% (a little foot slip, no shuffle)
    const r = clamp((sp - 1.4) / 1.8, 0, 1) * fwd;
    const r2 = clamp((sp - 6.2) / 1.6, 0, 1) * fwd;
    const runDist = R.dist * clamp(sp / R.speed, 0.7, 1), sprintDist = Sp.dist * clamp(sp / Sp.speed, 0.75, 1);
    const cycle = lerp(lerp(Wk.dist, runDist, r), sprintDist, r2) / (1 + (cadence - 1) * r);
    if (sp > 0.05) p.phase = ((p.phase + dirSign * dt * sp / cycle) % 1 + 1) % 1;
    p.idleT += dt;
    p.A.idle.time = p.idleT % clips.idle.duration;
    p.A.walk.time = ((p.phase + Wk.off) % 1) * Wk.dur;
    p.A.run.time = ((p.phase + R.off) % 1) * R.dur;
    p.A.sprint.time = ((p.phase + Sp.off) % 1) * Sp.dur;
    const m = 1 - wIdle;
    // a recorded motion takes over the whole body, fading in and out of the locomotion blend
    let mw = 0, mel = 0;
    if (p.motion) {
      const M = MOTIONS[p.motion.name]; mel = S.t - p.motion.t0;
      if (mel >= p.motion.dur) p.motion = null;
      else if (mel >= 0) {
        mw = Math.min(smooth(mel, 0, M.fadeIn), 1 - smooth(mel, p.motion.dur - M.fadeOut, p.motion.dur));
        p.A[p.motion.name].time = mel;
      }
    }
    for (const k of Object.keys(MOTIONS)) if (p.A[k]) p.A[k].setEffectiveWeight(p.motion?.name === k ? mw : 0);
    const lw = 1 - mw;
    p.A.idle.setEffectiveWeight(lw * wIdle); p.A.walk.setEffectiveWeight(lw * m * (1 - r)); p.A.run.setEffectiveWeight(lw * m * r * (1 - r2)); p.A.sprint.setEffectiveWeight(lw * m * r * r2);
    p.mixer.update(0);
    // compact stride at jogging pace: only the jog clip's share is reined in, the sprint stays open
    const compact = stride < 1 ? lw * m * r * (1 - r2) * (1 - stride) * (1 - smooth(sp, 5.5, 7.8)) : 0;
    if (compact > 0.005) for (const b in COMPACT) {
      const k = 1 - compact * COMPACT[b];
      p.bones[b].quaternion.copy(qTmp.copy(jogMean[b]).slerp(p.bones[b].quaternion, k));
    }
    let lift = 0;
    if (p.motion?.name === 'header' && mw > 0) {
      const H = MOTIONS.header, u = clamp((mel - H.takeoff) / (H.land - H.takeoff), 0, 1);
      lift = 4 * H.lift * u * (1 - u);
      // the nod: head and shoulders snap through the ball at contact
      const nod = 0.42 * Math.exp(-(((mel - H.contact) / 0.07) ** 2)) - 0.22 * Math.exp(-(((mel - H.contact + 0.13) / 0.08) ** 2));
      p.bones.Spine2.quaternion.multiply(qNod.setFromAxisAngle(xAxis, nod * 0.6 * mw));
      p.bones.Neck.quaternion.multiply(qNod.setFromAxisAngle(xAxis, nod * 0.7 * mw));
    }
    let groundW = 0;
    for (const k of ['jockey', 'keeperReady', 'throwHold']) {
      p.loops[k] = lerp(p.loops[k], p.loopsWant[k], Math.min(1, dt * 5));
      const w = p.loops[k] * (1 - mw);
      if (w > 0.01) { applyAction(p.bones, k, 0, w); groundW = Math.max(groundW, w); }
    }
    if (p.act) {
      const a = ACTIONS[p.act.name], el = S.t - p.act.t0;
      if (el >= 0) {
        if (el > a.dur) p.act = null;
        else { const w = envelope(a, el); applyAction(p.bones, p.act.name, el / a.dur, w); if (a.mask === 'all') groundW = Math.max(groundW, w); }
      }
    }
    p.model.position.copy(p.pos); p.model.position.y += lift;
    p.model.rotation.set(0, p.heading, p.lean);
    if (p.dive && p.dive.cur) {
      const c = p.dive.cur, right = V(-Math.cos(p.heading), 0, Math.sin(p.heading));
      p.model.position.copy(c.base).addScaledVector(right, c.slide).add(V(0, c.lift + 0.13 * Math.abs(Math.sin(c.roll)), 0));
      p.model.quaternion.setFromEuler(new THREE.Euler(0, p.heading, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), c.roll));
      groundW = 0;
    }
    p.model.updateMatrixWorld(true);
    if (groundW > 0.01) p.ground = lerp(p.ground, -footClearance(p.bones) * groundW, Math.min(1, dt * 12));
    else if (compact > 0.005) p.ground = lerp(p.ground, Math.max(0, -footClearance(p.bones)), Math.min(1, dt * 12));   // a straighter leg would dig in
    else p.ground = lerp(p.ground, 0, Math.min(1, dt * 8));
    if (Math.abs(p.ground) > 1e-4) { p.model.position.y += p.ground; p.model.updateMatrixWorld(true); }
  }

  function contacts() {
    const fast = ball.v.length() > 10 || ball.p.y > 1.2 || ball.through > S.t;     // (a shot on its way to the keeper's gloves)
    for (const p of players) {
      if (p.dive || fast || p.warp || ball.held || S.dead) continue;   // kick approaches reach the ball; a dead ball is not kicked about
      const dx = ball.p.x - p.pos.x, dz = ball.p.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) {
        const nx = d > 1e-4 ? dx / d : Math.sin(p.heading), nz = d > 1e-4 ? dz / d : Math.cos(p.heading);
        if (!ball.allowOut && ((Math.abs(ball.p.x) > GOAL_X - 0.6 && nx * ball.p.x > 0) || (Math.abs(ball.p.z) > 33.4 && nz * ball.p.z > 0))) continue;
        ball.p.x = p.pos.x + nx * 0.3; ball.p.z = p.pos.z + nz * 0.3;
        const along = ball.v.x * nx + ball.v.z * nz, push = p.vel.length() * 1.05;
        if (along < push) { ball.v.x += nx * (push - along); ball.v.z += nz * (push - along); }
      }
    }
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i], c = players[j]; if (a.dive || c.dive) continue;
      const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      // bodies ease apart (a few cm a step) instead of being thrown apart in one frame
      if (d < 0.68 && d > 1e-4) { const k = Math.min(0.68 - d, 0.012) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; c.pos.x += dx * k; c.pos.z += dz * k; }
    }
  }
  function stepBall(dt) {
    if (ball.held) { ball.p.copy(ball.held()); ball.v.set(0, 0, 0); return; }
    ball.p.addScaledVector(ball.v, dt);
    if (ball.p.y > BALL_R + 1e-3 || ball.v.y > 0) {
      ball.v.y -= G * dt; ball.v.multiplyScalar(Math.exp(-AIR_K * dt));
      if (ball.p.y < BALL_R) { ball.p.y = BALL_R; ball.v.y = ball.v.y < -1.2 ? -ball.v.y * 0.5 : 0; ball.v.x *= 0.8; ball.v.z *= 0.8; }
    } else {
      ball.p.y = BALL_R; ball.v.y = 0;
      const k = Math.exp(-ROLL_K * dt); ball.v.x *= k; ball.v.z *= k;
    }
    if (!ball.allowOut) keepIn(dt);
    if (Math.abs(ball.p.x) > 57) { ball.p.x = Math.sign(ball.p.x) * 57; ball.v.x *= -0.2; }
    if (Math.abs(ball.p.z) > 37) { ball.p.z = Math.sign(ball.p.z) * 37; ball.v.z *= -0.2; }
    const inGoal = Math.abs(ball.p.x) > GOAL_X && Math.abs(ball.p.z) < 3.66 && ball.p.y < 2.44;
    ball.out = !inGoal && (Math.abs(ball.p.x) > GOAL_X + BALL_R || Math.abs(ball.p.z) > 34 + BALL_R);
  }
  // While the engine says the ball is in play it must stay in play: a ball rolling towards a line
  // loses pace so it dies just inside it, the way an over-hit touch stops on the chalk.
  function keepIn(dt) {
    const LX = GOAL_X - 0.35, LZ = 34 - 0.35;
    for (const [ax, L] of [['x', LX], ['z', LZ]]) {
      const pos = ball.p[ax], vel = ball.v[ax], s = Math.sign(pos);
      if (Math.abs(pos) > L) { ball.p[ax] -= s * Math.min(Math.abs(pos) - L, 0.04); if (vel * s > 0) ball.v[ax] = 0; ball.keptIn++; continue; }   // eased back, never snapped
      const outward = vel * s;
      if (outward <= 0) continue;
      const room = Math.max(0.05, L - Math.abs(pos));
      if (ball.p.y < 0.35) {
        const natural = outward / ROLL_K;                     // where grass friction alone would stop it
        if (natural > room) ball.v[ax] = s * Math.max(0, outward - (outward * outward / (2 * room)) * dt);
      } else if (outward * 0.6 > room) {
        ball.v[ax] = s * room / 0.6;                          // a dropping ball lands inside
      }
    }
  }

  return {
    players, ball, S, addPlayer, calibrate, place, startAction, actionDone, actionAtContact, predictBall, kickWarp, kickNeed, toeNear, pickUp,
    startMotion, motionAtContact, slideAt, headerAt, contactPoint, contactDistance, get headHeight() { return headAt.y; }, get slideReach() { return Math.hypot(slideToe.x, slideToe.z); },
    kickGround, kickAir, dribble, receive, planDive, updateDive, handsOf, diveHands, move, pose, contacts, stepBall,
    get diveReach() { return diveReach; },
  };
}
