// Keyframed football actions layered over the recorded locomotion.
// All skeleton bones share the world axes in the bind pose, so angles read directly:
//   UpLeg x: − thigh forward / + back · z: Left + out, Right − out · y: Left + toes out, Right − toes out
//   Leg x: + knee bend · Foot x: + toes down
//   Spine x: + lean forward · y: + turn to own left · z: + bend to own right
//   Arm z: Left −80 / Right +80 hangs the arm, Left +80 / Right −80 raises it · x: − swings forward
//   ForeArm y: Left −, Right + bends the elbow · Head x: + look down
import * as THREE from '../vendor/three/three.module.min.js';

const D2R = Math.PI / 180;
const BASE = {
  Hips: [0, 0, 0], Spine: [0, 0, 0], Spine1: [0, 0, 0], Spine2: [0, 0, 0], Neck: [0, 0, 0], Head: [0, 0, 0],
  LeftArm: [0, 0, -76], RightArm: [0, 0, 76], LeftForeArm: [0, -22, 0], RightForeArm: [0, 22, 0],
  LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], LeftFoot: [0, 0, 0], RightFoot: [0, 0, 0],
};

// t: normalised time · p: bone angles (degrees) · missing bones fall back to BASE
export const ACTIONS = {
  pass: {
    dur: 0.62, contact: 0.36, mask: 'all',
    keys: [
      { t: 0, p: { RightUpLeg: [22, -40, 0], RightLeg: [60, 0, 0], LeftUpLeg: [-12, 0, 0], LeftLeg: [24, 0, 0], Spine: [8, 12, 0], LeftArm: [-12, 0, -48], RightArm: [18, 0, 62], LeftForeArm: [0, -32, 0], RightForeArm: [0, 30, 0], Head: [18, 0, 0] } },
      { t: 0.36, p: { RightUpLeg: [-30, -48, 4], RightLeg: [14, 0, 0], RightFoot: [-8, 0, 0], LeftUpLeg: [-14, 0, 0], LeftLeg: [24, 0, 0], Spine: [12, -6, 0], LeftArm: [-20, 0, -45], RightArm: [12, 0, 58], LeftForeArm: [0, -30, 0], RightForeArm: [0, 30, 0], Head: [22, 0, 0] } },
      { t: 0.62, p: { RightUpLeg: [-46, -38, 2], RightLeg: [26, 0, 0], LeftUpLeg: [-10, 0, 0], LeftLeg: [20, 0, 0], Spine: [10, -10, 0], LeftArm: [-10, 0, -55], RightArm: [5, 0, 62], Head: [12, 0, 0] } },
      { t: 1, p: { RightUpLeg: [-15, 0, 0], RightLeg: [30, 0, 0], Spine: [6, 0, 0] } },
    ],
  },
  shot: {
    dur: 0.9, contact: 0.42, mask: 'all',
    keys: [
      { t: 0, p: { RightUpLeg: [8, 0, 0], RightLeg: [35, 0, 0], LeftUpLeg: [-15, 0, 0], LeftLeg: [20, 0, 0], Spine: [10, 0, 0] } },
      { t: 0.27, p: { RightUpLeg: [42, -8, 0], RightLeg: [108, 0, 0], RightFoot: [35, 0, 0], LeftUpLeg: [-22, 0, 8], LeftLeg: [32, 0, 0], LeftFoot: [-10, 0, 0], Spine: [2, 22, -8], LeftArm: [-40, 0, -22], RightArm: [30, 0, 48], LeftForeArm: [0, -20, 0], RightForeArm: [0, 25, 0], Head: [22, 0, 0] } },
      { t: 0.42, p: { RightUpLeg: [-42, -4, 0], RightLeg: [12, 0, 0], RightFoot: [48, 0, 0], LeftUpLeg: [-28, 0, 6], LeftLeg: [34, 0, 0], Spine: [16, -8, 0], LeftArm: [-30, 0, -28], RightArm: [-8, 0, 46], LeftForeArm: [0, -25, 0], RightForeArm: [0, 25, 0], Head: [26, 0, 0] } },
      { t: 0.62, p: { RightUpLeg: [-88, 0, -4], RightLeg: [22, 0, 0], RightFoot: [40, 0, 0], LeftUpLeg: [-18, 0, 4], LeftLeg: [22, 0, 0], Spine: [20, -22, 0], LeftArm: [-10, 0, -40], RightArm: [-30, 0, 50], Head: [10, 0, 0] } },
      { t: 1, p: { RightUpLeg: [-22, 0, 0], RightLeg: [40, 0, 0], LeftLeg: [18, 0, 0], Spine: [8, 0, 0] } },
    ],
  },
  // drop the shoulder, sweep the right leg across the ball, plant and lean: sells the move to the outside
  feint: {
    dur: 0.78, mask: 'all',
    keys: [
      { t: 0, p: { RightUpLeg: [-20, 0, 0], RightLeg: [40, 0, 0], LeftLeg: [25, 0, 0], Spine: [10, 0, 0] } },
      { t: 0.28, p: { RightUpLeg: [-62, 14, -18], RightLeg: [92, 0, 0], RightFoot: [20, 0, 0], LeftUpLeg: [-14, 0, 4], LeftLeg: [42, 0, 0], Spine: [14, 24, -14], LeftArm: [0, 0, -34], RightArm: [-30, 0, 36], Head: [20, 0, 0] } },
      { t: 0.5, p: { RightUpLeg: [-42, 0, 46], RightLeg: [50, 0, 0], RightFoot: [10, 0, 0], LeftUpLeg: [-4, 0, 6], LeftLeg: [46, 0, 0], Spine: [16, 36, -22], LeftArm: [14, 0, -26], RightArm: [-34, 0, 30], Head: [16, -14, 0] } },
      { t: 0.72, p: { RightUpLeg: [-8, 0, 30], RightLeg: [30, 0, 0], LeftUpLeg: [16, 0, 4], LeftLeg: [56, 0, 0], Spine: [18, 26, -24], LeftArm: [14, 0, -24], RightArm: [-22, 0, 38], Head: [14, -14, 0] } },
      { t: 1, p: { RightUpLeg: [-10, 0, 0], RightLeg: [30, 0, 0], Spine: [10, 0, 6] } },
    ],
  },
  // explosive change of direction after the feint
  cut: {
    dur: 0.45, mask: 'upper',
    keys: [
      { t: 0, p: { Spine: [16, -10, 18], LeftArm: [-30, 0, -42], RightArm: [10, 0, 55] } },
      { t: 1, p: { Spine: [10, 0, 4] } },
    ],
  },
  // defender's stance while showing the attacker outside
  jockey: {
    loop: true, mask: 'jockey',
    keys: [{ t: 0, p: { LeftUpLeg: [-28, 0, 6], RightUpLeg: [-28, 0, -6], LeftLeg: [48, 0, 0], RightLeg: [48, 0, 0], LeftFoot: [-14, 0, 0], RightFoot: [-14, 0, 0], Spine: [24, 0, 0], Head: [-14, 0, 0], LeftArm: [-12, 0, -52], RightArm: [-12, 0, 52], LeftForeArm: [0, -38, 0], RightForeArm: [0, 38, 0] } }],
  },
  // defender buys the feint and lunges to his right with the right leg
  lunge: {
    dur: 0.95, mask: 'all',
    keys: [
      { t: 0, p: { LeftUpLeg: [-28, 0, 6], RightUpLeg: [-28, 0, -6], LeftLeg: [48, 0, 0], RightLeg: [48, 0, 0], Spine: [24, 0, 0] } },
      { t: 0.35, p: { RightUpLeg: [-48, -20, -38], RightLeg: [8, 0, 0], RightFoot: [-20, 0, 0], LeftUpLeg: [-22, 0, 14], LeftLeg: [70, 0, 0], LeftFoot: [-18, 0, 0], Spine: [30, -10, 22], LeftArm: [10, 0, -30], RightArm: [-40, 0, 32], Head: [-10, 0, 0] } },
      { t: 0.65, p: { RightUpLeg: [-40, -20, -34], RightLeg: [14, 0, 0], LeftUpLeg: [-20, 0, 12], LeftLeg: [66, 0, 0], Spine: [32, -14, 26], LeftArm: [10, 0, -30], RightArm: [-30, 0, 36] } },
      { t: 1, p: { RightUpLeg: [-15, 0, 0], RightLeg: [30, 0, 0], LeftLeg: [30, 0, 0], Spine: [14, 0, 6] } },
    ],
  },
  // the keeper's set position is alive: he bounces on his toes and shifts his weight from foot to
  // foot, hands up and loose (one cycle ≈ 1.4 s, played by the runtime with a per-keeper phase)
  keeperReady: {
    loop: true, mask: 'all', period: 1.4,
    keys: [
      { t: 0, p: { LeftUpLeg: [-34, 0, 13], RightUpLeg: [-34, 0, -13], LeftLeg: [58, 0, 0], RightLeg: [58, 0, 0], LeftFoot: [-18, 0, 0], RightFoot: [-18, 0, 0], Spine: [28, 0, 0], Head: [-22, 0, 0], LeftArm: [-48, 0, -40], RightArm: [-48, 0, 40], LeftForeArm: [0, -48, 0], RightForeArm: [0, 48, 0] } },
      { t: 0.25, p: { LeftUpLeg: [-40, 0, 16], RightUpLeg: [-28, 0, -9], LeftLeg: [68, 0, 0], RightLeg: [48, 0, 0], LeftFoot: [-22, 0, 0], RightFoot: [-12, 0, 0], Spine: [30, 0, 4], Head: [-24, 0, -3], LeftArm: [-56, 0, -34], RightArm: [-42, 0, 46], LeftForeArm: [0, -54, 0], RightForeArm: [0, 42, 0] } },
      { t: 0.5, p: { LeftUpLeg: [-40, 0, 13], RightUpLeg: [-40, 0, -13], LeftLeg: [68, 0, 0], RightLeg: [68, 0, 0], LeftFoot: [-22, 0, 0], RightFoot: [-22, 0, 0], Spine: [31, 0, 0], Head: [-24, 0, 0], LeftArm: [-52, 0, -38], RightArm: [-52, 0, 38], LeftForeArm: [0, -52, 0], RightForeArm: [0, 52, 0] } },
      { t: 0.75, p: { LeftUpLeg: [-28, 0, 9], RightUpLeg: [-40, 0, -16], LeftLeg: [48, 0, 0], RightLeg: [68, 0, 0], LeftFoot: [-12, 0, 0], RightFoot: [-22, 0, 0], Spine: [30, 0, -4], Head: [-24, 0, 3], LeftArm: [-42, 0, -46], RightArm: [-56, 0, 34], LeftForeArm: [0, -42, 0], RightForeArm: [0, 54, 0] } },
      { t: 1, p: { LeftUpLeg: [-34, 0, 13], RightUpLeg: [-34, 0, -13], LeftLeg: [58, 0, 0], RightLeg: [58, 0, 0], LeftFoot: [-18, 0, 0], RightFoot: [-18, 0, 0], Spine: [28, 0, 0], Head: [-22, 0, 0], LeftArm: [-48, 0, -40], RightArm: [-48, 0, 40], LeftForeArm: [0, -48, 0], RightForeArm: [0, 48, 0] } },
    ],
  },
  // dive to the keeper's right; the root roll and launch are driven separately
  diveRight: {
    dur: 1.0, contact: 0.3, mask: 'all',
    keys: [
      { t: 0, p: { LeftUpLeg: [-34, 0, 13], RightUpLeg: [-34, 0, -13], LeftLeg: [58, 0, 0], RightLeg: [58, 0, 0], Spine: [28, 0, 0], LeftArm: [-48, 0, -40], RightArm: [-48, 0, 40], LeftForeArm: [0, -48, 0], RightForeArm: [0, 48, 0] } },
      { t: 0.3, p: { LeftUpLeg: [-6, 0, 18], LeftLeg: [10, 0, 0], RightUpLeg: [-30, 0, -6], RightLeg: [45, 0, 0], Spine: [4, 0, 14], Head: [0, 0, 10], LeftArm: [-8, 0, 112], RightArm: [-10, 0, -62], LeftForeArm: [0, -6, 0], RightForeArm: [0, 6, 0] } },
      { t: 0.6, p: { LeftUpLeg: [-10, 0, 14], LeftLeg: [24, 0, 0], RightUpLeg: [-34, 0, -4], RightLeg: [60, 0, 0], Spine: [10, 0, 12], LeftArm: [-16, 0, 100], RightArm: [-20, 0, -60], LeftForeArm: [0, -30, 0], RightForeArm: [0, 30, 0] } },
      { t: 1, p: { LeftUpLeg: [-20, 0, 10], LeftLeg: [50, 0, 0], RightUpLeg: [-40, 0, -4], RightLeg: [70, 0, 0], Spine: [16, 0, 8], LeftArm: [-30, 0, 20], RightArm: [-30, 0, -20], LeftForeArm: [0, -60, 0], RightForeArm: [0, 60, 0] } },
    ],
  },
  celebrate: {
    dur: 1.6, mask: 'upper',
    keys: [
      { t: 0, p: {} },
      { t: 0.3, p: { LeftArm: [-20, 0, 60], RightArm: [-20, 0, -60], LeftForeArm: [0, -20, 0], RightForeArm: [0, 20, 0], Head: [-20, 0, 0], Spine: [-8, 0, 0] } },
      { t: 0.8, p: { LeftArm: [-20, 0, 66], RightArm: [-20, 0, -66], Head: [-24, 0, 0], Spine: [-10, 0, 0] } },
      { t: 1, p: {} },
    ],
  },
};

