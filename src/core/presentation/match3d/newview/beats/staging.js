// A special move staged outside the flow of a match (the star transfer scene's show, "İzle"): the player who
// has the move is put in the opponents' half with the ball, a defender comes to him, and the move is made
// exactly as in a match. The keeper's scenarios are in staging-keeper.js.
// `beat` is the director's beat context (director.js, beatContext); `scene` is what stageScene() set up.
import { V, GOAL_X, BALL_R } from '../runtime.js';
import { forwardOf } from '../facing.js';
import { SKILL_BEATS } from './skill-beats.js';
import { KEEPER_STAGINGS } from './staging-keeper.js';
import { keeperOf, noEvent, otherSide, outfieldOf, pitchPercent } from './stage-pitch.js';

// everyone stops; the star with the ball in the opponents' half facing their goal, a defender in front of him
export function stageScene(beat, { star, seed = -1 }) {
  const { rt, ball, ownGoalX } = beat;
  const fx = -Math.sign(ownGoalX(star.side)), at = V(fx * 22, 0, 6);
  const nearest = list => list.sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at))[0];
  const def = nearest(outfieldOf(rt, otherSide(star.side)));
  for (const p of rt.players) p.busy = false;
  rt.place(star, at); star.heading = Math.atan2(fx, 0);
  ball.owner = star; ball.held = null; ball.v.set(0, 0, 0); ball.p.set(at.x + fx * 0.5, BALL_R, at.z);
  rt.place(def, V(at.x + fx * 9, 0, at.z + 1)); def.heading = Math.atan2(-fx, 0);
  const mateOf = () => nearest(outfieldOf(rt, star.side).filter(q => q !== star));
  return { star, def, fx, at, seed, mateOf };
}

// a pass with something special about how it is played (heel, rabona) or met (turn, trap)
function* backheelOrRabona(beat, scene, kind) {
  const { rt, carry, pass, setTry } = beat, { star, fx, at } = scene;
  const mate = scene.mateOf();
  const spot = kind === 'backheel' ? V(at.x - fx * 9, 0, at.z - 3) : V(at.x + fx * 16, 0, at.z - 14);
  rt.place(mate, spot.clone().addScaledVector(V(fx, 0, 0), kind === 'backheel' ? -1 : 2));
  yield* carry(star, V(at.x + fx * 4, 0, at.z), 3.5);
  setTry(kind);
  yield* pass({ from: star, to: mate, toW: spot, travel: kind === 'rabona' ? 'aerial' : 'ground', implicit: false }, { ev: noEvent() });
}

function* pirouette(beat, scene) {
  const { rt, ball, pass, setTry } = beat, { star, fx, at } = scene;
  const mate = scene.mateOf();
  rt.place(mate, V(at.x - fx * 18, 0, at.z - 4)); ball.owner = mate; ball.p.copy(mate.pos).addScaledVector(V(fx, 0, 0), 0.5).setY(BALL_R); ball.v.set(0, 0, 0);
  rt.place(star, V(at.x, 0, at.z), Math.atan2(-fx, 0)); setTry('pirouette');
  yield* pass({ from: mate, to: star, toW: V(at.x - fx * 0.6, 0, at.z), travel: 'ground', implicit: false }, { ev: noEvent() });
}

function* trap(beat, scene) {
  const { rt, ball, pass, setTry } = beat, { star, fx, at } = scene;
  const mate = scene.mateOf();
  rt.place(mate, V(at.x - fx * 30, 0, at.z - 6));
  ball.owner = mate; ball.p.copy(mate.pos).addScaledVector(V(fx, 0, 0), 0.5).setY(BALL_R);
  rt.place(star, V(at.x, 0, at.z)); setTry('trap');
  yield* pass({ from: mate, to: star, toW: V(at.x + fx * 0.5, 0, at.z), travel: 'aerial', implicit: false }, { ev: noEvent() });
}

// a finish: the penalty chipped down the middle, or the keeper lifted over as he comes out
function* panenkaOrChip(beat, scene, kind) {
  const { rt, ball, shot, events, setTry } = beat, { star, fx: gs } = scene, line = gs * GOAL_X;
  const from = kind === 'panenka' ? V(line - gs * 11, 0, 0) : V(line - gs * 17, 0, 4);
  rt.place(star, from.clone().addScaledVector(V(gs, 0, 0), -1)); ball.owner = star; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
  const gk = keeperOf(rt, otherSide(star.side));
  if (gk) rt.place(gk, V(line - gs * 0.5, 0, 0));
  setTry(kind);
  yield* shot({ eventId: -1, type: 'shot', fromId: star.id, fromSide: star.side, penalty: kind === 'panenka', outcome: 'goal', fromPos: pitchPercent(from), toPos: gs > 0 ? [100, 50] : [0, 50] }, events.length + 10);
}

