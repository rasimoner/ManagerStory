// Through the defender's legs: the nutmeg (a stab of the right boot through the gap) and the flair nutmeg
// (back turned, the heel sends it through). The defender squares up with his boots apart; the carrier goes
// round him on the open side and collects it.
// `beat` is the director's beat context (director.js, beatContext); `duel` is { car, def, closeUp }.
import { V, clamp } from '../runtime.js';
import { ACTIONS } from '../actions.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp, smooth01 } from '../motion-curves.js';
import { heelOf } from './footwork.js';
import { afterBeat, betweenFeet } from './duel-exit.js';

const vec2 = v => v.toArray().map(x => +x.toFixed(2));

// the defender closes in to just in front of the ball while the carrier steadies it
function* defenderCloses({ ball, until }, { car, def }, { reach, settle, near }) {
  const fc = forwardOf(car);
  yield* until(() => { def.target.copy(ball.p).addScaledVector(fc, reach); def.want = 3; def.face = car.pos; def.faceLock = true; car.target.copy(car.pos); car.want = 0.3; ball.v.multiplyScalar(settle); return def.pos.distanceTo(ball.p.clone().setY(0)) < near; }, 0.6);
}

// he faces the carrier and stands with his boots wide apart (held from t0 for `envelope`); returns the gap
function plantWide({ rt }, { car, def }, { t0, envelope }) {
  def.heading = Math.atan2(car.pos.x - def.pos.x, car.pos.z - def.pos.z); def.face = car.pos; def.faceLock = true;
  def.loopsWant.jockey = 0; def.target.copy(def.pos); def.want = 0; def.vel.multiplyScalar(0.2);
  const dr = rightOf(def), df = forwardOf(def);
  const fl = def.pos.clone().addScaledVector(dr, -0.44).addScaledVector(df, 0.06).setY(0.03), fr = def.pos.clone().addScaledVector(dr, 0.44).addScaledVector(df, 0.06).setY(0.03);
  def.feet = { Left: { at: () => fl, w: ramp(t0, envelope) }, Right: { at: () => fr, w: ramp(t0, envelope) } };
  rt.startAction(def, 'spread');
  return def.pos.clone().addScaledVector(df, 0.06).setY(0);
}

// round him on the open side (which side: the move's seed), then onto the ball
function goRound({ pick }, { car, def }, { gap, f }) {
  const side = V(-f.z, 0, f.x).multiplyScalar(pick(def.lastEvent, 11) < 0.5 ? 1 : -1);
  car.target.copy(gap).addScaledVector(side, 1.3).addScaledVector(f, 0.2); car.want = 6.4;
}

// ---- nutmeg ----
function* nutmegStab(beat, duel, m) {
  const { ball, S, rt, until, debug } = beat, { car, def } = duel, { t0, gap } = m;
  car.target.copy(car.pos); car.want = 0.4; ball.v.multiplyScalar(0.15); ball.through = t0 + 0.5;      // he steadies it
  const f = V(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();
  car.heading = Math.atan2(f.x, f.z);
  rt.startAction(car, 'poke', 0.06);
  m.tc = 0.06 + ACTIONS.poke.dur * ACTIONS.poke.contact;
  car.feet = nutmegFeet(beat, { t0, tc: m.tc, f });
  yield* until(() => S.t - t0 >= m.tc, 1);
  const toe = car.feet.Right.last;
  m.audit = { kind: 'nutmeg', contact: toe ? +toe.distanceTo(ball.p).toFixed(3) : null };
  f.set(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();                    // aimed at the gap from where the ball is now
  if (debug) m.audit.dbg = { ball: vec2(ball.p), gap: vec2(gap), def: vec2(def.pos) };
  ball.v.copy(f).multiplyScalar(5.2); ball.through = S.t + 1.1; car.lastTouch = S.t;
  return f;
}

export function nutmegFeet({ ball }, { t0, tc, f }) {
  return { Right: { w: ramp(t0, [0.02, 0.12, tc, tc + 0.12]), at: () => ball.p.clone().addScaledVector(f, -0.13).setY(0.06) } };
}

// the ball through the gap: was it between his boots
function* nutmegThrough(beat, duel, m) {
  const { ball, S, until, debug } = beat, { def } = duel, { t0, tc, gap, f, audit } = m;
  let crossed = false;
  yield* until(() => {
    if (!crossed) { const g = betweenFeet(beat, { def, gap, f }); if (g) { crossed = true; Object.assign(audit, g); } }
    return crossed || S.t - t0 > tc + 1.1;
  }, 1.6);
  yield* until(() => S.t - t0 > tc + 0.45, 0.6);
  if (debug && !crossed) audit.end = { ball: vec2(ball.p), v: vec2(ball.v), feet: !!def.feet, l: !!def.feet?.Left?.last };
}

// through his legs: the defender squares up with his feet apart, a stab with the right boot sends the ball
// through the gap and the attacker goes round him
export function* nutmegBeat(beat, duel) {
  const { ball, S, hooks, gather, until, chase, noteSkill } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def, 0.7)) || def.pos.distanceTo(car.pos) > 3.2) return false;
  yield* defenderCloses(beat, duel, { reach: 1.45, settle: 0.9, near: 1.75 });
  const m = { t0: S.t };
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  m.gap = plantWide(beat, duel, { t0: m.t0, envelope: [0, 0.16, 1.0, 1.25] });
  m.f = yield* nutmegStab(beat, duel, m);
  goRound(beat, duel, m);
  yield* nutmegThrough(beat, duel, m);
  noteSkill(m.audit, car);
  hooks.slow(1); car.feet = null;
  def.face = ball.p; def.faceLock = true; def.want = 1.5; def.target.copy(def.pos).addScaledVector(m.f, 0.8);
  yield* until(() => !def.feet || S.t - m.t0 > 1.3, 0.8); def.feet = null;
  def.busy = car.busy = false; def.faceLock = false;
  if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
  yield* chase(car, null);
}

