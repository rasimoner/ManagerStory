// Feints with the ball at the boots: the step-over (with its pass in the middle, the flair pass), the
// elastico and La Croqueta. Each makes the defender go one way while the ball goes the other.
// `beat` is the director's beat context (director.js, beatContext); `duel` is { car, def, closeUp, passTo }.
import { V, clamp } from '../runtime.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp, spline } from '../motion-curves.js';
import { keepOffTouchline, squareUp, toeGap } from './footwork.js';
import { afterBeat } from './duel-exit.js';

const round2 = v => +v.toFixed(2);
const vec2 = v => v.toArray().map(round2);

// the carrier slows to a stand over the ball, square to it; the defender holds his ground
function settleOverBall(beat, duel, { f, t0, carry, through }) {
  const { ball, hooks } = beat, { car, def, closeUp } = duel;
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(carry.slow);
  car.want = 0.4; car.vel.multiplyScalar(carry.vel); ball.v.copy(f).multiplyScalar(carry.roll);
  car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;            // square to the ball through the move
  ball.through = t0 + through;          // his body does not nudge the ball on: only the boots play it during the move
  def.target.copy(def.pos); def.want = 0.5;
}

// ---- step-over: the right boot circles round the front of the ball from inside to out without touching
// it, the left stays planted; the defender buys it and goes that way; the same boot then takes the ball
// back across the other way ----
const STEPOVER_PATH = [[-0.2, -0.1], [0.04, -0.22], [0.27, 0.0], [0.13, 0.3]];

export function stepoverFeet({ ball }, m) {
  const { f, r, t0, b0 } = m;
  const at = (a, l, y = 0.03) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
  const plantL = b0.clone().addScaledVector(r, -0.27).addScaledVector(f, -0.12).setY(0.03); let plantL2 = null;
  return {
    Left: { w: ramp(t0, [0, 0.1, 0.95, 1.1]), at: t => {
      if (t - t0 < 0.52) return plantL;
      // re-planted beside the ball for the take: a short low step, not a slide
      plantL2 ||= ball.p.clone().addScaledVector(r, -0.26).addScaledVector(f, -0.1).setY(0.03);
      const k = clamp((t - t0 - 0.52) / 0.14, 0, 1);
      return plantL.clone().lerp(plantL2, k * k * (3 - 2 * k)).setY(0.03 + 0.07 * Math.sin(Math.PI * k));
    } },
    Right: { w: ramp(t0, [0, 0.08, 0.95, 1.1]), at: t => {
      const u = (t - t0) / 0.5;
      if (u <= 1) { const [a, l] = spline(STEPOVER_PATH, u); return at(a, l, 0.03 + 0.28 * Math.sin(Math.PI * clamp((u - 0.08) / 0.84, 0, 1))); }
      const k = clamp((t - t0 - 0.5) / 0.12, 0, 1);                      // lands outside, then comes back to the ball's right side
      return at(0.13 - 0.13 * k, 0.3 - 0.17 * k, 0.03 + 0.03 * Math.sin(Math.PI * k));
    } },
  };
}

// how far through the circle the boot is (0 … 1 over half a second)
const stepoverPhase = (S, m) => (S.t - m.t0) / 0.5;

// (diagnostics) the first frame the circling boot came close to touching the ball
function noteNearTouch({ ball, S, debug }, car, m) {
  const toe = car.feet.Right.last, { audit } = m, u = stepoverPhase(S, m);
  if (!debug || !toe || audit.close || u <= 0.15 || u >= 0.85 || toe.distanceTo(ball.p) >= 0.12) return;
  audit.close = { u: round2(u), toe: vec2(toe), target: vec2(car.feet.Right.at(S.t)), ball: vec2(ball.p), hip: vec2(car.bones.RightUpLeg.getWorldPosition(V())), car: vec2(car.pos), h: round2(car.heading) };
}

