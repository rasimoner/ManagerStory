// A boot and the ball during a special move: how far the toe is from it, where the heel is, how far a
// planted boot has slid, squaring up to the ball before the move, and keeping the push past the man in play.
// `beat` is the director's beat context (director.js, beatContext).
import { V } from '../runtime.js';

const TOUCHLINE_ZONE = 28;

export function toeGap(ball, p, side) {
  const toe = p.feet?.[side]?.last;
  return toe ? toe.distanceTo(ball.p) : 9;
}

export const heelOf = (p, side) => p.bones[side + 'Foot'].getWorldPosition(V());

// the furthest the boot on `side` has slid since `after` seconds into the move (call it every step)
export function slipWatch({ S }, { player, side, after, t0 }) {
  let start = null, max = 0;
  return () => {
    const sole = player.feet?.[side]?.last;
    if (sole && S.t - t0 > after) { start ||= sole.clone(); max = Math.max(max, Math.hypot(sole.x - start.x, sole.z - start.z)); }
    return max;
  };
}

// he turns (not snaps) to face the ball: his line is from him to it
export function* squareUp({ ball, until }, car) {
  car.face = ball.p; car.faceLock = true;
  yield* until(() => { const want = Math.atan2(ball.p.x - car.pos.x, ball.p.z - car.pos.z), d = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading)); return Math.abs(d) < 0.06; }, 0.25);
}

// close to a touchline, a push that would run the ball out over it is turned back infield
export function keepOffTouchline(car, push) {
  if (Math.abs(car.pos.z) > TOUCHLINE_ZONE && push.z * Math.sign(car.pos.z) > 0) push.z *= -0.4;
}
