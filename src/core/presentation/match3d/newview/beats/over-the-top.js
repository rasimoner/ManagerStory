// Showboating, the ball up and over the defender (rare, only the very best, never when losing): the rainbow
// flick, the sombrero and keeping it up to skip past him. He goes round the man and takes it as it comes down.
// `beat` is the director's beat context (director.js, beatContext); `duel` is { car, def, closeUp }.
import { BALL_R } from '../runtime.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp } from '../motion-curves.js';
import { heelOf, squareUp, toeGap } from './footwork.js';
import { collectAir, landing, overWatch } from './duel-exit.js';

// the ball is up: the wide picture shows it go over him (the replay shows it close); returns where it lands
function sendItOver({ ball, S, hooks }, { car, closeUp }, { f, forward, up }) {
  ball.v.copy(f).multiplyScalar(forward).setY(up); car.lastTouch = S.t;
  if (closeUp) hooks.cam('tv');
  return landing(ball.v, ball.p);
}

// while it flies: how high it goes and how high it passes the defender; he runs round to where it lands
function* watchFlight({ ball, until }, { car, def }, { over, land, low }) {
  let apex = 0, rounded = false;
  yield* until(() => {
    apex = Math.max(apex, ball.p.y); over();
    if (def && !rounded && car.pos.distanceTo(def.pos) < def.roundAt) { rounded = true; car.target.copy(land); }
    return ball.v.y < 0 && ball.p.y < low;
  }, def ? def.within : 1.6);
  return apex;
}

// ---- rainbow flick: the right sole rolls the ball back between his feet, the instep pops it up behind him
// and the left heel flicks it up over his own head and the defender's, and he runs on to it ----
function rainbowFeet({ ball }, car, { f, r, t0 }) {
  const rel = (a, l, y) => car.pos.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
  return {
    Right: { w: t => { const u = t - t0; return u < 0.05 ? u / 0.05 : u < 0.42 ? 1 : 0; }, at: t => (t - t0) < 0.26 ? ball.p.clone().setY(0.2) : ball.p.clone().addScaledVector(f, 0.12).setY(Math.max(0.05, ball.p.y - 0.06)) },
    Left: { w: t => { const u = t - t0; return u < 0.3 ? Math.min(1, u / 0.1) : u < 0.62 ? 1 : Math.max(0, 1 - (u - 0.62) / 0.12); }, at: t => (t - t0) < 0.34 ? rel(-0.02, -0.14, 0.03) : ball.p.clone().addScaledVector(f, 0.17 - 0.1).setY(ball.p.y) },
  };
}

// 1: rolled back under the sole to between his feet; 2: the instep pops it up behind the left calf;
// 3: the left heel meets it
function* rainbowLift({ ball, until }, car, { f, audit }) {
  ball.v.copy(f).multiplyScalar(-1.5);
  yield* until(() => { audit.roll = Math.min(audit.roll, toeGap(ball, car, 'Right')); const back = ball.p.clone().sub(car.pos).dot(f); if (back < 0.06) { ball.v.set(0, 0, 0); return true; } return false; }, 0.34);
  ball.p.y = BALL_R + 0.01; ball.v.set(0, 2.3, 0).addScaledVector(f, -0.25);
  yield* until(() => ball.v.y <= 0.2, 0.3);
  yield* until(() => heelOf(car, 'Left').distanceTo(ball.p) < 0.22, 0.12);
  audit.heel = +heelOf(car, 'Left').distanceTo(ball.p).toFixed(3);
}

export function* rainbowBeat(beat, duel) {
  const { ball, S, hooks, gather, noteSkill } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 5) return false;
  yield* squareUp(beat, car);
  const m = { f: forwardOf(car), r: rightOf(car), t0: S.t, audit: { kind: 'rainbow', roll: 9 } }, { f } = m;
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  // the defender stands off a couple of metres, he takes it towards him at walking pace
  def.target.copy(car.pos).addScaledVector(f, 2.6); def.want = 2; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1;
  car.target.copy(car.pos).addScaledVector(f, 0.3); car.want = 0.5; car.vel.multiplyScalar(0.3);
  car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
  ball.through = m.t0 + 2.5; ball.v.set(0, 0, 0);
  car.feet = rainbowFeet(beat, car, m);
  yield* rainbowLift(beat, car, m);
  const land = sendItOver(beat, duel, { f, forward: 3.9, up: 6.1 }), over = overWatch(beat, def.pos.clone(), f);
  def.target.copy(def.pos); def.want = 0.3; def.loopsWant.jockey = 0; def.face = ball.p; def.faceLock = true;
  // he goes round the defender's side to meet it
  car.feet = null; car.faceLock = false; car.target.copy(land); car.want = 6.5;
  const apex = yield* watchFlight(beat, { car }, { over, land, low: 1.0 });
  Object.assign(m.audit, { apex: +apex.toFixed(2), overDef: over() });
  noteSkill(m.audit, car);
  yield* collectAir(beat, duel, land);
}

// ---- sombrero: face to face with the defender, the toe scoops the ball up over his head; round him and
// collect it behind him ----
export function sombreroFeet({ ball }, car, { f, r, t0 }) {
  const plantL = ball.p.clone().addScaledVector(r, -0.25).addScaledVector(f, -0.08).setY(0.03);
  return {
    Left: { w: ramp(t0, [0, 0.08, 0.45, 0.6]), at: () => plantL },
    Right: { w: ramp(t0, [0, 0.06, 0.4, 0.55]), at: () => ball.p.clone().addScaledVector(f, -0.1).setY(0.03) },
  };
}