// the circling boot's closest pass and height, and how far the planted boot slides
function watchStepoverBoots({ ball, S }, car, m) {
  const toe = car.feet.Right.last, sup = car.feet.Left.last, { audit, t0 } = m, u = stepoverPhase(S, m);
  if (toe && u > 0.15 && u < 0.85) { audit.minGap = Math.min(audit.minGap, toe.distanceTo(ball.p)); audit.peak = Math.max(audit.peak, toe.y); }
  if (sup && S.t - t0 > 0.12 && S.t - t0 < 0.5) { m.plant0 ||= sup.clone(); audit.plantSlip = Math.max(audit.plantSlip, Math.hypot(sup.x - m.plant0.x, sup.z - m.plant0.z)); }
}

function stepoverCircleStep(beat, duel, m) {
  const { ball, S, rt } = beat, { car, def } = duel, { f, r, t0 } = m;
  noteNearTouch(beat, car, m);
  watchStepoverBoots(beat, car, m);
  if (S.t - t0 > 0.45) { car.target.copy(ball.p).addScaledVector(f, -0.28); car.want = 1.0; }      // a half step to the ball for the take
  if (S.t - t0 > 0.24 && !def.act) { rt.startAction(def, 'lungeL'); def.loopsWant.jockey = 0; def.target.copy(def.pos).addScaledVector(r, 1.3); def.want = 3; }
  return S.t - t0 >= 0.62;
}

// the take: inside of the right boot, back across to his left (a half step more if the ball ran on)
function* stepoverTake(beat, car, m) {
  const { ball, S, until, debug } = beat, { f, t0, audit } = m;
  yield* until(() => { const t = car.feet.Right.last; car.target.copy(ball.p).addScaledVector(f, -0.24); car.want = 1.4; return t && t.distanceTo(ball.p) < 0.24; }, 0.3);
  const toe = car.feet.Right.last; audit.contact = toe ? +toe.distanceTo(ball.p).toFixed(3) : null;
  if (!debug) return;
  const hip = car.bones.RightUpLeg.getWorldPosition(V()), tg = car.feet.Right.at(S.t);
  audit.dbg = { car: vec2(car.pos), ball: vec2(ball.p), toe: toe?.toArray().map(round2), target: vec2(tg), hip: vec2(hip), w: round2(car.feet.Right.w(S.t)), bv: round2(Math.hypot(ball.v.x, ball.v.z)), cv: round2(car.vel.length()), el: round2(S.t - t0) };
}

// the pass in the middle of the move: the defender has gone with the step-over, the take is a pass
function* stepoverPass(beat, duel, m) {
  const { ball, S, rt, hooks, wait, noteSkill } = beat, { car, def, closeUp, passTo } = duel, { audit } = m;
  rt.kickGround(passTo, 4.5, 0.7); car.lastTouch = S.t; audit.kind = 'flairpass';
  if (closeUp) hooks.cam('tv');
  noteSkill(audit, car);
  car.target.copy(car.pos); car.want = 0.5;
  yield* wait(0.3); hooks.slow(1);
  rt.startAction(def, 'stumble'); def.want = 0.5; def.face = ball.p; def.faceLock = true;
  yield* wait(0.3); car.feet = null; car.faceLock = false;
  def.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
  if (closeUp) hooks.cam('tv');
  return true;
}

// the take goes back across him and he is away; the defender is left stumbling
function* stepoverAway(beat, duel, m) {
  const { ball, S, rt, hooks, wait, chase, noteSkill } = beat, { car, def, closeUp } = duel, { f, r, audit } = m;
  const out = f.clone().multiplyScalar(3.1).addScaledVector(r, -2.7);
  keepOffTouchline(car, out);
  ball.v.copy(out); car.lastTouch = S.t; rt.startAction(car, 'cut');
  noteSkill(audit, car);
  car.target.copy(ball.p).addScaledVector(out, 0.5); car.want = 6;
  yield* wait(0.3); hooks.slow(1);
  rt.startAction(def, 'stumble'); def.want = 0.5; def.face = car.pos; def.faceLock = true;
  yield* wait(0.35); car.feet = null; car.faceLock = false;
  def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
  if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
  yield* chase(car, null);
}

