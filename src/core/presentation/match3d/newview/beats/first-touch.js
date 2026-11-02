// A first touch with something special about it: a ball dropping out of the sky killed dead with the boot,
// one cushioned off the chest, and Bergkamp's turn (back to goal, the first touch goes one side of the
// defender and he spins round the other).
// `beat` is the director's beat context (director.js, beatContext).
import { V, clamp } from '../runtime.js';
import { ACTIONS } from '../actions.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp, smooth01, spline } from '../motion-curves.js';
import { toeGap } from './footwork.js';

// the height a long ball is played at for a foot trap, and for chest control
export const TRAP_H = 0.8;
export const CHEST_H = 1.42;

// how fast he goes to the spot he has to be on: a run, then small steps, then still
const settleSpeed = gap => (gap > 2 ? 6.5 : gap > 0.08 ? Math.min(3, 1 + gap * 4) : 0);

// ---- the foot trap: he gets under the ball, lifts the foot to meet it and lets it settle at his feet ----

// the boot goes to where the ball will be at shin height and waits for it there
export function trapBoot({ ball, S }, p) {
  return { Right: { w: ramp(S.t, [0, 0.18, 0.55, 0.75]), at: () => {
    const vy = ball.v.y, y = ball.p.y, g = 9.81, hy = 0.62;
    const tt = y <= hy ? 0 : (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (y - hy)))) / g;
    return ball.p.clone().add(V(ball.v.x * tt, 0, ball.v.z * tt)).setY(Math.max(0.05, Math.min(y, hy) - 0.1)).addScaledVector(forwardOf(p), 0.04);
  } } };
}

// on his way under it: true when he is not under it in time (he plays it as it comes)
function trapApproach(beat, p, k) {
  const { ball, S, hooks } = beat, left = k.tArr - S.t;
  const bv = V(ball.v.x, 0, ball.v.z), sp = bv.length(); if (sp > 0.1) k.f = bv.clone().multiplyScalar(-1 / sp);
  const fw = k.f || forwardOf(p), rr = V(-fw.z, 0, fw.x);
  const arrive = ball.p.clone().addScaledVector(bv, Math.max(0, left)).setY(0);
  p.target.copy(arrive).addScaledVector(fw, -0.5).addScaledVector(rr, -0.12);
  const gap = Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z);
  p.want = settleSpeed(gap); p.face = ball.p; p.faceLock = left < 1.2;
  if (left > 0.35) return false;
  if (gap > 0.6 || p.vel.length() > 2.2) return true;
  k.started = true; ball.through = k.tArr + 0.6; hooks.slow(0.5);
  p.feet = trapBoot(beat, p);
  return false;
}

function trapStep(beat, p, k) {
  const { ball, S } = beat;
  if (!k.started) return trapApproach(beat, p, k);
  const bv = V(ball.v.x, 0, ball.v.z), sp = bv.length(); if (sp > 0.1) k.f = bv.clone().multiplyScalar(-1 / sp);
  if (toeGap(ball, p, 'Right') < 0.22 && ball.v.y < 0 && ball.p.y < 0.8) { k.done = true; return true; }
  return ball.p.y < 0.2 || S.t > k.tArr + 0.3;
}

export function* footTrap(beat, p, { tArr }) {
  const { ball, S, hooks, until, noteSkill } = beat;
  const k = { tArr, started: false, done: false, f: null };
  yield* until(() => trapStep(beat, p, k), tArr - S.t + 0.8);
  if (!k.started) { p.faceLock = false; return false; }
  const audit = { kind: 'trap', toe: +toeGap(ball, p, 'Right').toFixed(3), h: +ball.p.y.toFixed(2), done: k.done };
  ball.v.copy(forwardOf(p)).multiplyScalar(0.4).setY(-0.6); p.lastTouch = S.t;
  noteSkill(audit, p);
  yield* until(() => ball.p.y < 0.2, 0.6);
  hooks.slow(1); p.feet = null; p.faceLock = false;
  return k.done;
}

// ---- chest control: he gets under the dropping ball, leans back and lets it come off his chest to his feet ----

// his chest goes where the ball will arrive (a step back from it, so it meets the chest, not the man)
function chestUnder({ ball }, p, left) {
  const bv = V(ball.v.x, 0, ball.v.z), arrive = ball.p.clone().addScaledVector(bv, Math.max(0, left)).setY(0);
  const chestOff = p.bones.Spine2.getWorldPosition(V()).sub(p.pos).setY(0);
  p.target.copy(arrive).sub(chestOff).addScaledVector(bv.normalize(), 0.1);
  const gap = Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z);
  p.want = settleSpeed(gap); p.face = ball.p; p.faceLock = left < 1.2;
  return gap;
}