// an open-play cross from out wide met at the near post with a header, or (the bicycle kick) with an overhead kick
function* crossMet(beat, scene, { kind, eventId }) {
  const { rt, ball, S, pass, shot, wait, events, setTry } = beat, { star, fx: gs } = scene, line = gs * GOAL_X;
  const header = kind === 'crosshead', mate = scene.mateOf();
  const spot = V(line - gs * (header ? 7 : 9), rt.headHeight, header ? 3 : 1.5);
  rt.place(mate, V(line - gs * (header ? 16 : 14), 0, header ? 27 : 26)); ball.owner = mate; ball.p.copy(mate.pos).add(V(gs * 0.5, 0, 0)).setY(BALL_R); ball.v.set(0, 0, 0);
  if (header) rt.place(star, V(spot.x - gs * 6, 0, spot.z - 4));
  else { rt.place(star, V(spot.x - gs * 1.5, 0, spot.z + 2)); setTry('bicycle'); }
  const want = header ? 6.5 : 6;
  yield* pass({ from: mate, to: star, toW: spot.clone().setY(0), travel: 'aerial', implicit: false }, { height: rt.headHeight, meet: tArr => { S.headerCross = { p: star, spot, tArr }; star.busy = true; star.target.copy(spot).setY(0); star.want = want; } });
  yield* shot({ eventId, type: 'shot', header: true, fromId: star.id, fromSide: star.side, outcome: 'goal', fromPos: pitchPercent(spot), toPos: gs > 0 ? [100, 47] : [0, 53] }, events.length + 10);
  if (header) yield* wait(1.5);
}

// the pass in the middle of a step-over; if it could not be set up, the scene ends there
function* flairPass(beat, scene) {
  const { rt, carry, chase, flairPassTry, setTry, clearTry } = beat, { star, fx, at } = scene;
  const mate = scene.mateOf();
  const spot = V(at.x + fx * 14, 0, at.z - 7);
  rt.place(mate, spot.clone().addScaledVector(V(fx, 0, 0), 2));
  yield* carry(star, V(at.x + fx * 5, 0, at.z), 3.5);
  setTry('flairpass');
  if (!(yield* flairPassTry({ from: star, to: mate, toW: spot, travel: 'ground', implicit: false }, { ev: noEvent() }))) { clearTry(); return; }
  star.busy = false; mate.busy = true; yield* chase(mate, spot); mate.busy = false;
}

function* noLookPass(beat, scene) {
  const { rt, carry, pass } = beat, { star, fx, at } = scene;
  const mate = scene.mateOf();
  rt.place(mate, V(at.x + fx * 16, 0, at.z - 8));
  yield* carry(star, V(at.x + fx * 6, 0, at.z), 4.2);
  yield* pass({ from: star, to: mate, toW: V(at.x + fx * 20, 0, at.z - 6), travel: 'ground', implicit: false }, { ev: noEvent() });
}

// he runs at the defender, who comes out to meet him; then the move (again if he could not set it up). The
// seed is the defender's last event: it decides what a match decides with it (which way he goes round)
function* duel(beat, scene, kind) {
  const { rt, hooks, until, wait } = beat, { star, def, fx, at, seed } = scene;
  def.lastEvent = { eventId: seed }; def.busy = star.busy = true;
  hooks.cam('close', star, def);
  yield* until(() => {
    rt.dribble(star, V(at.x + fx * 12, 0, at.z), 3);
    def.target.copy(star.pos).addScaledVector(forwardOf(star), 1.9); def.want = 4; def.face = star.pos; def.faceLock = true; def.loopsWant.jockey = 1;
    return def.pos.distanceTo(star.pos) < 2.6;
  }, 4);
  for (let k = 0; k < 4; k++) {
    if ((yield* SKILL_BEATS[kind](beat, { car: star, def, closeUp: true })) !== false) break;
    def.target.copy(star.pos).addScaledVector(forwardOf(star), 2); def.want = 3;
    yield* wait(0.2);
  }
  def.busy = star.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
  hooks.cam('tv');
}

const STAGINGS = {
  backheel: (beat, scene) => backheelOrRabona(beat, scene, 'backheel'),
  rabona: (beat, scene) => backheelOrRabona(beat, scene, 'rabona'),
  pirouette, trap,
  panenka: (beat, scene) => panenkaOrChip(beat, scene, 'panenka'),
  chip: (beat, scene) => panenkaOrChip(beat, scene, 'chip'),
  crosshead: (beat, scene) => crossMet(beat, scene, { kind: 'crosshead', eventId: -41 }),
  bicycle: (beat, scene) => crossMet(beat, scene, { kind: 'bicycle', eventId: -1 }),
  flairpass: flairPass, nolook: noLookPass,
  ...KEEPER_STAGINGS,
};

// the scene for a move: its own scenario, or the duel with the defender for a skill move
export function stagingFor(kind) {
  return STAGINGS[kind] || ((beat, scene) => duel(beat, scene, kind));
}
