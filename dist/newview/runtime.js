// Shared pitch runtime: footballers, ball physics, locomotion, actions and keeper dives.
// Used by the real-match director. No DOM.
import * as THREE from '../vendor/three/three.module.min.js';
import { buildFootballerGeometry, buildNumberGeometry } from './footballer.js';
import { ACTIONS, applyAction, envelope, rigOf, footClearance } from './actions.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
export const GOAL_X = 52.5, BALL_R = 0.11, G = 9.81, ROLL_K = 1.1;
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

export function createRuntime({ scene, rig, gait, ramp, numberTexture }) {
  const clips = rig.clips;
  const template = rig.newInstance();
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
    for (const k of ['idle', 'walk', 'run', 'sprint']) { A[k] = mixer.clipAction(clips[k]); A[k].play(); A[k].setEffectiveWeight(0); }
    const p = Object.assign({
      model, mixer, A, bones: inst.bones, body,
      pos: V(), vel: V(), heading: 0, target: V(), want: 0, face: null, faceLock: false,
      phase: (h % 1000) / 1000, idleT: (h % 300) / 100, lean: 0, lastTouch: -9,
      act: null, loops: { jockey: 0, keeperReady: 0, throwHold: 0 }, loopsWant: { jockey: 0, keeperReady: 0, throwHold: 0 },
      warp: null, dive: null, ground: 0, busy: false,
    }, d);
    p.toes = [p.bones.LeftToeBase, p.bones.RightToeBase];
    players.push(p); return p;
  }

  // measured once: where the kicking toe / the keeper's hands are at the contact frame
  let toeAt = {}, diveReach = 1.85;
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
    const hands = at('diveRight', ACTIONS.diveRight.contact, ['LeftHand', 'RightHand']);
    diveReach = Math.hypot(hands.x, hands.y);
  }

  function place(p, w, heading) {
    p.pos.set(w.x, 0, w.z); p.vel.set(0, 0, 0); p.target.copy(p.pos); if (heading !== undefined) p.heading = heading;
    p.want = 0; p.act = null; p.warp = null; p.dive = null; p.faceLock = false;
    p.loopsWant.jockey = p.loopsWant.keeperReady = p.loopsWant.throwHold = 0; p.loops.jockey = p.loops.keeperReady = p.loops.throwHold = 0;
  }
  function startAction(p, name, delay = 0) { p.act = { name, t0: S.t + delay }; }
  function actionDone(p) { return !p.act || S.t - p.act.t0 >= ACTIONS[p.act.name].dur; }
  function actionAtContact(p) { const a = ACTIONS[p.act?.name]; return a && S.t - p.act.t0 >= a.dur * (a.contact ?? 0.5); }

  function predictBall(t) {
    const f = (1 - Math.exp(-ROLL_K * t)) / ROLL_K;
    return V(ball.p.x + ball.v.x * f, BALL_R, ball.p.z + ball.v.z * f);
  }
  // move the root so the kicking toe meets the ball at the action's contact frame
  function kickWarp(p, name, dir) {
    const a = ACTIONS[name], tc = a.dur * a.contact;
    const ballAt = ball.p.y > BALL_R + 0.05 ? ball.p.clone() : predictBall(tc);
    const h = Math.atan2(dir.x, dir.z);
    const toe = toeAt[name].clone().applyAxisAngle(V(0, 1, 0), h);
    p.heading = h;
    p.warp = { from: p.pos.clone(), to: ballAt.sub(toe).setY(0), t0: S.t, tc };
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
    ball.v.set(to.x - ball.p.x, 0, to.z - ball.p.z).normalize().multiplyScalar(arrive + ROLL_K * d);
    ball.p.y = BALL_R; ball.owner = null;
  }
  function kickAir(to, flight) {
    ball.v.set((to.x - ball.p.x) / flight, (to.y - ball.p.y + 0.5 * G * flight * flight) / flight, (to.z - ball.p.z) / flight);
    ball.owner = null;
  }
  function dribble(p, goal, speed) {
    const lead = ball.p.clone().addScaledVector(ball.v, 0.22);
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
    const meet = toBall < 10 || slowBall || !spot ? ball.p.clone().addScaledVector(ball.v, Math.min(0.5, toBall / 12)) : spot;
    p.target.set(meet.x, 0, meet.z); p.want = toBall < 6 ? 4 : 6; p.face = ball.p;
    if (ball.p.y > 1.6 || ball.out) return false;
    const touch = toeNear(p, 0.48);
    if (touch || toBall < 0.55) {
      ball.v.multiplyScalar(0.1).add(V(Math.sin(p.heading), 0, Math.cos(p.heading)).multiplyScalar(1.4)); ball.v.y = 0;
      ball.p.y = Math.min(ball.p.y, 0.6);
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
    const h = Math.max(0.15, at.y), fwd = clamp(rel.dot(F) - 0.1, -0.4, 1.2);
    const tc = Math.max(0.22, tArrive - reaction);
    const reach = save ? diveReach : diveReach * 0.82;           // a beaten keeper falls just short
    const r = clamp(Math.atan2(d, h), 0.25, 1.6);
    const off = Math.hypot(d, h) - reach;
    gk.dive = { start: S.t + reaction, tc, roll: r * side, slide: Math.max(-0.2, off * Math.sin(r)) * side, lift: Math.max(0, off * Math.cos(r)),
      base0: gk.pos.clone(), base: gk.pos.clone().addScaledVector(F, fwd), save, done: false };
    startAction(gk, side > 0 ? 'diveRight' : 'diveLeft');
    gk.act.t0 = S.t + reaction + tc - ACTIONS.diveRight.dur * ACTIONS.diveRight.contact;
    gk.loopsWant.keeperReady = 0;
  }
  function updateDive(gk) {
    const D = gk.dive; if (!D) return;
    const k = clamp((S.t - D.start) / D.tc, 0, 1), e = 1 - (1 - k) * (1 - k);
    let roll = D.roll * e, slide = D.slide * e, lift = D.lift * e;
    if (k >= 1) {
      const f = clamp((S.t - D.start - D.tc) / 0.45, 0, 1), sgn = Math.sign(D.roll) || 1;
      roll = lerp(D.roll, 1.45 * sgn, f); slide = D.slide + f * 0.35 * sgn; lift = lerp(D.lift, 0, f);
      // back on his feet after a short lie
      const up = clamp((S.t - D.start - D.tc - 1.3) / 0.9, 0, 1), g = up * up * (3 - 2 * up);
      roll *= 1 - g; lift *= 1 - g;
      if (up >= 1) {
        const right = V(-Math.cos(gk.heading), 0, Math.sin(gk.heading));
        gk.pos.copy(D.base).addScaledVector(right, slide); gk.dive = null; gk.act = null; return;
      }
    }
    D.cur = { roll, slide, lift, base: D.base0.clone().lerp(D.base, e) };
  }
  function handsOf(gk) { return gk.bones.LeftHand.getWorldPosition(V()).add(gk.bones.RightHand.getWorldPosition(V())).multiplyScalar(0.5); }

  // --- movement ---
  const tmp = V();
  function move(p, dt) {
    if (p.warp) {
      const w = p.warp, k = clamp((S.t - w.t0) / w.tc, 0, 1), e = 1 - Math.pow(1 - k, 2);
      const prev = p.pos.clone();
      p.pos.lerpVectors(w.from, w.to, e);
      p.vel.copy(p.pos).sub(prev).multiplyScalar(1 / Math.max(dt, 1e-4));
      if (k >= 1) { p.warp = null; p.vel.multiplyScalar(0.5); }
      return;
    }
    if (p.dive) { p.vel.set(0, 0, 0); return; }
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
    const cycle = lerp(lerp(Wk.dist, runDist, r), sprintDist, r2);
    if (sp > 0.05) p.phase = ((p.phase + dirSign * dt * sp / cycle) % 1 + 1) % 1;
    p.idleT += dt;
    p.A.idle.time = p.idleT % clips.idle.duration;
    p.A.walk.time = ((p.phase + Wk.off) % 1) * Wk.dur;
    p.A.run.time = ((p.phase + R.off) % 1) * R.dur;
    p.A.sprint.time = ((p.phase + Sp.off) % 1) * Sp.dur;
    const m = 1 - wIdle;
    p.A.idle.setEffectiveWeight(wIdle); p.A.walk.setEffectiveWeight(m * (1 - r)); p.A.run.setEffectiveWeight(m * r * (1 - r2)); p.A.sprint.setEffectiveWeight(m * r * r2);
    p.mixer.update(0);
    let groundW = 0;
    for (const k of ['jockey', 'keeperReady', 'throwHold']) {
      p.loops[k] = lerp(p.loops[k], p.loopsWant[k], Math.min(1, dt * 5));
      if (p.loops[k] > 0.01) { applyAction(p.bones, k, 0, p.loops[k]); groundW = Math.max(groundW, p.loops[k]); }
    }
    if (p.act) {
      const a = ACTIONS[p.act.name], el = S.t - p.act.t0;
      if (el >= 0) {
        if (el > a.dur) p.act = null;
        else { const w = envelope(a, el); applyAction(p.bones, p.act.name, el / a.dur, w); if (a.mask === 'all') groundW = Math.max(groundW, w); }
      }
    }
    p.model.position.copy(p.pos);
    p.model.rotation.set(0, p.heading, p.lean);
    if (p.dive && p.dive.cur) {
      const c = p.dive.cur, right = V(-Math.cos(p.heading), 0, Math.sin(p.heading));
      p.model.position.copy(c.base).addScaledVector(right, c.slide).add(V(0, c.lift + 0.13 * Math.abs(Math.sin(c.roll)), 0));
      p.model.quaternion.setFromEuler(new THREE.Euler(0, p.heading, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), c.roll));
      groundW = 0;
    }
    p.model.updateMatrixWorld(true);
    if (groundW > 0.01) p.ground = lerp(p.ground, -footClearance(p.bones) * groundW, Math.min(1, dt * 12));
    else p.ground = lerp(p.ground, 0, Math.min(1, dt * 8));
    if (Math.abs(p.ground) > 1e-4) { p.model.position.y += p.ground; p.model.updateMatrixWorld(true); }
  }

  function contacts() {
    const fast = ball.v.length() > 10 || ball.p.y > 1.2;
    for (const p of players) {
      if (p.dive || fast || p.warp || ball.held || S.dead) continue;   // kick approaches reach the ball; a dead ball is not kicked about
      const dx = ball.p.x - p.pos.x, dz = ball.p.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) {
        const nx = d > 1e-4 ? dx / d : Math.sin(p.heading), nz = d > 1e-4 ? dz / d : Math.cos(p.heading);
        ball.p.x = p.pos.x + nx * 0.3; ball.p.z = p.pos.z + nz * 0.3;
        const along = ball.v.x * nx + ball.v.z * nz, push = p.vel.length() * 1.05;
        if (along < push) { ball.v.x += nx * (push - along); ball.v.z += nz * (push - along); }
      }
    }
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i], c = players[j]; if (a.dive || c.dive) continue;
      const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.68 && d > 1e-4) { const k = (0.68 - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; c.pos.x += dx * k; c.pos.z += dz * k; }
    }
  }
  function stepBall(dt) {
    if (ball.held) { ball.p.copy(ball.held()); ball.v.set(0, 0, 0); return; }
    ball.p.addScaledVector(ball.v, dt);
    if (ball.p.y > BALL_R + 1e-3 || ball.v.y > 0) {
      ball.v.y -= G * dt; ball.v.multiplyScalar(Math.exp(-0.06 * dt));
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
      if (Math.abs(pos) > L) { ball.p[ax] = s * L; if (vel * s > 0) ball.v[ax] = 0; ball.keptIn++; continue; }
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
    players, ball, S, addPlayer, calibrate, place, startAction, actionDone, actionAtContact, predictBall, kickWarp, toeNear,
    kickGround, kickAir, dribble, receive, planDive, updateDive, handsOf, move, pose, contacts, stepBall,
    get diveReach() { return diveReach; },
  };
}