// drag-back: the sole rolls the ball back under the body, then he turns away with it
ACTIONS.dragBack = {
  dur: 0.7, mask: 'all',
  keys: [
    { t: 0, p: { RightUpLeg: [-10, 0, 0], RightLeg: [30, 0, 0], Spine: [10, 0, 0] } },
    { t: 0.3, p: { RightUpLeg: [-38, 0, -4], RightLeg: [20, 0, 0], RightFoot: [-28, 0, 0], LeftLeg: [34, 0, 0], Spine: [6, 0, 0], LeftArm: [-10, 0, -50], RightArm: [-20, 0, 52], Head: [20, 0, 0] } },
    { t: 0.55, p: { RightUpLeg: [-6, 0, -2], RightLeg: [52, 0, 0], RightFoot: [-10, 0, 0], LeftLeg: [40, 0, 0], Spine: [14, 30, 6], LeftArm: [10, 0, -36], RightArm: [-30, 0, 40], Head: [10, -20, 0] } },
    { t: 1, p: { RightUpLeg: [-14, 0, 0], RightLeg: [32, 0, 0], Spine: [10, 0, 0] } },
  ],
};
// shoulder-to-shoulder: he leans his weight into the man and gets his body between man and ball
ACTIONS.shoulder = {
  dur: 0.6, mask: 'upper',
  keys: [
    { t: 0, p: {} },
    { t: 0.4, p: { Spine: [18, -12, 22], LeftArm: [-6, 0, -66], RightArm: [-24, 0, 40], RightForeArm: [0, 46, 0], Head: [8, 10, 0] } },
    { t: 1, p: {} },
  ],
};
// throw-in: ball taken behind the head with both hands, released over it
ACTIONS.throwIn = {
  dur: 1.0, contact: 0.55, mask: 'upper',
  keys: [
    { t: 0, p: { LeftArm: [-55, 0, -70], RightArm: [-55, 0, 70], LeftForeArm: [0, -95, 0], RightForeArm: [0, 95, 0] } },
    { t: 0.35, p: { LeftArm: [20, 0, 132], RightArm: [20, 0, -132], LeftForeArm: [0, -95, 0], RightForeArm: [0, 95, 0], Spine: [-14, 0, 0], Head: [-10, 0, 0] } },
    { t: 0.55, p: { LeftArm: [-35, 0, 118], RightArm: [-35, 0, -118], LeftForeArm: [0, -10, 0], RightForeArm: [0, 10, 0], Spine: [14, 0, 0] } },
    { t: 1, p: {} },
  ],
};
// waiting at the touchline with the ball held at the chest
ACTIONS.throwHold = { loop: true, mask: 'upper', keys: [{ t: 0, p: { LeftArm: [-55, 0, -70], RightArm: [-55, 0, 70], LeftForeArm: [0, -95, 0], RightForeArm: [0, 95, 0] } }] };
// ---- V7.9 skill moves (the legs are placed by foot targets, see runtime footIK) ----
// step-over: the right foot circles round the front of the ball from inside to outside without
// touching it, the hips and shoulders dip right to sell the move
ACTIONS.stepover = {
  dur: 0.62, mask: 'all',
  keys: [
    { t: 0, p: { RightUpLeg: [-12, 0, 0], RightLeg: [34, 0, 0], LeftLeg: [30, 0, 0], Spine: [12, 0, 0] } },
    { t: 0.3, p: { RightUpLeg: [-48, -10, 22], RightLeg: [70, 0, 0], RightFoot: [10, 0, 0], LeftUpLeg: [-8, 0, 4], LeftLeg: [44, 0, 0], LeftFoot: [-8, 0, 0], Spine: [16, -12, 8], LeftArm: [-10, 0, -40], RightArm: [-20, 0, 50], Head: [24, 0, 0] } },
    { t: 0.55, p: { RightUpLeg: [-40, 10, -34], RightLeg: [52, 0, 0], RightFoot: [6, 0, 0], LeftUpLeg: [-4, 0, 8], LeftLeg: [50, 0, 0], LeftFoot: [-10, 0, 0], Spine: [18, -26, 22], LeftArm: [24, 0, -20], RightArm: [-26, 0, 60], LeftForeArm: [0, -40, 0], Head: [18, 10, 0] } },
    { t: 0.8, p: { RightUpLeg: [-10, 0, -26], RightLeg: [40, 0, 0], LeftUpLeg: [6, 0, 6], LeftLeg: [54, 0, 0], Spine: [18, -20, 20], LeftArm: [20, 0, -26], RightArm: [-20, 0, 56], Head: [16, 8, 0] } },
    { t: 1, p: { RightUpLeg: [-14, 0, -6], RightLeg: [34, 0, 0], LeftLeg: [36, 0, 0], Spine: [14, -6, 6] } },
  ],
};
// the nutmeg: a short stab with the outside of the right foot, body low and over the ball
ACTIONS.poke = {
  dur: 0.42, contact: 0.45, mask: 'all',
  keys: [
    { t: 0, p: { RightUpLeg: [-6, 0, 0], RightLeg: [40, 0, 0], LeftLeg: [36, 0, 0], Spine: [16, 0, 0] } },
    { t: 0.3, p: { RightUpLeg: [6, 20, 4], RightLeg: [62, 0, 0], RightFoot: [22, 0, 0], LeftUpLeg: [-14, 0, 0], LeftLeg: [46, 0, 0], Spine: [24, 10, 0], LeftArm: [-18, 0, -42], RightArm: [10, 0, 62], Head: [30, 0, 0] } },
    { t: 0.45, p: { RightUpLeg: [-34, 22, -10], RightLeg: [24, 0, 0], RightFoot: [18, 0, 0], LeftUpLeg: [-16, 0, 0], LeftLeg: [48, 0, 0], Spine: [24, -4, 0], LeftArm: [-24, 0, -40], RightArm: [14, 0, 60], Head: [28, 0, 0] } },
    { t: 1, p: { RightUpLeg: [-20, 0, 0], RightLeg: [36, 0, 0], Spine: [16, 0, 0] } },
  ],
};
// defender squared up, legs spread wide (the gap the ball goes through)
ACTIONS.spread = {
  dur: 1.1, mask: 'all',
  keys: [
    { t: 0, p: { LeftUpLeg: [-26, 0, 8], RightUpLeg: [-26, 0, -8], LeftLeg: [46, 0, 0], RightLeg: [46, 0, 0], Spine: [24, 0, 0] } },
    { t: 0.25, p: { LeftUpLeg: [-20, 0, 26], RightUpLeg: [-20, 0, -26], LeftLeg: [40, 0, 0], RightLeg: [40, 0, 0], LeftFoot: [-10, 0, 0], RightFoot: [-10, 0, 0], Spine: [30, 0, 0], Head: [-6, 0, 0], LeftArm: [-10, 0, -40], RightArm: [-10, 0, 40], LeftForeArm: [0, -40, 0], RightForeArm: [0, 40, 0] } },
    { t: 0.6, p: { LeftUpLeg: [-14, 0, 24], RightUpLeg: [-14, 0, -24], LeftLeg: [30, 0, 0], RightLeg: [30, 0, 0], Spine: [44, 0, 0], Head: [30, 0, 0], LeftArm: [-30, 0, -30], RightArm: [-30, 0, 30] } },
    { t: 1, p: { LeftUpLeg: [-10, 0, 8], RightUpLeg: [-10, 0, -8], LeftLeg: [24, 0, 0], RightLeg: [24, 0, 0], Spine: [16, 30, 0], Head: [0, 30, 0] } },
  ],
};
// beaten: he commits, loses his footing, a hand goes down to the grass and he twists round
ACTIONS.stumble = {
  dur: 1.3, mask: 'all',
  keys: [
    { t: 0, p: { RightUpLeg: [-40, -20, -34], RightLeg: [14, 0, 0], LeftUpLeg: [-20, 0, 12], LeftLeg: [66, 0, 0], Spine: [32, -14, 26] } },
    { t: 0.35, p: { RightUpLeg: [-56, -10, -40], RightLeg: [30, 0, 0], LeftUpLeg: [-6, 0, 20], LeftLeg: [96, 0, 0], LeftFoot: [-20, 0, 0], Spine: [52, -20, 34], LeftArm: [40, 0, -10], RightArm: [-60, 0, 20], LeftForeArm: [0, -10, 0], Head: [-10, -20, 0] } },
    { t: 0.7, p: { RightUpLeg: [-44, -10, -30], RightLeg: [60, 0, 0], LeftUpLeg: [-20, 0, 14], LeftLeg: [100, 0, 0], Spine: [46, 30, 20], LeftArm: [30, 0, -20], RightArm: [-50, 0, 30], Head: [-20, 40, 0] } },
    { t: 1, p: { RightUpLeg: [-20, 0, -6], RightLeg: [40, 0, 0], LeftLeg: [40, 0, 0], Spine: [20, 20, 6], Head: [0, 30, 0] } },
  ],
};
// chest control: leans back under the dropping ball, chest out, arms wide, knees soft
ACTIONS.chest = {
  dur: 0.9, contact: 0.4, mask: 'all',
  keys: [
    { t: 0, p: { LeftLeg: [20, 0, 0], RightLeg: [20, 0, 0], Spine: [4, 0, 0], Head: [-16, 0, 0] } },
    { t: 0.4, p: { LeftUpLeg: [-16, 0, 6], RightUpLeg: [-6, 0, -6], LeftLeg: [36, 0, 0], RightLeg: [30, 0, 0], Spine: [-20, 0, 0], Spine1: [-8, 0, 0], Spine2: [-8, 0, 0], Head: [18, 0, 0], LeftArm: [-20, 0, -30], RightArm: [-20, 0, 30], LeftForeArm: [0, -30, 0], RightForeArm: [0, 30, 0] } },
    { t: 0.62, p: { LeftUpLeg: [-12, 0, 6], RightUpLeg: [-4, 0, -6], LeftLeg: [30, 0, 0], RightLeg: [28, 0, 0], Spine: [-6, 0, 0], Head: [28, 0, 0], LeftArm: [-10, 0, -44], RightArm: [-10, 0, 44] } },
    { t: 1, p: { LeftLeg: [24, 0, 0], RightLeg: [24, 0, 0], Spine: [10, 0, 0], Head: [16, 0, 0] } },
  ],
};
// elastico: the outside of the right foot pushes the ball out, the same foot snaps it back in
ACTIONS.elastico = {
  dur: 0.72, mask: 'all',
  keys: [
    { t: 0, p: { RightUpLeg: [-12, 0, 0], RightLeg: [32, 0, 0], LeftLeg: [34, 0, 0], Spine: [12, 0, 0] } },
    { t: 0.3, p: { RightUpLeg: [-30, -34, -24], RightLeg: [28, 0, 0], RightFoot: [10, 0, 0], LeftUpLeg: [-6, 0, 4], LeftLeg: [44, 0, 0], Spine: [14, 18, -14], LeftArm: [10, 0, -40], RightArm: [-24, 0, 46], Head: [24, 0, 0] } },
    { t: 0.55, p: { RightUpLeg: [-34, 30, 24], RightLeg: [24, 0, 0], RightFoot: [12, 0, 0], LeftUpLeg: [-4, 0, 6], LeftLeg: [48, 0, 0], Spine: [16, -26, 18], LeftArm: [-20, 0, -56], RightArm: [20, 0, 36], Head: [22, -10, 0] } },
    { t: 1, p: { RightUpLeg: [-16, 0, 6], RightLeg: [34, 0, 0], LeftLeg: [36, 0, 0], Spine: [14, -10, 8] } },
  ],
};
// no-look pass: plays it across with the inside of the right foot while looking the other way
ACTIONS.nolook = {
  dur: 0.66, contact: 0.38, mask: 'all',
  keys: [
    { t: 0, p: { RightUpLeg: [22, -40, 0], RightLeg: [60, 0, 0], LeftUpLeg: [-12, 0, 0], LeftLeg: [24, 0, 0], Spine: [8, -10, 0], Head: [8, -50, 0], LeftArm: [-12, 0, -48], RightArm: [18, 0, 62] } },
    { t: 0.38, p: { RightUpLeg: [-30, -50, 4], RightLeg: [14, 0, 0], RightFoot: [-8, 0, 0], LeftUpLeg: [-14, 0, 0], LeftLeg: [24, 0, 0], Spine: [10, -16, 0], Head: [6, -58, 0], LeftArm: [-20, 0, -45], RightArm: [12, 0, 58] } },
    { t: 0.66, p: { RightUpLeg: [-40, -38, 2], RightLeg: [26, 0, 0], LeftUpLeg: [-10, 0, 0], LeftLeg: [20, 0, 0], Spine: [10, -12, 0], Head: [4, -40, 0] } },
    { t: 1, p: { RightUpLeg: [-15, 0, 0], RightLeg: [30, 0, 0], Spine: [6, 0, 0], Head: [0, -10, 0] } },
  ],
};
// arms out to the team-mate who scored: "that's yours"
ACTIONS.point = {
  dur: 1.8, mask: 'upper',
  keys: [
    { t: 0, p: {} },
    { t: 0.25, p: { LeftArm: [-70, 0, -10], RightArm: [-70, 0, 10], LeftForeArm: [0, -10, 0], RightForeArm: [0, 10, 0], Head: [-6, 0, 0], Spine: [-4, 0, 0] } },
    { t: 0.8, p: { LeftArm: [-74, 0, -14], RightArm: [-74, 0, 14], Head: [-8, 0, 0], Spine: [-6, 0, 0] } },
    { t: 1, p: {} },
  ],
};
// bicycle kick: arms out for balance, the standing leg tucks, the body arches back (the kicking leg is
// placed by a foot target, the tip over by the runtime)
ACTIONS.bicycle = {
  dur: 1.3, mask: 'all',
  keys: [
    { t: 0, p: { LeftLeg: [30, 0, 0], RightLeg: [30, 0, 0], Spine: [6, 0, 0] } },
    { t: 0.3, p: { LeftUpLeg: [-70, 0, 6], LeftLeg: [90, 0, 0], Spine: [-14, 0, 0], Spine1: [-8, 0, 0], Head: [30, 0, 0], LeftArm: [-10, 0, -20], RightArm: [-10, 0, 20], LeftForeArm: [0, -20, 0], RightForeArm: [0, 20, 0] } },
    { t: 0.55, p: { LeftUpLeg: [-40, 0, 6], LeftLeg: [60, 0, 0], Spine: [-10, 0, 0], Head: [34, 0, 0], LeftArm: [10, 0, -10], RightArm: [10, 0, 10] } },
    { t: 1, p: { LeftLeg: [20, 0, 0], RightLeg: [20, 0, 0], Spine: [0, 0, 0], LeftArm: [0, 0, -60], RightArm: [0, 0, 60] } },
  ],
};
// mirror an action left <-> right (angles about y and z flip sign)
function mirror(src) {
  const swap = n => n.startsWith('Left') ? 'Right' + n.slice(4) : n.startsWith('Right') ? 'Left' + n.slice(5) : n;
  return { ...src, keys: src.keys.map(k => ({ t: k.t, p: Object.fromEntries(Object.entries(k.p).map(([b, a]) => [swap(b), [a[0], -a[1], -a[2]]])) })) };
}
ACTIONS.diveLeft = mirror(ACTIONS.diveRight);
ACTIONS.passLeft = mirror(ACTIONS.pass);
ACTIONS.lungeL = mirror(ACTIONS.lunge);