export function* stepoverBeat(beat, duel) {
  const { ball, S, rt, gather, until } = beat, { car, def } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.2) return false;
  yield* squareUp(beat, car);
  const m = { f: forwardOf(car), r: rightOf(car), t0: S.t, b0: ball.p.clone(), plant0: null, audit: { kind: 'stepover', minGap: 9, peak: 0, plantSlip: 0 } };
  car.target.copy(car.pos).addScaledVector(m.f, 0.15);
  settleOverBall(beat, duel, { f: m.f, t0: m.t0, carry: { slow: 0.4, vel: 0.35, roll: 0.12 }, through: 1.0 });
  car.feet = stepoverFeet(beat, m);
  rt.startAction(car, 'stepover');
  yield* until(() => stepoverCircleStep(beat, duel, m), 1.2);
  yield* stepoverTake(beat, car, m);
  if (duel.passTo) return yield* stepoverPass(beat, duel, m);
  yield* stepoverAway(beat, duel, m);
}

// ---- elastico: the outside of the right boot pushes the ball out to his right, the same boot wraps round
// it and the inside snaps it back to his left before the defender can turn; the left stays planted ----
const ELASTICO_WRAP = [[-0.02, -0.13], [0.16, -0.06], [0.17, 0.08], [0.0, 0.15]];
const ELASTICO_OUT = 0.2, ELASTICO_BACK = 0.44;                          // push out, snap back in

export function elasticoFeet({ ball }, m) {
  const { f, r, t0, b0 } = m;
  const rel = (a, l, y) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
  const plantL = b0.clone().addScaledVector(r, -0.27).addScaledVector(f, -0.14).setY(0.03);
  // the boot round the ball: from its left side, round the front, to its right side (lifted a touch)
  return {
    Left: { w: ramp(t0, [0, 0.1, 0.9, 1.05]), at: () => plantL },
    Right: { w: ramp(t0, [0, 0.08, 0.9, 1.05]), at: t => {
      const u = t - t0;
      if (u < ELASTICO_OUT) { const k = clamp(u / ELASTICO_OUT, 0, 1); return rel(-0.08 + 0.06 * k, -0.2 + 0.07 * k, 0.04); }       // onto the ball's inside
      if (u < ELASTICO_BACK - 0.04) { const k = (u - ELASTICO_OUT) / (ELASTICO_BACK - 0.04 - ELASTICO_OUT), [a, l] = spline(ELASTICO_WRAP, k); return rel(a, l, 0.05 + 0.08 * Math.sin(Math.PI * k)); }
      return rel(-0.01, 0.13, 0.04);                                                                          // inside of the boot on the ball's right
    } },
  };
}

// the planted boot's slide and how far out the first touch takes the ball
function elasticoWatch({ ball, S }, car, m) {
  const { audit, t0, b0, r } = m;
  return () => {
    const sup = car.feet.Left.last;
    if (sup && S.t - t0 > 0.12) { m.plant0 ||= sup.clone(); audit.plantSlip = Math.max(audit.plantSlip, Math.hypot(sup.x - m.plant0.x, sup.z - m.plant0.z)); }
    audit.out = Math.max(audit.out, V(ball.p.x - b0.x, 0, ball.p.z - b0.z).dot(r));
  };
}

function* elasticoTouches(beat, duel, m) {
  const { ball, S, rt, until, noteSkill } = beat, { car, def } = duel, { f, r, t0, audit } = m;
  const near = () => toeGap(ball, car, 'Right'), watch = elasticoWatch(beat, car, m);
  // 1: out with the outside of the boot
  yield* until(() => { watch(); return S.t - t0 >= ELASTICO_OUT && near() < 0.24; }, ELASTICO_OUT + 0.12);
  audit.touch1 = +near().toFixed(3);
  ball.v.copy(r).multiplyScalar(1.7).addScaledVector(f, 0.35); car.lastTouch = S.t;
  rt.startAction(def, 'lungeL'); def.loopsWant.jockey = 0; def.target.copy(def.pos).addScaledVector(r, 1.4); def.want = 3;
  // 2: round it and back in with the inside
  yield* until(() => { watch(); return S.t - t0 >= ELASTICO_BACK && near() < 0.24; }, ELASTICO_BACK - ELASTICO_OUT + 0.14);
  audit.touch2 = +near().toFixed(3);
  const back = r.clone().multiplyScalar(-4.2).addScaledVector(f, 2.6);
  keepOffTouchline(car, back);
  ball.v.copy(back); car.lastTouch = S.t;
  noteSkill(audit, car);
  car.target.copy(ball.p).addScaledVector(back, 0.5); car.want = 6;
  yield* until(() => { watch(); return S.t - t0 > ELASTICO_BACK + 0.3; }, 0.4);
}

