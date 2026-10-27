// V7.9.3 the keeper's volley out of his hands: he turns to his target and takes a couple of steps with the
// ball held out in front, steps onto the left foot as he lets it go, and the right boot meets it in the air
// (never off the grass) and sends it high and long.
// `beat` is the director's beat context (director.js, beatContext).
import { V, clamp } from '../runtime.js';
import { ACTIONS } from '../actions.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp } from '../motion-curves.js';
import { toeGap } from './footwork.js';

// the ball held out in front of him in both gloves
function holdOut({ ball, rt }, gk) {
  const F = () => forwardOf(gk), R = () => rightOf(gk);
  const holdAt = () => gk.pos.clone().addScaledVector(F(), 0.42).setY(1.0);
  ball.held = rt.pickUp(holdAt, 0.3); ball.owner = gk;
  const grip = side => ({ w: () => 1, at: () => ball.p.clone().addScaledVector(R(), side * 0.12).addScaledVector(F(), -0.04) });
  gk.hands = { Left: grip(-1), Right: grip(1) };
}

// turn to the target, then a couple of steps forwards
function* runUp({ until }, gk, toW) {
  const hd = Math.atan2(toW.x - gk.pos.x, toW.z - gk.pos.z);
  yield* until(() => { gk.target.copy(gk.pos); gk.want = 0; const d = Math.atan2(Math.sin(hd - gk.heading), Math.cos(hd - gk.heading)); gk.heading += clamp(d, -0.1, 0.1); return Math.abs(d) < 0.05; }, 1);
  gk.heading = hd;
  const F = forwardOf(gk), run = gk.pos.clone().addScaledVector(F, 2.4);
  yield* until(() => { gk.target.copy(run); gk.want = 2.6; gk.face = run.clone().addScaledVector(forwardOf(gk), 5); gk.faceLock = true; return gk.pos.distanceTo(run) < 1.2; }, 1.4);
}

// the strike: the ball is let go so that it falls to knee height as the boot comes through
function* strike({ ball, S, rt, until }, gk, audit) {
  const F = () => forwardOf(gk), R = () => rightOf(gk);
  const A = ACTIONS.gkVolley, tc = A.dur * A.contact, hit = 0.48, fall = Math.sqrt(2 * (1.0 - hit) / 9.81);
  rt.startAction(gk, 'gkVolley'); const t0 = S.t;
  gk.target.copy(gk.pos).addScaledVector(F(), 0.5); gk.want = 1.2;
  yield* until(() => S.t - t0 >= tc - fall, 1);
  const drop = ball.p.clone();
  ball.held = null; ball.through = S.t + 1.2; ball.v.copy(gk.vel).setY(0).multiplyScalar(0.9); audit.release = +drop.y.toFixed(2);
  const hw = ramp(S.t, [-1, 0, 0, 0.15]); gk.hands = { Left: { w: hw, at: () => drop.clone().addScaledVector(R(), -0.12) }, Right: { w: hw, at: () => drop.clone().addScaledVector(R(), 0.12) } };
  // the right boot goes to the falling ball
  gk.feet = { Right: { w: ramp(t0 + tc, [-0.2, -0.04, 0.06, 0.25]), at: () => ball.p.clone().addScaledVector(F(), -0.06) } };
  yield* until(() => { audit.low = Math.min(audit.low, ball.p.y); return S.t - t0 >= tc - 0.005 || (S.t - t0 > tc - 0.05 && toeGap(ball, gk, 'Right') < 0.16); }, 1);
}

export function* keeperVolley(beat, gk, { toW, range }) {
  const { ball, S, rt, stats, wait, later } = beat;
  gk.busy = true; gk.face = null; gk.faceLock = false; gk.loopsWant.keeperReady = 0;
  holdOut(beat, gk);
  yield* runUp(beat, gk, toW);
  const audit = { kind: 'gkvolley', low: 9 };
  yield* strike(beat, gk, audit);
  Object.assign(audit, { contact: +toeGap(ball, gk, 'Right').toFixed(3), h: +ball.p.y.toFixed(2), low: +audit.low.toFixed(2), range: +range.toFixed(1) });
  ball.owner = gk;
  rt.kickAir(V(toW.x, 0.3, toW.z), clamp(range / 22, 1.4, 3.2));      // (a long one flies flatter: never a 30 m high balloon)
  gk.lastTouch = S.t;
  (stats.gkVolleys ||= []).push(audit);
  const feet = gk.feet; later(0.4, () => { if (gk.feet === feet) gk.feet = null; gk.hands = null; });
  gk.faceLock = false; gk.target.copy(gk.pos); gk.want = 0;
  yield* wait(0.25);
}