// the keeper's hands in his set position (the legs come from the recorded crouch): up in front, palms out
ACTIONS.keeperHands = { loop: true, mask: 'arms', keys: [{ t: 0, p: { LeftArm: [-62, 0, -60], RightArm: [-62, 0, 60], LeftForeArm: [0, -62, 0], RightForeArm: [0, 62, 0], Head: [-14, 0, 0] } }] };

// V7.9 the scorpion (the legs are placed by foot targets, the arms by hand targets): the push off, the back
// arched with the head up in flight while the knees fold the heels up over him, then the landing
ACTIONS.scorpion = {
  dur: 2.4, contact: 0.231, mask: 'all',
  keys: [
    { t: 0, p: { LeftUpLeg: [-30, 0, 8], RightUpLeg: [-30, 0, -8], LeftLeg: [50, 0, 0], RightLeg: [50, 0, 0], Spine: [20, 0, 0] } },
    { t: 0.075, p: { LeftUpLeg: [-10, 0, 6], RightUpLeg: [10, 0, -6], LeftLeg: [20, 0, 0], RightLeg: [60, 0, 0], Head: [-20, 0, 0] } },
    { t: 0.19, p: { LeftUpLeg: [18, 0, 8], RightUpLeg: [18, 0, -8], LeftLeg: [110, 0, 0], RightLeg: [110, 0, 0], LeftFoot: [-25, 0, 0], RightFoot: [-25, 0, 0], Spine: [-22, 0, 0], Spine1: [-16, 0, 0], Spine2: [-12, 0, 0], Neck: [-15, 0, 0], Head: [-35, 0, 0] } },
    { t: 0.26, p: { LeftUpLeg: [22, 0, 10], RightUpLeg: [22, 0, -10], LeftLeg: [118, 0, 0], RightLeg: [118, 0, 0], LeftFoot: [-25, 0, 0], RightFoot: [-25, 0, 0], Spine: [-22, 0, 0], Spine1: [-15, 0, 0], Spine2: [-10, 0, 0], Neck: [-15, 0, 0], Head: [-35, 0, 0] } },
    { t: 0.31, p: { LeftUpLeg: [6, 0, 8], RightUpLeg: [6, 0, -8], LeftLeg: [30, 0, 0], RightLeg: [30, 0, 0], Spine: [-15, 0, 0], Spine1: [-8, 0, 0], Head: [-30, 0, 0] } },
    { t: 0.375, p: { LeftUpLeg: [2, 0, 8], RightUpLeg: [2, 0, -8], LeftLeg: [12, 0, 0], RightLeg: [12, 0, 0], Spine: [-12, 0, 0], Head: [-30, 0, 0] } },
    { t: 0.625, p: { LeftUpLeg: [4, 0, 8], RightUpLeg: [4, 0, -8], LeftLeg: [12, 0, 0], RightLeg: [12, 0, 0], Spine: [-8, 0, 0], Head: [-25, 0, 0] } },
    { t: 0.79, p: { LeftUpLeg: [-70, 0, 10], RightUpLeg: [-70, 0, -10], LeftLeg: [110, 0, 0], RightLeg: [110, 0, 0], Spine: [25, 0, 0], Head: [-15, 0, 0] } },
    { t: 1, p: { LeftUpLeg: [-10, 0, 4], RightUpLeg: [-10, 0, -4], LeftLeg: [15, 0, 0], RightLeg: [15, 0, 0], Spine: [5, 0, 0] } },
  ],
};

