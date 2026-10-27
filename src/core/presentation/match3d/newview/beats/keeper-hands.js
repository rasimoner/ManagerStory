// A keeper's hands on a high ball into his box: he comes and punches it clear with both fists, or goes up
// and claims it, gathers it into his chest as he lands and keeps it for his next pass.
// `beat` is the director's beat context (director.js, beatContext).
import { V, clamp, BALL_R, MOTIONS } from '../runtime.js';
import { forwardOf, rightOf, headingOf } from '../facing.js';
import { ramp, smooth01 } from '../motion-curves.js';

// V7.9: the height a keeper claims a high ball at, and (V7.9.3) punches one at
export const CLAIM_H = 2.2;
export const PUNCH_H = 2.2;

const round = (v, n) => +v.toFixed(n);
const vec = (v, n = 2) => v.toArray().map(x => round(x, n));
const ballTrace = ({ ball, S }) => [round(S.t, 2), ...vec(ball.p), ...vec(ball.v, 1)];

// ---- the punch: the keeper comes, goes up and punches it clear with both fists (arms driven out through the
// ball at the top of the jump); it flies out to where the engine says it lands ----

// before he goes up: he stands just past the spot along the ball's line, facing it, so the punch meets it in front of him
function punchApproach({ ball }, gk, spot) {
  const toward = V(ball.p.x - gk.pos.x, 0, ball.p.z - gk.pos.z).normalize();
  const fly = V(ball.v.x, 0, ball.v.z), down = fly.lengthSq() > 1 ? fly.normalize() : toward.clone().negate();
  gk.target.copy(spot).addScaledVector(down, 0.3).setY(0);
  const gap = Math.hypot(gk.target.x - gk.pos.x, gk.target.z - gk.pos.z);
  gk.want = gap > 2 ? 7.5 : gap > 0.05 ? Math.max(2.2, 1.5 + gap * 3) : 0;
}

// fists cocked by his face, then driven out through the ball and on (the punch), then down
function punchFists({ ball, S }, gk, { spot, out, lead }) {
  const t0 = S.t, R = () => rightOf(gk), hw = ramp(t0, [0, 0.12, lead + 0.18, lead + 0.45]);
  const face = () => gk.bones.Head.getWorldPosition(V()).addScaledVector(forwardOf(gk), 0.22).add(V(0, -0.05, 0));
  let hit = null;
  // V7.9.5: the fists go for the ball itself once it is close to the spot (a steep, dropping cross passes
  // the spot a little early or low; a keeper punches the ball, not the place he expected it)
  const aim = () => (ball.p.distanceTo(spot) < 1.6 ? ball.p.clone() : spot.clone());
  const fist = side => t => {
    const k = smooth01(clamp((t - (t0 + lead - 0.16)) / 0.16, 0, 1));
    if (t >= t0 + lead + 0.1 && !hit) hit = aim();     // (tracks the ball through the planned contact frame)
    const at = face().lerp(hit || aim(), k);          // (the ball reaches the spot on the contact frame)
    if (t > t0 + lead) at.addScaledVector(out, Math.min(0.3, (t - t0 - lead) * 2.5)).add(V(0, Math.min(0.15, (t - t0 - lead) * 1.2), 0));
    return at.addScaledVector(R(), side * 0.045);
  };
  return { Left: { w: hw, at: fist(-1) }, Right: { w: hw, at: fist(1) } };
}

// the contact is the frame the ball is closest to his fists (it passes the spot on about the planned frame)
function punchMet({ ball, S, rt }, gk, k) {
  const d = rt.handsOf(gk).distanceTo(ball.p);
  if (d < 0.2) return true;
  if (S.t < k.tArr - 0.08) return false;
  if (d > k.best + 0.02 || S.t > k.tArr + 0.1) return true;
  k.best = Math.min(k.best, d);
  return false;
}