export function* elasticoBeat(beat, duel) {
  const { ball, S, rt, hooks, gather, wait, chase } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.2) return false;
  yield* squareUp(beat, car);
  const m = { f: forwardOf(car), r: rightOf(car), t0: S.t, b0: ball.p.clone(), plant0: null, audit: { kind: 'elastico', plantSlip: 0, out: 0 } };
  car.target.copy(car.pos).addScaledVector(m.r, 0.12);
  settleOverBall(beat, duel, { f: m.f, t0: m.t0, carry: { slow: 0.35, vel: 0.3, roll: 0.1 }, through: 1.1 });
  car.feet = elasticoFeet(beat, m);
  rt.startAction(car, 'elastico');
  yield* elasticoTouches(beat, duel, m);
  hooks.slow(1);
  rt.startAction(def, 'stumble'); def.want = 0.5; def.face = car.pos; def.faceLock = true;
  yield* wait(0.3); car.feet = null; car.faceLock = false;
  def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
  if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
  yield* chase(car, null);
}

// ---- La Croqueta: the inside of the right boot slides the ball across to the left boot, which pushes it
// on past the defender's side, two touches in a blink ----
export function croquetaFeet({ ball }, car, m) {
  const { f, r, t0 } = m;
  const rel = (a, l, y) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
  return {
    Right: { w: ramp(t0, [0, 0.06, 0.32, 0.45]), at: () => rel(-0.02, 0.12, 0.05) },
    Left: { w: ramp(t0, [0, 0.06, 0.62, 0.78]), at: () => m.touched ? rel(-0.1, -0.1, 0.05) : car.pos.clone().addScaledVector(f, 0.1).addScaledVector(r, -0.2).setY(0.03) },
  };
}

function* croquetaTouches(beat, duel, m) {
  const { ball, S, rt, until, noteSkill } = beat, { car, def } = duel, { f, r, t0, audit } = m;
  yield* until(() => S.t - t0 >= 0.12 && toeGap(ball, car, 'Right') < 0.22, 0.3);
  audit.touch1 = +toeGap(ball, car, 'Right').toFixed(3); const b1 = ball.p.clone();
  ball.v.copy(r).multiplyScalar(-2.4).addScaledVector(f, 0.25); car.lastTouch = S.t; m.touched = 1;
  car.target.copy(car.pos).addScaledVector(r, -0.6).addScaledVector(f, 0.15); car.want = 2.2;
  rt.startAction(def, 'lungeL'); def.loopsWant.jockey = 0; def.target.copy(def.pos).addScaledVector(r, 1.1); def.want = 3;
  yield* until(() => S.t - t0 >= 0.3 && toeGap(ball, car, 'Left') < 0.22, 0.32);
  audit.touch2 = +toeGap(ball, car, 'Left').toFixed(3); audit.shift = +(-ball.p.clone().sub(b1).dot(r)).toFixed(3);
  const out = f.clone().multiplyScalar(4.2).addScaledVector(r, -0.9);
  keepOffTouchline(car, out);
  ball.v.copy(out); car.lastTouch = S.t;
  noteSkill(audit, car);
  car.target.copy(ball.p).addScaledVector(out, 0.5); car.want = 6;
}

export function* croquetaBeat(beat, duel) {
  const { S, gather, wait } = beat, { car, def } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.4) return false;
  yield* squareUp(beat, car);
  const m = { f: forwardOf(car), r: rightOf(car), t0: S.t, touched: 0, audit: { kind: 'croqueta' } };
  car.target.copy(car.pos);
  settleOverBall(beat, duel, { f: m.f, t0: m.t0, carry: { slow: 0.4, vel: 0.4, roll: 0.1 }, through: 1.0 });
  car.want = 0.3;
  car.feet = croquetaFeet(beat, car, m);
  yield* croquetaTouches(beat, duel, m);
  yield* wait(0.3);
  yield* afterBeat(beat, duel);
}