// V7.9.3 the keeper's volley out of his hands: the ball held out in front (the gloves are placed by hand
// targets), a step onto the left foot as he lets it drop, the right leg swings through and meets it in
// the air (the boot is placed on the ball by a foot target), a high follow-through leaning back
ACTIONS.gkVolley = {
  dur: 1.1, contact: 0.46, mask: 'all',
  keys: [
    { t: 0, p: { LeftArm: [-55, 0, -50], RightArm: [-55, 0, 50], LeftForeArm: [0, -55, 0], RightForeArm: [0, 55, 0], Spine: [10, 0, 0], Head: [18, 0, 0], LeftLeg: [12, 0, 0], RightLeg: [12, 0, 0] } },
    { t: 0.22, p: { LeftUpLeg: [-26, 0, 2], LeftLeg: [22, 0, 0], RightUpLeg: [22, 0, -2], RightLeg: [62, 0, 0], RightFoot: [20, 0, 0], LeftArm: [-50, 0, -50], RightArm: [-50, 0, 50], LeftForeArm: [0, -45, 0], RightForeArm: [0, 45, 0], Spine: [12, 0, 0], Head: [22, 0, 0] } },
    { t: 0.46, p: { LeftUpLeg: [4, 0, 6], LeftLeg: [14, 0, 0], LeftFoot: [-8, 0, 0], RightUpLeg: [-72, 0, -2], RightLeg: [18, 0, 0], RightFoot: [48, 0, 0], Spine: [-8, 0, 0], LeftArm: [-25, 0, -32], RightArm: [5, 0, 45], LeftForeArm: [0, -20, 0], RightForeArm: [0, 20, 0], Head: [22, 0, 0] } },
    { t: 0.66, p: { LeftUpLeg: [10, 0, 6], LeftLeg: [12, 0, 0], RightUpLeg: [-104, 0, -2], RightLeg: [12, 0, 0], RightFoot: [40, 0, 0], Spine: [-14, 0, 0], LeftArm: [-12, 0, -30], RightArm: [0, 0, 40], Head: [8, 0, 0] } },
    { t: 1, p: { RightUpLeg: [-12, 0, 0], RightLeg: [22, 0, 0], LeftLeg: [12, 0, 0], Spine: [4, 0, 0] } },
  ],
};