function punchStep(beat, gk, k) {
  const { ball, S, rt } = beat, left = k.tArr - S.t;
  gk.face = ball.p; gk.faceLock = true;
  if (!k.jumped) punchApproach(beat, gk, k.spot);
  if (!k.jumped && left <= k.lead) { rt.startMotion(gk, 'header'); k.jumped = true; gk.want = 0; gk.hands = punchFists(beat, gk, k); }
  if (k.trace && k.trace.length < 400) k.trace.push(ballTrace(beat));
  return k.jumped && punchMet(beat, gk, k);
}

// the challenger goes up with him
function challengerJumps({ rt, jumpFor }, { spot, tArr, rival }) {
  if (!rival || rival.busy) return;
  jumpFor(rival, { spot: spot.clone().setY(rt.headHeight).add(V(-Math.sign(spot.x) * 0.6, 0, 0.3)), heading: headingOf(V(spot.x - rival.pos.x, 0, spot.z - rival.pos.z).normalize(), V(0, 0, 0)), tArr, late: 0.12, short: 0.35 });
}

function punchAudit({ ball, S, stats, debug }, k) {
  const { gk, spot, land, tArr, reach } = k;
  const extra = debug ? { t: round(S.t, 2), late: round(S.t - tArr, 2), jumped: k.jumped, kick: stats.crossLog?.at(-1), trace: k.trace?.filter((x, i, a) => i % 10 === 0 || i === a.length - 1), bv: vec(ball.v, 1), via: gk.punchVia, gk: vec(gk.pos), spot: vec(spot), ball: vec(ball.p) } : {};
  return { kind: 'punch', fists: round(reach, 3), h: round(ball.p.y, 2), out: round(Math.hypot(land.x - ball.p.x, land.z - ball.p.z), 1), ...extra };
}

// punched clear to where the engine says it lands, or missed
function punchAway({ ball, S, rt, stats }, gk, { reach, land }) {
  if (reach < 0.45) {
    (stats.contacts.punch ||= []).push(round(reach, 2));
    ball.owner = null; gk.lastTouch = S.t;
    rt.kickAir(V(land.x, BALL_R, land.z), Math.max(0.9, Math.hypot(land.x - ball.p.x, land.z - ball.p.z) / 16));
  } else stats.misses = (stats.misses || 0) + 1;
}

export function* keeperPunch(beat, { gk, spot, tArr, land, rival }) {
  const { ball, S, rt, stats, until, later, debug } = beat;
  gk.busy = true; gk.loopsWant.keeperReady = 0;
  const k = { gk, spot, tArr, land, lead: MOTIONS.header.contact, jumped: false, best: Infinity, trace: debug ? [ballTrace(beat)] : null };
  challengerJumps(beat, { spot, tArr, rival });
  k.out = V(land.x - spot.x, 0, land.z - spot.z).normalize();
  yield* until(() => punchStep(beat, gk, k), Math.max(0.2, tArr - S.t) + 1);
  k.reach = Math.min(k.best, rt.handsOf(gk).distanceTo(ball.p));
  (stats.punches ||= []).push(punchAudit(beat, k));
  punchAway(beat, gk, k);
  const hands = gk.hands;
  later(0.6, () => { if (gk.hands === hands) gk.hands = null; gk.faceLock = false; gk.busy = false; });
}

// ---- the claim: he gets under the high ball, goes up and takes it in both hands above his head (the gloves
// reach for the ball), lands with it, and keeps it in his hands if his next touch is a pass ----
function claimStep({ ball, S, rt }, gk, k) {
  const left = k.tArr - S.t, toward = V(ball.p.x - gk.pos.x, 0, ball.p.z - gk.pos.z).normalize();
  gk.face = ball.p; gk.faceLock = true;
  if (!k.jumped) {
    gk.target.copy(k.spot).addScaledVector(toward, -0.3).setY(0);
    const gap = Math.hypot(gk.target.x - gk.pos.x, gk.target.z - gk.pos.z);
    gk.want = gap > 2 ? 7 : gap > 0.1 ? 1.5 + gap * 3 : 0;
  }
  if (!k.jumped && left <= k.lead) {
    rt.startMotion(gk, 'header'); k.jumped = true; gk.want = 0;
    const hw = ramp(S.t, [0, 0.2, k.lead + 0.12, k.lead + 0.4]), R = () => rightOf(gk);
    gk.hands = { Left: { w: hw, at: () => ball.p.clone().addScaledVector(R(), -0.1) }, Right: { w: hw, at: () => ball.p.clone().addScaledVector(R(), 0.1) } };
  }
  return k.jumped && (rt.handsOf(gk).distanceTo(ball.p) < 0.22 || S.t > k.tArr + 0.1);
}

