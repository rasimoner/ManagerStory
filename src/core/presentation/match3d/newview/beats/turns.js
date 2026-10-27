// Turns with the ball: the Cruyff turn and the Marseille turn (roulette). The defender commits one way, the
// carrier turns away with the ball the other.
// `beat` is the director's beat context (director.js, beatContext); `duel` is { car, def, closeUp }.
import { V, clamp, BALL_R } from '../runtime.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp, smooth01 } from '../motion-curves.js';
import { keepOffTouchline, slipWatch, squareUp, toeGap } from './footwork.js';
import { afterBeat } from './duel-exit.js';

// ---- Cruyff turn: he shapes to strike it (the boot goes back and comes through), but the inside of the
// boot drags the ball back behind his standing leg instead and he turns away with it ----
function cruyffFeet({ ball }, m) {
  const { f, r, t0, b0 } = m;
  const rel = (a, l, y) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
  const back = b0.clone().addScaledVector(f, -0.34).addScaledVector(r, 0.12).setY(0.3);
  return {
    Left: { w: ramp(t0, [0, 0.1, 0.9, 1.05]), at: () => m.plantL },
    Right: { w: ramp(t0, [0, 0.08, 0.9, 1.05]), at: t => {
      const u = t - t0;
      if (u < 0.28) return back;                                                    // the shot is shaped: boot back and up
      if (u < 0.42) { const k = (u - 0.28) / 0.14; return back.clone().lerp(rel(0.17, 0.11, 0.06), k * k * (3 - 2 * k)); }   // through, beside the ball
      if (u < 0.5) { const k = (u - 0.42) / 0.08; return rel(0.17, 0.11, 0.06).lerp(rel(0.12, 0.02, 0.05), k); }            // the inside of the boot onto its front
      return rel(-0.12, -0.12, 0.05);
    } },
  };
}

// the fake shot and the swing past the ball; the defender goes for the shot, not through the man
function cruyffSwingStep(beat, duel, m) {
  const { ball, S, rt } = beat, { car, def } = duel, { f, t0, audit } = m;
  const u = S.t - t0, toe = car.feet.Right.last;
  if (toe && u < 0.3) audit.fake = Math.max(audit.fake, toe.y);
  if (toe && u > 0.3 && u < 0.41) audit.swingGap = Math.min(audit.swingGap, toe.distanceTo(ball.p));
  if (u > 0.22 && !def.act) { rt.startAction(def, 'lunge'); def.loopsWant.jockey = 0; def.target.copy(car.pos).addScaledVector(f, 1.15); def.want = 3; }
  m.slip();
  return u >= 0.5 && toeGap(ball, car, 'Right') < 0.24;
}

// the ball goes behind the standing boot
function* cruyffDragBack(beat, car, m) {
  const { ball, S, until } = beat, { f, r, t0, b0, plantL, audit } = m;
  const dir = f.clone().multiplyScalar(-0.75).addScaledVector(r, -0.65).normalize();
  ball.v.copy(dir).multiplyScalar(3.0); car.lastTouch = S.t;
  audit.plantSlip = +m.slip().toFixed(3);          // the standing boot matters through the swing and the take
  const pl = (plantL.clone().sub(b0)).dot(r);
  yield* until(() => { const d = ball.p.clone().sub(b0); if (d.dot(r) <= pl) { audit.behind = d.dot(f) < plantL.clone().sub(b0).dot(f) - 0.12; return true; } return S.t - t0 > 1.2; }, 0.6);
  return dir;
}

export function* cruyffBeat(beat, duel) {
  const { ball, S, hooks, gather, until, wait, noteSkill } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.4) return false;
  yield* squareUp(beat, car);
  const f = forwardOf(car), r = rightOf(car), t0 = S.t, b0 = ball.p.clone();
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  car.target.copy(car.pos); car.want = 0.3; car.vel.multiplyScalar(0.3); ball.v.copy(f).multiplyScalar(0.08);
  car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
  ball.through = t0 + 1.2; def.target.copy(def.pos); def.want = 0.5;
  const m = { f, r, t0, b0, plantL: b0.clone().addScaledVector(f, 0.16).addScaledVector(r, -0.26).setY(0.03), audit: { kind: 'cruyff', fake: 0, swingGap: 9 } };
  car.feet = cruyffFeet(beat, m);
  m.slip = slipWatch(beat, { player: car, side: 'Left', after: 0.12, t0 });
  yield* until(() => cruyffSwingStep(beat, duel, m), 0.68);
  m.audit.contact = +toeGap(ball, car, 'Right').toFixed(3);
  const dir = yield* cruyffDragBack(beat, car, m);
  noteSkill(m.audit, car);
  car.feet = null; car.face = ball.p; car.faceLock = true; car.target.copy(ball.p).addScaledVector(dir, 0.6); car.want = 4.5;
  yield* wait(0.25);
  yield* afterBeat(beat, duel);
}

// ---- Marseille turn: the right sole drags the ball back as he spins round on it, the left sole takes it on
// round the other side and he comes out of the spin past his man ----
const ROULETTE_SPIN = 0.9;