const MASKS = {
  all: null,
  arms: ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'Head'],
  upper: ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'],
};
// per-bone strength for the jockey stance: crouch the legs a little, own the upper body
const JOCKEY_LEGS = { LeftUpLeg: .45, RightUpLeg: .45, LeftLeg: .55, RightLeg: .55, LeftFoot: .4, RightFoot: .4 };

const qCache = new Map();
function quatFor(a) {
  const key = a.join(',');
  let q = qCache.get(key);
  if (!q) { q = new THREE.Quaternion().setFromEuler(new THREE.Euler(a[0] * D2R, a[1] * D2R, a[2] * D2R, 'XZY')); qCache.set(key, q); }
  return q;
}
// complete every key with BASE so missing bones interpolate towards a neutral stance
for (const act of Object.values(ACTIONS)) {
  act.full = act.keys.map(k => ({ t: k.t, q: Object.fromEntries(Object.keys(BASE).map(b => [b, quatFor(k.p[b] || BASE[b])])) , has: new Set(Object.keys(k.p)) }));
  act.bones = Object.keys(BASE).filter(b => !MASKS[act.mask] || MASKS[act.mask].includes(b));
  if (act.mask === 'jockey') act.bones = Object.keys(BASE).filter(b => b !== 'Hips' && b !== 'Spine1' && b !== 'Spine2' && b !== 'Neck');
}

