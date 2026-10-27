// V7.9: Higuita's scorpion kick (Colombia v England, Wembley 1995) — our own version: the ball loops down onto
// him, he throws himself forward face down, the legs fold up over his back and the heels send it back out;
// he lands on his hands and chest and gets up.
// `beat` is the director's beat context (director.js, beatContext).
import { V, clamp } from '../runtime.js';
import { ACTIONS } from '../actions.js';
import { forwardOf, rightOf } from '../facing.js';
import { ramp, smooth01 } from '../motion-curves.js';
import { toeGap } from './footwork.js';

// how long before the strike he leaves the ground (seconds)
export const SCORPION_LEAD = 0.55;

// flat in the air at about hip height (he flies, not a nose-dive), then down onto his hands and chest
function flipAt(T, t) {
  const u = t - (T - SCORPION_LEAD);
  if (u < 0) return { pitch: 0, lift: 0 };
  if (u < SCORPION_LEAD) { const k = smooth01(u / SCORPION_LEAD); return { pitch: -1.45 * k, lift: 0.16 * Math.sin(Math.PI * k) }; }
  const v = u - SCORPION_LEAD;
  if (v < 0.4) { const k = smooth01(v / 0.4); return { pitch: -1.45 - 0.11 * k, lift: -0.82 * k }; }
  return { pitch: -1.56, lift: -0.82 };          // he lies there until he rolls over to get up (runtime)
}

// his body through the kick: where he is, which way he faces and how he is tipped, for a strike at T
export function scorpionBody(gk, T) {
  const F = forwardOf(gk), h = gk.heading, at0 = gk.pos.clone();
  return {
    pos: t => { const k = smooth01(clamp((t - (T - SCORPION_LEAD)) / 0.9, 0, 1)); return at0.clone().addScaledVector(F, 1.2 * k); },
    heading: () => h,
    flip: t => flipAt(T, t),
  };
}

// where the heels meet the ball: above his back as he lies flat in the air
export function scorpionSpot(gk, T, body) {
  const fl = body.flip(T), hips = body.pos(T).setY(0.95 + fl.lift);
  return hips.addScaledVector(forwardOf(gk), 0.18).add(V(0, 0.58, 0));          // over his back, behind his head (the heels never come past it)
}

// the heels reach the ball with the knees folding up behind him (not forwards), going to where the ball will
// be at the strike (above his back), not chasing it forwards early; arms out in front in flight (Superman),
// then down to the grass to land on
function scorpionLimbs(gk, { T, body, F }) {
  const w = ramp(T - 0.32, [0, 0.26, 0.38, 0.52]), R = () => rightOf(gk), behind = () => F.clone().negate().add(V(0, 1.2, 0));
  const spot = scorpionSpot(gk, T, body);
  gk.feet = { Left: { w, at: () => spot.clone().addScaledVector(R(), -0.09), pole: behind }, Right: { w, at: () => spot.clone().addScaledVector(R(), 0.09), pole: behind } };
  const hw = ramp(T - SCORPION_LEAD + 0.05, [0, 0.2, 1.6, 2.0]), hips = () => gk.bones.Hips.getWorldPosition(V());
  const hand = side => t => {
    const fly = hips().addScaledVector(F, 1.15).addScaledVector(R(), side * 0.22).add(V(0, 0.2, 0));
    const land = gk.pos.clone().addScaledVector(F, 0.7).addScaledVector(R(), side * 0.28).setY(0.06);
    return fly.lerp(land, smooth01(clamp((t - T - 0.05) / 0.3, 0, 1)));
  };
  gk.hands = { Left: { w: hw, at: hand(-1) }, Right: { w: hw, at: hand(1) } };
}

// the heels on the ball, and how far the boots are behind his head along his line of flight (they must not come out past it)
function scorpionAudit({ ball, S, debug }, gk, { F, near }) {
  const fl = gk.flip(S.t), audit = { kind: 'scorpion', contact: +near().toFixed(3), pitch: +(fl?.pitch ?? 0).toFixed(2), h: +ball.p.y.toFixed(2) };
  const head = gk.bones.Head.getWorldPosition(V()), toes = gk.toes.map(t => t.getWorldPosition(V()).sub(head).dot(F));
  audit.behindHead = +(-Math.max(...toes)).toFixed(2);
  if (debug) { const hp = gk.bones.Hips.getWorldPosition(V()), d = q => +q.clone().sub(hp).dot(F).toFixed(2) + '/' + q.y.toFixed(2); audit.dbg = { head: d(head), toeL: d(gk.toes[0].getWorldPosition(V())), toeR: d(gk.toes[1].getWorldPosition(V())), ball: d(ball.p), heel: d(gk.bones.LeftFoot.getWorldPosition(V())) }; }
  return audit;
}

// down on his hands and chest, he lies a moment, pushes himself up into a crouch and stands up from it
// (V7.9.8: he no longer rolls over onto his back first)
function getUpAfter({ S, rt, hooks, later, debug }, gk, audit) {
  const feet = gk.feet, hands = gk.hands;
  later(0.9, () => {
    if (gk.feet === feet) gk.feet = null; if (gk.hands === hands) gk.hands = null;
    rt.riseFromFront(gk);
    if (debug) audit.rise = { t0: S.t };
  });
  later(0.9 + 0.25 + 0.7 + 0.7 + 0.6, () => { gk.faceLock = false; gk.busy = false; hooks.slow(1); });
}

export function* scorpionSave(beat, gk, { T, body }) {
  const { ball, S, rt, hooks, stats, until, noteSkill } = beat, F = forwardOf(gk);
  gk.busy = true; gk.faceLock = true; gk.loopsWant.keeperReady = 0; gk.act = null; gk.motion = null;
  yield* until(() => { gk.target.copy(gk.pos); gk.want = 0; gk.vel.set(0, 0, 0); return S.t >= T - SCORPION_LEAD; }, Math.max(0, T - SCORPION_LEAD - S.t) + 0.1);
  hooks.slow(0.4); ball.through = T + 1; hooks.cam('close', gk);         // the live picture goes to him
  gk.drive = { pos: body.pos, heading: body.heading }; gk.flip = body.flip;
  rt.startAction(gk, 'scorpion'); gk.act.t0 = T - ACTIONS.scorpion.dur * ACTIONS.scorpion.contact;
  scorpionLimbs(gk, { T, body, F });
  const near = () => Math.min(toeGap(ball, gk, 'Left'), toeGap(ball, gk, 'Right'));
  yield* until(() => S.t >= T - 0.02 && near() < 0.22 || S.t >= T + 0.06, T - S.t + 0.3);
  const audit = scorpionAudit(beat, gk, { F, near });
  (stats.contacts.save ||= []).push(+near().toFixed(2));
  noteSkill(audit, gk);
  getUpAfter(beat, gk, audit);
}