// a full turn to his right; (V7.9.5) he eases from where he stands onto the ball in the first tenth of a
// second — the drive used to start 0.38 m behind the ball wherever he was, a jump of a few tenths in one frame
function rouletteDrive({ ball }, car, m) {
  const { t0, h0 } = m, p0 = car.pos.clone();
  const hd = t => h0 - 2 * Math.PI * smooth01(clamp((t - t0) / ROULETTE_SPIN, 0, 1));
  const fw = h => V(Math.sin(h), 0, Math.cos(h));
  return { heading: hd, pos: t => p0.clone().lerp(ball.p.clone().addScaledVector(fw(hd(t)), -0.38).setY(0), smooth01(clamp((t - t0) / 0.12, 0, 1))) };
}

function rouletteSoleWeight(u) {
  if (u < 0.05) return u / 0.05;
  if (u < 0.36) return 1;
  if (u < 0.46) return (0.46 - u) / 0.1;
  return u > 0.72 && u < 0.86 ? 1 : 0;
}

function rouletteFeet({ ball }, car, m) {
  const { t0 } = m;
  const onTop = (side) => () => ball.p.clone().addScaledVector(rightOf(car), side === 'Right' ? 0.04 : -0.04).setY(0.2);
  return {
    Right: { w: t => rouletteSoleWeight(t - t0), at: t => (t - t0) < 0.5 ? onTop('Right')() : ball.p.clone().addScaledVector(forwardOf(car), -0.13).setY(0.05) },
    Left: { w: t => { const u = t - t0; return u > 0.38 && u < 0.7 ? Math.min(1, (u - 0.38) / 0.06, (0.7 - u) / 0.06) : 0; }, at: onTop('Left') },
  };
}

// the soles move the ball: dragged back and across, then the other sole takes it on round
function rouletteRollBall({ ball }, m, u) {
  const { f, r } = m;
  if (m.phase === 0 && u > 0.05) { m.phase = 1; ball.v.copy(f).multiplyScalar(-0.45).addScaledVector(r, 0.9); }
  if (m.phase === 1 && u > 0.42) { m.phase = 2; ball.v.copy(r).multiplyScalar(1.1).addScaledVector(f, 0.45); }
  ball.v.y = 0; ball.p.y = BALL_R;
}

function rouletteSpinStep(beat, duel, m) {
  const { ball, S, rt } = beat, { car, def } = duel, { f, r, t0, c0, audit } = m, u = S.t - t0;
  rouletteRollBall(beat, m, u);
  if (u > 0.08 && u < 0.34) audit.soleA = Math.min(audit.soleA, toeGap(ball, car, 'Right'));
  if (u > 0.44 && u < 0.66) audit.soleB = Math.min(audit.soleB, toeGap(ball, car, 'Left'));
  audit.wander = Math.max(audit.wander, Math.hypot(ball.p.x - car.pos.x, ball.p.z - car.pos.z));
  if (u > 0.2 && !def.act) { rt.startAction(def, 'lunge'); def.loopsWant.jockey = 0; def.target.copy(c0).addScaledVector(f, 1.7).addScaledVector(r, -0.6); def.want = 3; }      // he goes the other way
  return u >= 0.76;
}

function* rouletteOut(beat, car, m) {
  const { ball, S, until, noteSkill } = beat, { f, r, t0, h0, audit } = m;
  audit.spin = +Math.abs(car.drive.heading(S.t) - h0).toFixed(2);
  audit.contact = +toeGap(ball, car, 'Right').toFixed(3);
  const out = f.clone().multiplyScalar(3.4).addScaledVector(r, 0.8);
  keepOffTouchline(car, out);
  ball.v.copy(out); car.lastTouch = S.t;
  for (const k of ['soleA', 'soleB', 'wander']) audit[k] = +audit[k].toFixed(3);
  noteSkill(audit, car);
  yield* until(() => S.t - t0 >= ROULETTE_SPIN, 0.3);
  car.drive = null; car.heading = h0; car.target.copy(ball.p).addScaledVector(out, 0.4); car.want = 6;
}

export function* rouletteBeat(beat, duel) {
  const { ball, S, hooks, gather, until, wait } = beat, { car, def, closeUp } = duel;
  if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.4) return false;
  yield* squareUp(beat, car);
  const m = { f: forwardOf(car), r: rightOf(car), t0: S.t, h0: car.heading, phase: 0, audit: { kind: 'roulette', soleA: 9, soleB: 9, wander: 0 } };
  if (closeUp) hooks.cam('close', car, def);
  hooks.slow(0.4);
  ball.through = m.t0 + 1.4; ball.v.set(0, 0, 0); def.target.copy(car.pos).addScaledVector(m.f, 2.3); def.want = 1.5; def.face = car.pos; def.faceLock = true;
  car.drive = rouletteDrive(beat, car, m);
  car.feet = rouletteFeet(beat, car, m);
  m.c0 = car.pos.clone();
  yield* until(() => rouletteSpinStep(beat, duel, m), 1.2);
  yield* rouletteOut(beat, car, m);
  yield* wait(0.25);
  yield* afterBeat(beat, duel);
}