// true when he cannot cushion it: not under it in time, not at chest height when it gets to him, or
// dropping too steeply
function chestTooLate({ ball }, p, { gap, left }) {
  if (gap > 0.6 || p.vel.length() > 2.2) return true;
  const yAt = ball.p.y + ball.v.y * left - 4.905 * left * left, vyAt = ball.v.y - 9.81 * left;
  return yAt < 1.15 || yAt > 1.65 || vyAt < -5;
}

function chestStep(beat, p, k) {
  const { ball, S, rt, hooks } = beat, left = k.tArr - S.t;
  const gap = chestUnder(beat, p, left);
  if (!k.started && left <= k.lead) {
    if (chestTooLate(beat, p, { gap, left })) return true;
    rt.startAction(p, 'chest'); k.started = true; hooks.slow(0.5); ball.through = k.tArr + 0.4;    // only the chest plays it
  }
  // the touch: when the ball is at its closest to his chest
  if (k.started) { const d = p.bones.Spine2.getWorldPosition(V()).distanceTo(ball.p); if (d < k.best) k.best = d; else if (S.t > k.tArr - 0.2 && d > k.best + 0.02) return true; }
  return k.started && ball.p.y < 0.6;
}

export function* chestControl(beat, p, { spot, tArr }) {
  const { ball, S, hooks, until, noteSkill, debug } = beat, ca = ACTIONS.chest;
  const k = { tArr, lead: ca.dur * ca.contact, started: false, best: 9 };
  yield* until(() => chestStep(beat, p, k), tArr - S.t + 0.5);
  if (!k.started) { p.faceLock = false; return false; }
  const c = p.bones.Spine2.getWorldPosition(V()), audit = { kind: 'chest', contact: +c.distanceTo(ball.p).toFixed(3), h: +ball.p.y.toFixed(2) };
  if (debug) audit.dbg = { c: c.toArray().map(v => +v.toFixed(2)), b: ball.p.toArray().map(v => +v.toFixed(2)), p: p.pos.toArray().map(v => +v.toFixed(2)), spot: spot.toArray().map(v => +v.toFixed(2)), dt: +(S.t - tArr).toFixed(2), v: +p.vel.length().toFixed(2) };
  // cushioned: the ball drops in front of him
  const fw = forwardOf(p);
  ball.v.set(fw.x * 1.0, -0.4, fw.z * 1.0); p.lastTouch = S.t;
  noteSkill(audit, p);
  yield* until(() => ball.p.y < 0.3, 0.8);
  hooks.slow(1); p.faceLock = false;
}

// ---- Bergkamp's turn (the pirouette) ----

// he comes to the ball, the defender right behind him
function* receiveWithManBehind({ ball, until }, { R, D, toW }) {
  return yield* until(() => {
    const f = V(ball.p.x - R.pos.x, 0, ball.p.z - R.pos.z), d = f.length(); f.normalize();
    R.target.copy(toW).setY(0); R.want = Math.hypot(toW.x - R.pos.x, toW.z - R.pos.z) > 1 ? 5 : 1; R.face = ball.p; R.faceLock = true;
    D.busy = true; D.target.copy(R.pos).addScaledVector(f, -1.15); D.want = 6; D.face = R.pos; D.faceLock = true;
    return d < 2.2 && D.pos.distanceTo(R.pos) < 1.6;
  }, 5);
}

// he spins round the other side: half a turn to his left on an arc past the defender's right
function spinPast({ S }, R, m) {
  const { f, r, R0, h0, ballTo } = m, T = 1.0, t1 = S.t;
  const path = [[R0.x, R0.z], [R0.x - r.x * 0.75 - f.x * 0.35, R0.z - r.z * 0.75 - f.z * 0.35], [R0.x - r.x * 0.7 - f.x * 1.7, R0.z - r.z * 0.7 - f.z * 1.7], [ballTo.x, ballTo.z]];
  R.drive = { heading: t => h0 + Math.PI * smooth01(clamp((t - t1) / (T * 0.8), 0, 1)), pos: t => { const [x, z] = spline(path, smooth01(clamp((t - t1) / T, 0, 1)) * 0.92); return V(x, 0, z); } };
  return { T, t1 };
}

