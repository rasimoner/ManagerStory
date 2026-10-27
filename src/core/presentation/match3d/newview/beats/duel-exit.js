// How a special move against a defender ends: the beaten man stumbles, the carrier runs on to the ball and
// the picture goes back to the wide camera; for a ball sent over the man, where it lands and how high it
// went over him; for one through his legs, whether it really went between his boots.
// `beat` is the director's beat context (director.js, beatContext); `duel` is { car, def, closeUp }.
import { V, BALL_R } from '../runtime.js';

function releaseDuel(duel) {
  const { car, def } = duel;
  def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0; def.feet = null;
}

// the defender is left stumbling; the carrier is away with it
export function* afterBeat(beat, duel) {
  const { hooks, rt, wait, chase } = beat, { car, def, closeUp } = duel;
  hooks.slow(1);
  rt.startAction(def, 'stumble'); def.want = 0.5; def.face = car.pos; def.faceLock = true;
  yield* wait(0.3); car.feet = null; car.faceLock = false; car.drive = null;
  releaseDuel(duel);
  if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
  yield* chase(car, null);
}

// the ball is in the air over the defender: the carrier goes round to where it comes down and takes it
export function* collectAir(beat, duel, land) {
  const { ball, hooks, until, chase } = beat, { car, closeUp } = duel;
  car.feet = null; car.faceLock = false; car.drive = null;
  car.target.copy(land).setY(0); car.want = 6.5;
  yield* until(() => ball.p.y < 0.5, 1.8);
  hooks.slow(1);
  releaseDuel(duel);
  if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
  yield* chase(car, null);
}

// where a ball now at `from`, moving at `velocity`, comes down (a little short of the drag-free flight)
export function landing(velocity, from) {
  const { x: vx, y: vy, z: vz } = velocity;
  const t = (vy + Math.sqrt(vy * vy + 2 * 9.81 * Math.max(0, from.y - BALL_R))) / 9.81;
  return from.clone().add(V(vx * t * 0.95, 0, vz * t * 0.95)).setY(0);
}

// how high the ball is as it goes past a point (the defender), watched while it flies
export function overWatch({ ball }, at, f) {
  let best = null;
  return () => { const d = ball.p.clone().sub(at).dot(f); if (best == null && d >= 0) best = +ball.p.y.toFixed(2); return best; };
}

// the ball crossing the line between the defender's planted boots: was it between them, and how far from each
export function betweenFeet({ ball }, { def, gap, f }) {
  const l = def.feet?.Left?.last, r = def.feet?.Right?.last;
  if (!l || !r || (ball.p.x - gap.x) * f.x + (ball.p.z - gap.z) * f.z <= 0) return null;
  const seg = V(r.x - l.x, 0, r.z - l.z), len = seg.length(), q = V(ball.p.x - l.x, 0, ball.p.z - l.z).dot(seg) / Math.max(1e-3, len * len);
  return { between: q > 0 && q < 1, gapL: +Math.hypot(ball.p.x - l.x, ball.p.z - l.z).toFixed(3), gapR: +Math.hypot(ball.p.x - r.x, ball.p.z - r.z).toFixed(3) };
}
