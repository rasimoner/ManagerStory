// The keeper's scenarios for a staged special move (staging.js): distribution from his hands and at his
// feet, crosses he claims or punches, shots he saves (diving, at his feet, a penalty, Higuita's scorpion).
// `beat` is the director's beat context (director.js, beatContext); `scene` is what stageScene() set up.
import { V, GOAL_X, BALL_R } from '../runtime.js';
import { PUNCH_H, keeperPunch } from './keeper-hands.js';
import { keeperOf, noEvent, otherSide, outfieldOf, pitchPercent } from './stage-pitch.js';

const nearestTo = (list, at) => list.sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at))[0];
const shotFrom = (rt, shooter, { from, gs }) => rt.place(shooter, from.clone().addScaledVector(V(gs, 0, 0), -1), Math.atan2(gs, 0));
function ballAt({ ball }, owner, at) { ball.owner = owner; ball.p.copy(at).setY(BALL_R); ball.v.set(0, 0, 0); }

// our keeper with the ball in his hands throws it out to a full-back (or volleys it up to a man near halfway)
function* fromHands(beat, scene, kind) {
  const { rt, ball, ownGoalX, pass, wait } = beat, { star } = scene;
  const gk = keeperOf(rt, star.side), own = Math.sign(ownGoalX(star.side));
  rt.place(gk, V(own * 45, 0, 2), Math.atan2(-own, 0)); ball.owner = gk; ball.v.set(0, 0, 0); ball.p.copy(rt.handsOf(gk));
  ball.held = rt.pickUp(() => rt.handsOf(gk), 0.01); gk.holding = true;
  const mate = nearestTo(outfieldOf(rt, star.side).filter(q => q !== gk), gk.pos);
  rt.place(mate, kind === 'gkvolley' ? V(own * 2, 0, -10) : V(own * 30, 0, 16));
  yield* wait(0.8);
  yield* pass({ from: gk, to: mate, toW: mate.pos.clone(), travel: 'ground', implicit: false }, { ev: noEvent() });
  yield* wait(1.5);
}

// a cross into the box that the keeper comes and takes in the air
function* claim(beat, scene) {
  const { rt, pass, wait } = beat, { star, fx: gs } = scene, line = gs * GOAL_X, gk = keeperOf(rt, otherSide(star.side));
  const from = V(line - gs * 14, 0, 27);
  rt.place(star, from.clone().add(V(-gs * 1, 0, 0)), Math.atan2(gs, 0)); ballAt(beat, star, from);
  if (gk) rt.place(gk, V(line - gs * 1.5, 0, 0), Math.atan2(-gs, 0));
  yield* pass({ from: star, to: gk, toW: V(line - gs * 5.5, 0, 2.5), travel: 'aerial', implicit: false }, { ev: noEvent() });
  yield* wait(1.5);
}

// our keeper runs out with the ball at his feet, then plays it
function* carryOut(beat, scene) {
  const { rt, ball, ownGoalX, carry, pass, wait } = beat, { star } = scene;
  const gk = keeperOf(rt, star.side), own = Math.sign(ownGoalX(star.side));
  const from = V(own * 46, 0, -4);
  rt.place(gk, from, Math.atan2(-own, 0)); ball.owner = gk; ball.held = null; ball.p.copy(from).addScaledVector(V(-own, 0, 0), 0.5).setY(BALL_R); ball.v.set(0, 0, 0);
  yield* carry(gk, V(own * 26, 0, 6), 5);
  const mate = nearestTo(outfieldOf(rt, star.side).filter(q => q !== gk), gk.pos);
  yield* pass({ from: gk, to: mate, toW: mate.pos.clone(), travel: 'ground', implicit: false }, { ev: noEvent() });
  yield* wait(1.5);
}

// a low shot just beside him, kept out with the foot
function* footSave(beat, scene) {
  const { rt, shot, wait, events } = beat, { star, fx: gs } = scene, line = gs * GOAL_X, gk = keeperOf(rt, otherSide(star.side));
  const from = V(line - gs * 15, 0, 3);
  shotFrom(rt, star, { from, gs }); ballAt(beat, star, from);
  if (gk) rt.place(gk, V(line - gs * 2.5, 0, 0), Math.atan2(-gs, 0));
  yield* shot({ eventId: -6, type: 'shot', fromId: star.id, fromSide: star.side, outcome: 'save', fromPos: pitchPercent(from), toPos: [gs > 0 ? 100 : 0, 51], devSave: { saveType: 'PARRY', toPos: [gs > 0 ? 88 : 12, 70] }, devFoot: true }, events.length + 10);
  yield* wait(2);
}