// which side of the defender the ball and the man went (opposite sides: -1), and how close the ball came to him
function* watchSides({ ball, S, until }, { R, D }, m) {
  const { f, r } = m, { T, t1 } = m.spin;
  let minD = 9, ballSide = 0, manSide = 0;
  yield* until(() => {
    minD = Math.min(minD, Math.hypot(ball.p.x - D.pos.x, ball.p.z - D.pos.z));
    const bs = V(ball.p.x - D.pos.x, 0, ball.p.z - D.pos.z), ms = V(R.pos.x - D.pos.x, 0, R.pos.z - D.pos.z);
    if (!ballSide && bs.dot(f) < 0) ballSide = Math.sign(bs.dot(r));
    if (!manSide && ms.dot(f) < 0) manSide = Math.sign(ms.dot(r));
    return S.t - t1 >= T * 0.92;
  }, T + 0.2);
  return { aroundBall: +minD.toFixed(2), sides: ballSide * manSide };
}

// the ball never reached his boot (or the man): no turn, he just goes and gets it
function* noTurn(beat, { R, D, pir }, why) {
  const { S, hooks, stats, chase, setTry } = beat;
  if (why === 'touch') { R.feet = null; R.faceLock = false; D.busy = false; D.faceLock = false; hooks.slow(1); hooks.cam('tv'); stats.lastFail = ['pirouette', 'touch', +S.t.toFixed(1)]; }
  else { D.busy = false; D.faceLock = false; R.faceLock = false; }
  if (pir.tried) setTry('pirouette');
  return yield* chase(R, why === 'touch' ? null : pir.toW);
}

// the left boot meets the ball on its left side and sends it round the defender's left (his right)
function* firstTouchAround(beat, R, m) {
  const { ball, hooks, until } = beat, { f, r, t0 } = m;
  hooks.cam('close', R, m.D); hooks.slow(0.4);
  ball.through = t0 + 2;
  R.feet = { Left: { w: ramp(t0, [0, 0.1, 0.5, 0.65]), at: () => ball.p.clone().addScaledVector(r, -0.12).addScaledVector(f, 0.02).setY(0.06) } };
  return yield* until(() => { R.target.copy(R.pos); R.want = 0; return toeGap(ball, R, 'Left') < 0.22 && V(ball.p.x - R.pos.x, 0, ball.p.z - R.pos.z).dot(f) < 0.55; }, 1.2);
}

export function* pirouetteReceive(beat, R, { toW, pir }) {
  const { ball, S, rt, hooks, chase, later, noteSkill } = beat, D = pir.def, cast = { R, D, pir: { ...pir, toW } };
  if (!(yield* receiveWithManBehind(beat, { R, D, toW }))) return yield* noTurn(beat, cast, 'reach');
  const f = forwardOf(R), r = rightOf(R), R0 = R.pos.clone();
  const m = { f, r, R0, h0: R.heading, t0: S.t, D, ballTo: R0.clone().addScaledVector(f, -2.5).addScaledVector(r, 1.25) };
  if (!(yield* firstTouchAround(beat, R, m))) return yield* noTurn(beat, cast, 'touch');
  const audit = { kind: 'pirouette', touch: +toeGap(ball, R, 'Left').toFixed(3) };
  const dir = m.ballTo.clone().sub(ball.p).setY(0), len = dir.length();
  ball.v.copy(dir.normalize()).multiplyScalar(Math.min(4.6, 1.2 + len * 1.3)); ball.owner = null; R.lastTouch = S.t;
  hooks.cam('tv');            // as he spins past, a close-up behind him would swing round onto the defender
  m.spin = spinPast(beat, R, m);
  rt.startAction(D, 'lungeL'); D.loopsWant.jockey = 0; D.target.copy(D.pos).addScaledVector(r, -0.6); D.want = 2;          // he goes with the man, not the ball
  Object.assign(audit, yield* watchSides(beat, { R, D }, m));
  noteSkill(audit, R);
  R.drive = null; R.feet = null; R.faceLock = false; R.heading = m.h0 + Math.PI;
  hooks.slow(1); hooks.cam('tv');
  rt.startAction(D, 'stumble'); D.want = 0.5;
  later(0.6, () => { D.busy = false; D.faceLock = false; });
  return yield* chase(R, null);
}