// he did not get there (or it had dropped below his reach up): no catch out of thin air, he gathers it as it comes
function* claimMissed({ ball, S, stats, chase, noteFix }, gk) {
  gk.hands = null; gk.faceLock = false; stats.lastFail = ['claim', 'reach', round(S.t, 1)];
  const ok = yield* chase(gk, null);
  if (!ok) { noteFix(gk, 'pass'); ball.owner = gk; ball.p.set(gk.pos.x + Math.sin(gk.heading) * .5, BALL_R, gk.pos.z + Math.cos(gk.heading) * .5); ball.v.set(0, 0, 0); }
  gk.busy = false;
  return false;
}

// he gathers it into his chest as he comes down
function gatherToChest({ ball, S, later }, gk) {
  const tc = S.t, chest = () => gk.bones.Spine2.getWorldPosition(V()).addScaledVector(forwardOf(gk), 0.26).add(V(0, -0.05, 0)), R = () => rightOf(gk);
  const gather = t => smooth01(clamp((t - tc) / 0.35, 0, 1)), hold = ramp(tc, [0, 0.001, 1.5, 1.9]);
  const at = side => t => ball.p && chest().lerp(gk.hands?.[side]?.last || chest(), 1 - gather(t)).addScaledVector(R(), side === 'Left' ? -0.12 : 0.12);
  gk.hands = { Left: { w: hold, at: at('Left') }, Right: { w: hold, at: at('Right') } };
  const hands = gk.hands; later(2, () => { if (gk.hands === hands) gk.hands = null; });
}

// he keeps it in his hands when his next touch is a pass; otherwise he puts it down in front of him
const NEXT_TOUCH = ['pass', 'cross', 'press', 'tackle', 'hold', 'dribble', 'ballCarry', 'interception', 'shot'];
function keepOrPutDown({ ball, events }, gk, ev) {
  const i = events.indexOf(ev), next = i >= 0 ? events.slice(i + 1, i + 5).find(x => NEXT_TOUCH.includes(x.type)) : null;
  if (next && next.type === 'pass' && next.fromId === gk.id && next.fromSide === gk.side) gk.holding = true;
  else { const f = forwardOf(gk); ball.held = null; ball.v.set(f.x * 0.9, 0, f.z * 0.9); }
}

export function* keeperClaim(beat, { gk, spot, tArr, ev }) {
  const { ball, S, rt, stats, until, wait, debug } = beat;
  gk.busy = true; gk.loopsWant.keeperReady = 0;
  const k = { spot, tArr, lead: MOTIONS.header.contact, jumped: false };
  yield* until(() => claimStep(beat, gk, k), Math.max(0.2, tArr - S.t) + 1);
  const reach = rt.handsOf(gk).distanceTo(ball.p);
  if (reach > 0.4 || ball.p.y < 1.6) return yield* claimMissed(beat, gk);
  const audit = { kind: 'claim', hands: round(reach, 3), h: round(ball.p.y, 2), ...(debug ? { t: round(S.t, 2), tArr: round(tArr, 2), gk: vec(gk.pos), spot: vec(spot) } : {}) };
  (stats.claims ||= []).push(audit);
  ball.held = rt.pickUp(() => rt.handsOf(gk), 0.06); ball.owner = gk; ball.v.set(0, 0, 0); gk.lastTouch = S.t;
  gatherToChest(beat, gk);
  yield* until(() => !gk.motion, 1.4);
  gk.faceLock = false;
  yield* wait(0.6);
  keepOrPutDown(beat, gk, ev);
  gk.busy = false;
  return true;
}