// our goal: which way it is, and our keeper
function ourGoal({ rt, ownGoalX }) {
  const gs = Math.sign(ownGoalX('user'));
  return { gs, line: gs * GOAL_X, gk: keeperOf(rt, 'user') };
}

// a cross into our box with their man going for it: our keeper comes and punches it clear
function* punch(beat) {
  const { rt, wait, pass } = beat, { gs, line, gk } = ourGoal(beat);
  const crosser = outfieldOf(rt, 'opp')[0], striker = outfieldOf(rt, 'opp').filter(q => q !== crosser)[0];
  const from = V(line - gs * 20, 0, 28), spot = V(line - gs * 6.5, 0, 1.5);
  rt.place(crosser, from.clone().add(V(0, 0, 1)), Math.atan2(0, -1)); ballAt(beat, crosser, from);
  rt.place(striker, V(line - gs * 11, 0, 3));
  if (gk) rt.place(gk, V(line - gs * 1.5, 0, 0), Math.atan2(-gs, 0));
  yield* wait(0.5);
  let meet = null;
  gk.busy = true; gk.loopsWant.keeperReady = 0;
  yield* pass({ from: crosser, to: null, toW: spot, travel: 'aerial', implicit: false }, { height: PUNCH_H, meet: tArr => { meet = tArr; }, ev: { eventId: -31 } });
  yield* keeperPunch(beat, { gk, spot: spot.clone().setY(PUNCH_H), tArr: meet, land: V(line - gs * 26, 0, 12), rival: striker });
  yield* wait(2.5);
}

// our outfield players near our goal are moved up the pitch: he is through on his own
function clearOurHalf(rt, { gs, line }) {
  for (const q of rt.players) if (!q.offPitch && q.side === 'user' && q.role !== 'GK' && Math.abs(q.pos.x - line) < 30) rt.place(q, V(line - gs * 34, 0, q.pos.z * 0.5));
}

// a man through on our goal: our keeper comes out; saved at his feet, or beaten
function* rushOut(beat, scene, kind) {
  const { rt, shot, wait, events } = beat, { gs, line, gk } = ourGoal(beat);
  const shooter = outfieldOf(rt, 'opp')[0], from = V(line - gs * 13, 0, -4);
  clearOurHalf(rt, { gs, line });
  shotFrom(rt, shooter, { from, gs }); ballAt(beat, shooter, from);
  if (gk) rt.place(gk, V(line - gs * 1.5, 0, 0), Math.atan2(-gs, 0));
  const saved = kind === 'gkrush';
  yield* shot({ eventId: saved ? -21 : -22, type: 'shot', devRush: true, fromId: shooter.id, fromSide: 'opp', outcome: saved ? 'save' : 'goal', fromPos: pitchPercent(from), toPos: [gs > 0 ? 100 : 0, 46], devSave: { saveType: saved ? 'CATCH' : 'PARRY' } }, events.length + 10);
  yield* wait(2.5);
}

// a penalty against us: our keeper on his line saves it, or is beaten
function* penalty(beat, scene, kind) {
  const { rt, shot, wait, events } = beat, { gs, line, gk } = ourGoal(beat);
  const shooter = outfieldOf(rt, 'opp')[0], spot = V(line - gs * 11, 0, 0);
  rt.place(shooter, spot.clone().add(V(-gs * 1.8, 0, 0)), Math.atan2(gs, 0)); ballAt(beat, shooter, spot);
  if (gk) rt.place(gk, V(line - gs * 1.5, 0, 1), Math.atan2(-gs, 0));
  const saved = kind === 'gkpen';
  yield* shot({ eventId: saved ? -11 : -12, type: 'shot', penalty: true, fromId: shooter.id, fromSide: 'opp', outcome: saved ? 'save' : 'goal', fromPos: pitchPercent(spot), toPos: [gs > 0 ? 100 : 0, 58], devSave: { saveType: 'PARRY', toPos: [gs > 0 ? 92 : 8, 80] } }, events.length + 10);
  yield* wait(2.5);
}

