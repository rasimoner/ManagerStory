// V7.9 star replay: the last few seconds of the pitch are kept (every player's body and the ball), so a
// special move can be shown again straight away, slowly, from a close camera. Only the picture is
// replayed: the match itself (engine, director, clock) waits while it plays.
import * as THREE from '../vendor/three/three.module.min.js';

export function createReplay({ frames = 360, minDt = 1 / 100 } = {}) {
  const times = new Float64Array(frames), recs = new Map(), ballRec = new Float32Array(frames * 7);
  let head = 0, count = 0;
  const layout = p => {
    let r = recs.get(p.key);
    if (!r) {
      const bones = Object.values(p.bones), stride = 3 + 4 + 3 + bones.length * 4 + 1;
      r = { bones, stride, hips: p.bones.Hips, data: new Float32Array(frames * stride) };
      recs.set(p.key, r);
    }
    return r;
  };
  const q = new THREE.Quaternion(), arr = [0, 0, 0, 0];

  // one frame of the pitch as it is drawn now (call after the bodies are posed)
  function record(rt, ballMesh) {
    const t = rt.S.t;
    if (count && t - times[(head - 1 + frames) % frames] < minDt) return;
    const i = head;
    times[i] = t;
    for (const p of rt.players) {
      const r = layout(p), d = r.data, o = i * r.stride, m = p.model;
      d[o] = m.position.x; d[o + 1] = m.position.y; d[o + 2] = m.position.z;
      d[o + 3] = m.quaternion.x; d[o + 4] = m.quaternion.y; d[o + 5] = m.quaternion.z; d[o + 6] = m.quaternion.w;
      const h = r.hips.position; d[o + 7] = h.x; d[o + 8] = h.y; d[o + 9] = h.z;
      let k = o + 10;
      for (const b of r.bones) { d[k++] = b.quaternion.x; d[k++] = b.quaternion.y; d[k++] = b.quaternion.z; d[k++] = b.quaternion.w; }
      d[k] = m.visible && !p.offPitch ? 1 : 0;
    }
    // a player not on the pitch in this frame (added later, or gone) is hidden in it
    for (const [key, r] of recs) if (!rt.players.some(p => p.key === key)) r.data[i * r.stride + r.stride - 1] = 0;
    const b = i * 7, bq = ballMesh.quaternion;
    ballRec[b] = rt.ball.p.x; ballRec[b + 1] = rt.ball.p.y; ballRec[b + 2] = rt.ball.p.z;
    ballRec[b + 3] = bq.x; ballRec[b + 4] = bq.y; ballRec[b + 5] = bq.z; ballRec[b + 6] = bq.w;
    head = (head + 1) % frames; count = Math.min(frames, count + 1);
  }
  const at = k => (head - count + k + frames * 2) % frames;
  const span = () => count ? [times[at(0)], times[at(count - 1)]] : [0, 0];
  // the two kept frames around sim time t, and how far between them
  function find(t) {
    let lo = 0, hi = count - 1;
    if (t <= times[at(0)]) return [at(0), at(0), 0];
    if (t >= times[at(hi)]) return [at(hi), at(hi), 0];
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[at(mid)] <= t) lo = mid; else hi = mid; }
    const a = at(lo), b = at(hi), ta = times[a], tb = times[b];
    return [a, b, tb > ta ? (t - ta) / (tb - ta) : 0];
  }
  const lerp = (d, a, b, k) => d[a] + (d[b] - d[a]) * k;
  function slerpInto(target, d, a, b, k) { THREE.Quaternion.slerpFlat(arr, 0, d, a, d, b, k); target.set(arr[0], arr[1], arr[2], arr[3]); }

  // put the pitch back as it was at sim time t
  function apply(rt, ballMesh, t) {
    const [i, j, k] = find(t);
    for (const p of rt.players) {
      const r = recs.get(p.key); if (!r) { p.model.visible = false; continue; }
      const d = r.data, a = i * r.stride, b = j * r.stride, m = p.model;
      const vis = d[a + r.stride - 1] > 0.5 && d[b + r.stride - 1] > 0.5;
      m.visible = vis; if (!vis) continue;
      m.position.set(lerp(d, a, b, k), lerp(d, a + 1, b + 1, k), lerp(d, a + 2, b + 2, k));
      slerpInto(m.quaternion, d, a + 3, b + 3, k);
      r.hips.position.set(lerp(d, a + 7, b + 7, k), lerp(d, a + 8, b + 8, k), lerp(d, a + 9, b + 9, k));
      let o = 10;
      for (const bone of r.bones) { slerpInto(bone.quaternion, d, a + o, b + o, k); o += 4; }
    }
    const a = i * 7, b = j * 7;
    ballMesh.position.set(lerp(ballRec, a, b, k), lerp(ballRec, a + 1, b + 1, k), lerp(ballRec, a + 2, b + 2, k));
    slerpInto(ballMesh.quaternion, ballRec, a + 3, b + 3, k);
    return ballMesh.position;
  }
  // where a player stood at sim time t
  function posOf(key, t, out = new THREE.Vector3()) {
    const r = recs.get(key); if (!r || !count) return null;
    const [i, j, k] = find(t), d = r.data, a = i * r.stride, b = j * r.stride;
    return out.set(lerp(d, a, b, k), 0, lerp(d, a + 2, b + 2, k));
  }
  function clear() { head = count = 0; recs.clear(); }
  return { record, apply, posOf, span, clear, get count() { return count; } };
}

// what the replay card says about each move
export const STAR_MOVES = {
  stepover: { name: 'MAKAS', line: 'Ayak topun önünden döner, top yerinde kalır: savunmacı yanlış tarafa gider.' },
  nutmeg: { name: 'BACAK ARASI', line: 'Savunmacı ayaklarını açınca top tam aradan geçer.' },
  elastico: { name: 'ELASTICO', line: 'Dış ayakla dışarı, aynı ayakla içeri: tek ayakla iki dokunuş.' },
  nolook: { name: 'BAKMADAN PAS', line: 'Başı bir yana bakarken pas öbür yana gider.' },
};