export function rigOf(model) {
  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  return bones;
}

const tmpQ = new THREE.Quaternion();
const ease = x => x * x * (3 - 2 * x);
function sample(act, u, bone, out) {
  const F = act.full;
  if (F.length === 1 || u <= 0) return out.copy(F[0].q[bone]);
  for (let i = 0; i < F.length - 1; i++) {
    if (u <= F[i + 1].t) {
      const s = ease((u - F[i].t) / (F[i + 1].t - F[i].t));
      return out.copy(F[i].q[bone]).slerp(F[i + 1].q[bone], s);
    }
  }
  return out.copy(F.at(-1).q[bone]);
}

// Blend an action over the current (locomotion) pose. weight 0..1.
export function applyAction(bones, name, u, weight) {
  const act = ACTIONS[name];
  if (!act || weight <= 0) return;
  for (const b of act.bones) {
    const bone = bones[b]; if (!bone) continue;
    let w = weight;
    if (act.mask === 'jockey' && JOCKEY_LEGS[b] !== undefined) w *= JOCKEY_LEGS[b];
    if (b === 'Hips') continue;               // the root keeps the clip's pelvis motion
    sample(act, u, b, tmpQ);
    bone.quaternion.slerp(tmpQ, w);
  }
}

// Lowest point of the boots in model space; the model is lowered or raised so a crouch keeps the
// feet on the grass instead of floating or sinking.
const gv = new THREE.Vector3();
export function footClearance(bones) {
  let y = Infinity;
  for (const s of ['Left', 'Right']) {
    const toe = bones[s + 'ToeBase'], foot = bones[s + 'Foot'];
    if (toe) { toe.getWorldPosition(gv); y = Math.min(y, gv.y - 0.004); }
    if (foot) { foot.getWorldPosition(gv); y = Math.min(y, gv.y - 0.074); }
  }
  return y;
}

// Envelope for one-shot actions: fade in quickly, hold, fade out.
export function envelope(act, elapsed) {
  if (act.loop) return 1;
  const T = act.dur, inT = Math.min(0.12, T * 0.2), outT = Math.min(0.2, T * 0.3);
  if (elapsed < inT) return elapsed / inT;
  if (elapsed > T - outT) return Math.max(0, (T - elapsed) / outT);
  return 1;
}
