// The curves the 3D view's choreography is timed with: a smooth step, an on–hold–off envelope for how much a
// boot or a glove follows its target, and a Catmull-Rom path through a few points.
import { clamp } from './runtime.js';

export const smooth01 = x => x * x * (3 - 2 * x);

// 0 before `start`, rising to 1 at `full`, held until `fade`, back to 0 at `end` (times after t0, seconds)
export function ramp(t0, [start, full, fade, end]) {
  return t => {
    const u = t - t0;
    if (u < start) return 0;
    if (u < full) return (u - start) / (full - start);
    if (u < fade) return 1;
    return u < end ? 1 - (u - fade) / (end - fade) : 0;
  };
}

// one coordinate of the Catmull-Rom segment between b and c at t
function catmullRom([a, b, c, d], t) {
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}

// Catmull-Rom through [x, y] points, u in 0..1
export function spline(pts, u) {
  const n = pts.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return [catmullRom([p0[0], p1[0], p2[0], p3[0]], t), catmullRom([p0[1], p1[1], p2[1], p3[1]], t)];
}