function* sombreroScoop({ ball, S, hooks, until }, { car, def, closeUp }, { f, r }) {
  // the defender closes to just over a metre and a half
  yield* until(() => { def.target.copy(car.pos).addScaledVector(f, 1.7); def.want = 3; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1; car.target.copy(car.pos); car.want = 0.3; return def.pos.distanceTo(car.pos) < 1.95; }, 0.7);
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  ball.through = S.t + 2.5; ball.v.set(0, 0, 0);
  car.feet = sombreroFeet({ ball }, car, { f, r, t0: S.t });
  const t1 = S.t;
  yield* until(() => S.t - t1 > 0.16 && toeGap(ball, car, 'Right') < 0.2, 0.32);
  return { kind: 'sombrero', toe: +toeGap(ball, car, 'Right').toFixed(3) };
}

export function* sombreroBeat(beat, duel) {
  const { ball, gather, pick, noteSkill } = beat, { car, def } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 4) return false;
  yield* squareUp(beat, car);
  const f = forwardOf(car), r = rightOf(car);
  const audit = yield* sombreroScoop(beat, duel, { f, r });
  const land = sendItOver(beat, duel, { f, forward: 2.7, up: 6.4 }), over = overWatch(beat, def.pos.clone(), f);
  def.loopsWant.jockey = 0; def.face = ball.p; def.faceLock = true; def.want = 0.3; def.target.copy(def.pos);
  const side = r.clone().multiplyScalar(pick(def.lastEvent, 11) < 0.5 ? 1 : -1);
  car.feet = null; car.faceLock = false;
  car.target.copy(def.pos).addScaledVector(side, 1.2); car.want = 6;
  const apex = yield* watchFlight(beat, { car, def: { pos: def.pos, roundAt: 1.5, within: 1.6 } }, { over, land, low: 1.0 });
  Object.assign(audit, { apex: +apex.toFixed(2), overDef: over() });
  noteSkill(audit, car);
  yield* collectAir(beat, duel, land);
}

// ---- keep it up and go: the toe flicks the ball up, a second touch in the air lifts it over the defender's
// lunging leg, and he skips past ----
function juggleFeet({ ball }, car, m) {
  const { f, r, t0 } = m;
  const plantL = car.pos.clone().addScaledVector(r, -0.14).addScaledVector(f, 0.12).setY(0.03);
  return {
    Left: { w: ramp(t0, [0, 0.08, 0.8, 0.95]), at: () => plantL },
    Right: { w: ramp(t0, [0, 0.06, 0.82, 0.95]), at: () => m.stage === 0 ? ball.p.clone().addScaledVector(f, -0.12).setY(0.03) : ball.p.clone().addScaledVector(f, -0.05).setY(Math.max(0.05, ball.p.y - 0.12)) },
  };
}

// 1: a flick up off the toe; 2: met on the way down at knee height
function* juggleTouches({ ball, S, until }, car, m) {
  const { f, t0, audit } = m;
  yield* until(() => S.t - t0 > 0.12 && toeGap(ball, car, 'Right') < 0.2, 0.3);
  audit.touch1 = +toeGap(ball, car, 'Right').toFixed(3);
  ball.p.y = BALL_R + 0.01; ball.v.copy(f).multiplyScalar(0.25).setY(3.0); car.lastTouch = S.t; m.stage = 1;
  yield* until(() => { if (ball.v.y < 0) audit.low = Math.min(audit.low, ball.p.y); return ball.v.y < 0 && ball.p.y < 0.55 && toeGap(ball, car, 'Right') < 0.25; }, 0.8);
  audit.touch2 = +toeGap(ball, car, 'Right').toFixed(3); audit.low = +audit.low.toFixed(2);
}

export function* juggleBeat(beat, duel) {
  const { ball, S, rt, hooks, gather, pick, noteSkill } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 4) return false;
  yield* squareUp(beat, car);
  const m = { f: forwardOf(car), r: rightOf(car), t0: S.t, stage: 0, audit: { kind: 'juggle', low: 9 } }, { f, r } = m;
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  def.target.copy(car.pos).addScaledVector(f, 2.1); def.want = 2.5; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1;
  car.target.copy(car.pos); car.want = 0.3; car.vel.multiplyScalar(0.3);
  car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
  ball.through = m.t0 + 2.5; ball.v.set(0, 0, 0);
  car.feet = juggleFeet(beat, car, m);
  yield* juggleTouches(beat, car, m);
  rt.startAction(def, 'lunge'); def.loopsWant.jockey = 0; def.target.copy(ball.p).setY(0); def.want = 3;
  const land = sendItOver(beat, duel, { f, forward: 3.4, up: 4.4 }), over = overWatch(beat, def.pos.clone(), f);
  car.feet = null; car.faceLock = false;
  car.target.copy(def.pos).addScaledVector(r, pick(def.lastEvent, 11) < 0.5 ? 1.1 : -1.1); car.want = 5.5;
  yield* watchFlight(beat, { car, def: { pos: def.pos, roundAt: 1.4, within: 1.4 } }, { over, land, low: 0.7 });
  m.audit.overDef = over();
  noteSkill(m.audit, car);
  yield* collectAir(beat, duel, land);
}