// our keeper, a looping shot from distance dropping onto him
function* scorpion(beat) {
  const { rt, shot, wait, events, setTry } = beat, { gs, line, gk } = ourGoal(beat);
  const shooter = outfieldOf(rt, 'opp')[0], from = V(line - gs * 26, 0, 4);
  shotFrom(rt, shooter, { from, gs }); ballAt(beat, shooter, from);
  if (gk) rt.place(gk, V(line - gs * 3, 0, 0.5), Math.atan2(-gs, 0));
  setTry('scorpion');
  yield* shot({ eventId: -1, type: 'shot', fromId: shooter.id, fromSide: 'opp', outcome: 'save', fromPos: pitchPercent(from), toPos: [gs > 0 ? 100 : 0, 50], devSave: { saveType: 'PARRY', toPos: [gs > 0 ? 80 : 20, 40] } }, events.length + 10);
  yield* wait(2.5);
}

// our keeper's star save: a shot high into his far corner, and he flies to tip it out (the save the match
// marks as a star moment; event 16 is the staged star reach)
function* ownStarSave(beat) {
  const { rt, shot, wait, events } = beat, { gs, line, gk } = ourGoal(beat);
  const shooter = outfieldOf(rt, 'opp')[0], from = V(line - gs * 21, 0, 5);
  shotFrom(rt, shooter, { from, gs }); ballAt(beat, shooter, from);
  if (gk) rt.place(gk, V(line - gs * 2.5, 0, 0), Math.atan2(-gs, 0));
  yield* shot({ eventId: 16, type: 'shot', fromId: shooter.id, fromSide: 'opp', outcome: 'save', fromPos: pitchPercent(shooter.pos), toPos: [gs > 0 ? 100 : 0, 60], devSave: { saveType: 'PARRY' } }, events.length + 10);
  yield* wait(2.5);
}

// a shot at their keeper saved: a dive and a parry, one straight at him and caught, the keeper shuffling
// across his goal as the man carries it across the box first, a star save, or one turned round the post
const SAVE_AIM = { gkcatch: 50, gkmove: 42 }, SAVE_TYPE = { gkcatch: 'CATCH', gkcorner: 'DEFLECT_CORNER' };
function* shotSaved(beat, scene, kind) {
  const { rt, ball, carry, shot, until, wait, events, stats } = beat, { star, fx: gs } = scene, line = gs * GOAL_X, gk = keeperOf(rt, otherSide(star.side));
  const from = V(line - gs * 21, 0, kind === 'gkmove' ? -12 : 5);
  shotFrom(rt, star, { from, gs }); ballAt(beat, star, from);
  if (gk) rt.place(gk, V(line - gs * 2.5, 0, 0), Math.atan2(-gs, 0));
  if (kind === 'gkmove') yield* carry(star, V(line - gs * 19, 0, 9), 3.2);
  yield* shot({ eventId: kind === 'gkstar' ? 16 : -1, type: 'shot', fromId: star.id, fromSide: star.side, outcome: 'save', fromPos: pitchPercent(star.pos), toPos: [gs > 0 ? 100 : 0, SAVE_AIM[kind] ?? 60], devSave: { saveType: SAVE_TYPE[kind] ?? 'PARRY' } }, events.length + 10);
  if (kind === 'gkcorner') { ball.allowOut = true; yield* until(() => ball.out, 3); stats.cornerOut = ball.p.toArray().map(v => +v.toFixed(2)); }
  yield* wait(2.5);
}

const withKind = (scenario, kind) => (beat, scene) => scenario(beat, scene, kind);
export const KEEPER_STAGINGS = {
  gkthrow: withKind(fromHands, 'gkthrow'), gkvolley: withKind(fromHands, 'gkvolley'),
  gkclaim: claim, gkcarry: carryOut, gkfoot: footSave, gkpunch: punch,
  gkrush: withKind(rushOut, 'gkrush'), gkrushgoal: withKind(rushOut, 'gkrushgoal'),
  gkpen: withKind(penalty, 'gkpen'), gkpengoal: withKind(penalty, 'gkpengoal'),
  scorpion, gkstarown: ownStarSave,
  ...Object.fromEntries(['gksave', 'gkcatch', 'gkmove', 'gkstar', 'gkcorner'].map(kind => [kind, withKind(shotSaved, kind)])),
};
