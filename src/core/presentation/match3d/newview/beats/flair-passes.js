// Passes played with flair: the backheel (back to the pass, a step over the ball, the heel plays it back)
// and the rabona (the kicking leg wraps round behind the standing one). Each returns false when he could not
// set it up, and the pass is then played the ordinary way.
// `beat` is the director's beat context (director.js, beatContext); `p` the passer; `toW` where it goes.
import { V, clamp } from '../runtime.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp, smooth01, spline } from '../motion-curves.js';
import { heelOf, toeGap } from './footwork.js';

const angleOff = d => Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));

// after the touch: the slow motion ends and the boots let go a moment later
function letGo({ hooks, later }, p) {
  const feet = p.feet; later(0.35, () => { hooks.slow(1); if (p.feet === feet) p.feet = null; });
}

// ---- backheel ----
// he turns his back on the pass with the ball, then steps up so the ball sits just ahead of him; returns
// his frame as he squared up (forward, right), or why it could not be set up
function* backheelSetUp({ ball, rt, until }, p, toW) {
  const face = V(toW.x - p.pos.x, 0, toW.z - p.pos.z).normalize().negate(), hw = Math.atan2(face.x, face.z);
  const turned = yield* until(() => { rt.dribble(p, p.pos.clone().addScaledVector(face, 3), 1.4); return angleOff(hw - p.heading) < 0.15; }, 1.4);
  if (!turned) return { failed: 'turn' };      // not round with his back to the pass: a normal pass
  p.face = p.pos.clone().addScaledVector(face, 30); p.faceLock = true;
  const f = forwardOf(p), r = rightOf(p);
  const set = yield* until(() => {
    const rel = V(ball.p.x - p.pos.x, 0, ball.p.z - p.pos.z), a = rel.dot(f), l = Math.abs(rel.dot(r));
    p.target.copy(ball.p).addScaledVector(f, -0.2).setY(0); p.want = 1.2;          // he stops a little short of where he aims: the ball ends ~0.3 m ahead
    if (Math.hypot(ball.v.x, ball.v.z) > 0.6) ball.v.multiplyScalar(0.9);
    return a > 0.2 && a < 0.42 && l < 0.2;
  }, 1.6);
  if (!set) { p.faceLock = false; return { failed: 'set' }; }
  return { f, r };
}

// the right boot steps over the ball, the heel comes down onto its far side
function backheelFeet({ ball }, { t0, b0, f, r }) {
  const plantL = b0.clone().addScaledVector(r, -0.22).addScaledVector(f, -0.06).setY(0.03);
  const side = b0.clone().addScaledVector(r, 0.15).setY(0.05), over = b0.clone().addScaledVector(f, 0.27).addScaledVector(r, 0.03).setY(0.16);
  return {
    Left: { w: ramp(t0, [0, 0.08, 0.6, 0.8]), at: () => plantL },
    Right: { w: ramp(t0, [0, 0.06, 0.55, 0.75]), at: t => {
      const u = t - t0;
      if (u < 0.2) { const k = smooth01(u / 0.2); return side.clone().lerp(over, k); }               // over the ball
      return ball.p.clone().addScaledVector(f, 0.09 + 0.17).addScaledVector(r, 0.02).setY(0.07);     // the heel onto its far side
    } },
  };
}

export function* backheelKick(beat, p, toW) {
  const { ball, S, hooks, stats, until, noteSkill } = beat;
  p.busy = true; ball.through = S.t + 2.5;
  const { failed, f, r } = yield* backheelSetUp(beat, p, toW);
  if (failed) { stats.lastFail = ['backheel', failed, +S.t.toFixed(1)]; return false; }
  const m = { t0: S.t, b0: ball.p.clone(), f, r }, { t0 } = m;
  p.vel.multiplyScalar(0.3); p.target.copy(p.pos); p.want = 0.2; ball.v.set(0, 0, 0); ball.through = t0 + 1.2;
  hooks.slow(0.5);
  p.feet = backheelFeet(beat, m);
  const audit = { kind: 'backheel', over: 9 };
  yield* until(() => {
    const u = S.t - t0, toe = p.feet.Right.last;
    if (toe && u > 0.06 && u < 0.2) audit.over = Math.min(audit.over, toe.distanceTo(ball.p));
    return u > 0.26 && heelOf(p, 'Right').distanceTo(ball.p) < 0.22;
  }, 0.55);
  audit.heel = +heelOf(p, 'Right').distanceTo(ball.p).toFixed(3); audit.over = +audit.over.toFixed(3);
  const aim = V(toW.x - ball.p.x, 0, toW.z - ball.p.z).normalize();
  audit.back = +Math.acos(clamp(aim.dot(f), -1, 1)).toFixed(2);
  noteSkill(audit, p);
  p.faceLock = false; p.lastTouch = S.t;
  letGo(beat, p);
  return true;
}

