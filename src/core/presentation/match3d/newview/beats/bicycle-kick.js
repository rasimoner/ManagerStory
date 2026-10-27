// The bicycle kick: back to goal under the cross, he throws himself up and over backwards and the right boot
// meets the ball above his head; he lands on his back and gets up.
// `beat` is the director's beat context (director.js, beatContext); `cross` is { spot, tArr } of the cross.
import { V, clamp } from '../runtime.js';
import { smooth01 } from '../motion-curves.js';
import { toeGap } from './footwork.js';

// over backwards: up to just past horizontal at the strike (T), down onto his back, then up again
function overBackwards(t0, T) {
  return t => {
    const u = t - t0, c = T - t0;
    if (u < c) { const k = smooth01(u / c); return { pitch: 1.75 * k, lift: 0.8 * k }; }
    const v = u - c;
    if (v < 0.35) { const k = smooth01(v / 0.35); return { pitch: 1.75 + 0.2 * k, lift: 0.8 - 0.62 * k }; }
    if (v < 0.95) return { pitch: 1.95, lift: 0.18 };
    if (v < 1.45) { const k = smooth01((v - 0.95) / 0.5); return { pitch: 1.95 * (1 - k), lift: 0.18 * (1 - k) }; }
    return null;
  };
}

// he gets under the cross, his back to goal, half a second before it comes
function* underTheCross({ S, until }, p, { cross, aim }) {
  const toGoal = V(aim.x - cross.spot.x, 0, aim.z - cross.spot.z).normalize(), face = toGoal.clone().negate();
  const stand = cross.spot.clone().setY(0).addScaledVector(toGoal, -0.55), tArr = cross.tArr;
  p.busy = true; p.face = stand.clone().addScaledVector(face, 20); p.faceLock = true;
  yield* until(() => { p.target.copy(stand); const d = Math.hypot(stand.x - p.pos.x, stand.z - p.pos.z); p.want = d > 2 ? 7 : d > 0.1 ? 2 + d * 3 : 0; return S.t >= tArr - 0.5; }, Math.max(0.1, tArr - S.t));
  return Math.atan2(face.x, face.z);
}

export function* bicycleKick(beat, p, { cross, aim }) {
  const { ball, S, rt, hooks, until, later, noteSkill } = beat, T = cross.tArr;
  const h = yield* underTheCross(beat, p, { cross, aim });
  const t0 = S.t, at = p.pos.clone();
  hooks.slow(0.4);
  ball.through = T + 1;
  p.drive = { pos: () => at, heading: () => h };
  p.flip = overBackwards(t0, T);
  rt.startAction(p, 'bicycle');
  p.feet = { Right: { w: t => clamp((t - (T - 0.3)) / 0.25, 0, 1) * (t < T + 0.15 ? 1 : Math.max(0, 1 - (t - T - 0.15) / 0.2)), at: () => ball.p.clone() } };
  const audit = { kind: 'bicycle' };
  yield* until(() => S.t >= T || toeGap(ball, p, 'Right') < 0.18, T - S.t + 0.3);
  const fl = p.flip(S.t);
  Object.assign(audit, { contact: +toeGap(ball, p, 'Right').toFixed(3), pitch: +(fl?.pitch ?? 0).toFixed(2), h: +ball.p.y.toFixed(2) });
  noteSkill(audit, p);
  const feet = p.feet;
  later(1.6, () => { p.drive = null; p.flip = null; if (p.feet === feet) p.feet = null; p.faceLock = false; p.busy = false; });
}