// ---- flair nutmeg ----
const BACK_TURN = 0.36;

// the heel goes onto the near face of the ball (the boot points the way he now faces)
function heelOntoBall({ ball }, { t0, hd }) {
  return { Right: { w: t => { const u = t - t0; return u < BACK_TURN - 0.1 ? 0 : Math.min(1, (u - BACK_TURN + 0.1) / 0.08); }, at: t => { const fnow = V(Math.sin(hd(t)), 0, Math.cos(hd(t))); return ball.p.clone().addScaledVector(fnow, 0.1 + 0.17).setY(0.07); } } };
}

// he turns his back (to his left, half a turn) on the spot, the ball now behind him; the heel sends it back
function* backHeelThrough(beat, car, m) {
  const { ball, S, until } = beat, { t0, h0, gap, audit } = m, p0 = car.pos.clone();
  const hd = t => h0 + Math.PI * smooth01(clamp((t - t0) / BACK_TURN, 0, 1));
  car.drive = { heading: hd, pos: () => p0 };
  car.feet = heelOntoBall(beat, { t0, hd });
  yield* until(() => S.t - t0 >= BACK_TURN + 0.06 && heelOf(car, 'Right').distanceTo(ball.p) < 0.24, BACK_TURN + 0.3);
  audit.heel = +heelOf(car, 'Right').distanceTo(ball.p).toFixed(3); audit.turn = +(hd(S.t) - h0).toFixed(2);
  const f = V(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();
  ball.v.copy(f).multiplyScalar(5.0); ball.through = S.t + 1.1; car.lastTouch = S.t;
  car.drive = null; car.feet = null; car.heading = hd(S.t);
  return f;
}

// flair nutmeg: he turns his back on the defender as if to shield it, then the heel sends the ball back
// through the defender's legs and he spins round him to collect
export function* flairNutmegBeat(beat, duel) {
  const { ball, S, hooks, gather, until, wait, noteSkill } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def, 0.9)) || def.pos.distanceTo(car.pos) > 3.4) return false;
  yield* defenderCloses(beat, duel, { reach: 1.5, settle: 0.85, near: 1.8 });
  const m = { t0: S.t, h0: car.heading, audit: { kind: 'flairnutmeg' } };
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  m.gap = plantWide(beat, duel, { t0: m.t0, envelope: [0, 0.16, 1.2, 1.45] });
  ball.v.set(0, 0, 0); ball.through = m.t0 + 0.8;
  m.f = yield* backHeelThrough(beat, car, m);
  goRound(beat, duel, m); car.faceLock = false;
  yield* until(() => { const g = betweenFeet(beat, { def, gap: m.gap, f: m.f }); if (g) Object.assign(m.audit, g); return !!g || S.t - m.t0 > BACK_TURN + 1.2; }, 1.4);
  noteSkill(m.audit, car);
  yield* wait(0.2);
  def.face = ball.p; def.want = 1.5;
  yield* afterBeat(beat, duel);
}