// ---- rabona ----
// he steps in with the standing boot planted on the far side of the ball, facing the way it will go
function* rabonaSetUp({ ball, until }, p, { aim, rA }) {
  p.face = p.pos.clone().addScaledVector(aim, 30); p.faceLock = true;
  const spot = () => ball.p.clone().addScaledVector(aim, -0.42).addScaledVector(rA, 0.32).setY(0);
  return yield* until(() => {
    const s0 = spot(), d = Math.hypot(p.pos.x - s0.x, p.pos.z - s0.z);
    p.target.copy(s0); p.want = d > 1.5 ? 4 : 1.1;
    ball.v.multiplyScalar(0.9);
    return d < 0.12 && angleOff(Math.atan2(aim.x, aim.z) - p.heading) < 0.08 && Math.hypot(ball.v.x, ball.v.z) < 0.3;
  }, 3);
}

// the kicking boot drawn back outside the standing leg, round behind it, and through the ball
function rabonaFeet({ ball }, m) {
  const { t0, aim, rA, plantL } = m;
  const back = plantL.clone().addScaledVector(aim, -0.36).addScaledVector(rA, 0.14).setY(0.3);
  const behind = plantL.clone().addScaledVector(aim, -0.19).addScaledVector(rA, -0.02).setY(0.13);
  const hit = () => ball.p.clone().addScaledVector(aim, -0.12).addScaledVector(rA, -0.03).setY(0.06);
  return {
    Left: { w: ramp(t0, [0, 0.1, 0.55, 0.75]), at: () => plantL },
    Right: { w: ramp(t0, [0, 0.08, 0.5, 0.7]), at: t => {
      const u = t - t0;
      if (u < 0.22) return back;                                                     // drawn back, outside the standing leg
      if (u < 0.36) { const k = (u - 0.22) / 0.14, h = hit(), [x, z] = spline([[back.x, back.z], [behind.x, behind.z], [h.x, h.z]], k); return V(x, 0.3 - 0.24 * smooth01(k), z); }
      return hit();
    } },
  };
}

function rabonaAudit({ ball }, p, m) {
  const { audit, rA } = m, rt0 = p.feet.Right.last, lt0 = p.feet.Left.last;
  audit.contact = +toeGap(ball, p, 'Right').toFixed(3);
  audit.crossed = !!(rt0 && lt0) && rt0.clone().sub(lt0).dot(rA) < -0.03;
  audit.behind = +audit.behind.toFixed(3);
}

export function* rabonaKick(beat, p, toW) {
  const { ball, S, hooks, stats, until, noteSkill } = beat;
  const aim = V(toW.x - ball.p.x, 0, toW.z - ball.p.z).normalize(), rA = V(-aim.z, 0, aim.x);
  p.busy = true; ball.through = S.t + 4;
  if (!(yield* rabonaSetUp(beat, p, { aim, rA }))) { p.faceLock = false; stats.lastFail = ['rabona', 'set', +S.t.toFixed(1)]; return false; }
  const t0 = S.t, b0 = ball.p.clone();
  hooks.slow(0.4);
  p.vel.multiplyScalar(0.2); p.target.copy(p.pos); p.want = 0.2; ball.v.set(0, 0, 0); ball.through = t0 + 1.2;
  const m = { t0, aim, rA, plantL: b0.clone().addScaledVector(rA, 0.2).addScaledVector(aim, -0.03).setY(0.03), audit: { kind: 'rabona', behind: 9 } };
  p.feet = rabonaFeet(beat, m);
  yield* until(() => {
    const u = S.t - t0, toe = p.feet.Right.last;
    if (toe && u > 0.24 && u < 0.36) { const rel = toe.clone().sub(m.plantL); if (Math.abs(rel.dot(rA)) < 0.1) m.audit.behind = Math.min(m.audit.behind, rel.dot(aim)); }
    return u > 0.32 && toeGap(ball, p, 'Right') < 0.24;
  }, 0.55);
  rabonaAudit(beat, p, m);
  noteSkill(m.audit, p);
  p.faceLock = false; p.lastTouch = S.t;
  letGo(beat, p);
  return true;
}
