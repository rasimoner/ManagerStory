#!/usr/bin/env node
// Builds dist/assets/models/footballer-rig.json: ManagerStory's own footballer skeleton plus
// locomotion clips retargeted from Quaternius' Universal Animation Library (CC0 1.0).
//
// Source (CC0, free): https://quaternius.com/packs/universalanimationlibrary.html
// Git mirror used here: https://github.com/J-Ponzo/gltf-universal-animation-library
//
//   git clone --depth 1 https://github.com/J-Ponzo/gltf-universal-animation-library /tmp/ual
//   node tools/build-rig.mjs /tmp/ual/glTF/AnimationLibrary_Godot_Standard.gltf
//
// Retargeting: both rigs are T-posed, Y-up and face +Z. For every frame the source bone's
// world rotation relative to its rest is applied to our bone (whose rest world rotation is
// identity), then converted back to a local rotation. The pelvis translation is scaled by the
// hip-height ratio. Clips are in place (no root motion).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../dist/vendor/three/three.module.min.js';
import { GLTFLoader } from '../dist/vendor/three/addons/loaders/GLTFLoader.js';

// Our skeleton: name, parent, rest position (metres, world space). T-pose, facing +Z, left = +X.
export const BONES = [
  ['Hips', null, [0, 1.0, 0]],
  ['Spine', 'Hips', [0, 1.1, 0.002]],
  ['Spine1', 'Spine', [0, 1.21, 0.004]],
  ['Spine2', 'Spine1', [0, 1.325, -0.004]],
  ['Neck', 'Spine2', [0, 1.495, -0.024]],
  ['Head', 'Neck', [0, 1.595, -0.008]],
  ['LeftShoulder', 'Spine2', [0.05, 1.44, -0.026]],
  ['LeftArm', 'LeftShoulder', [0.158, 1.437, -0.046]],
  ['LeftForeArm', 'LeftArm', [0.432, 1.437, -0.046]],
  ['LeftHand', 'LeftForeArm', [0.706, 1.437, -0.046]],
  ['RightShoulder', 'Spine2', [-0.05, 1.44, -0.026]],
  ['RightArm', 'RightShoulder', [-0.158, 1.437, -0.046]],
  ['RightForeArm', 'RightArm', [-0.432, 1.437, -0.046]],
  ['RightHand', 'RightForeArm', [-0.706, 1.437, -0.046]],
  ['LeftUpLeg', 'Hips', [0.085, 0.968, 0.004]],
  ['LeftLeg', 'LeftUpLeg', [0.085, 0.53, 0.008]],
  ['LeftFoot', 'LeftLeg', [0.085, 0.086, -0.02]],
  ['LeftToeBase', 'LeftFoot', [0.085, -0.002, 0.084]],
  ['RightUpLeg', 'Hips', [-0.085, 0.968, 0.004]],
  ['RightLeg', 'RightUpLeg', [-0.085, 0.53, 0.008]],
  ['RightFoot', 'RightLeg', [-0.085, 0.086, -0.02]],
  ['RightToeBase', 'RightFoot', [-0.085, -0.002, 0.084]],
];
const MAP = {
  Hips: 'DEF-hips', Spine: 'DEF-spine.001', Spine1: 'DEF-spine.002', Spine2: 'DEF-spine.003', Neck: 'DEF-neck', Head: 'DEF-head',
  LeftShoulder: 'DEF-shoulder.L', LeftArm: 'DEF-upper_arm.L', LeftForeArm: 'DEF-forearm.L', LeftHand: 'DEF-hand.L',
  RightShoulder: 'DEF-shoulder.R', RightArm: 'DEF-upper_arm.R', RightForeArm: 'DEF-forearm.R', RightHand: 'DEF-hand.R',
  LeftUpLeg: 'DEF-thigh.L', LeftLeg: 'DEF-shin.L', LeftFoot: 'DEF-foot.L', LeftToeBase: 'DEF-toe.L',
  RightUpLeg: 'DEF-thigh.R', RightLeg: 'DEF-shin.R', RightFoot: 'DEF-foot.R', RightToeBase: 'DEF-toe.R',
};
const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop' };
const FPS = 30;

function toGlb(gltfPath) {
  const j = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  const bin = fs.readFileSync(path.join(path.dirname(gltfPath), j.buffers[0].uri));
  j.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const bb = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([head, js, bh, bb]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-rig.mjs <AnimationLibrary_Godot_Standard.gltf>'); process.exit(1); }
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(toGlb(src), '', res, rej));
const S = n => gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
for (const [ours, theirs] of Object.entries(MAP)) if (!S(theirs)) throw new Error('missing source bone ' + theirs + ' for ' + ours);

gltf.scene.updateMatrixWorld(true);
const restQ = {}, q = new THREE.Quaternion();
for (const [ours, theirs] of Object.entries(MAP)) restQ[ours] = S(theirs).getWorldQuaternion(new THREE.Quaternion());
const srcHipRest = S(MAP.Hips).getWorldPosition(new THREE.Vector3());
const ourHip = new THREE.Vector3(...BONES[0][2]);
const scale = ourHip.y / srcHipRest.y;

const mixer = new THREE.AnimationMixer(gltf.scene);
const out = { format: 'managerstory-rig-1', source: 'Quaternius Universal Animation Library (CC0 1.0), retargeted by tools/build-rig.mjs', bones: BONES, fps: FPS, clips: {} };
for (const [key, name] of Object.entries(CLIPS)) {
  const clip = gltf.animations.find(a => a.name === name);
  if (!clip) throw new Error('missing clip ' + name);
  mixer.stopAllAction(); mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * FPS));
  const tracks = Object.fromEntries(BONES.map(([n]) => [n, []])); const hips = [];
  for (let f = 0; f <= frames; f++) {
    const t = Math.min(clip.duration, f / FPS * (clip.duration / (frames / FPS)));
    mixer.setTime(f === frames ? 0 : t); gltf.scene.updateMatrixWorld(true);  // last frame = first: seamless loop
    const world = {};
    for (const [n, parent] of BONES) {
      const w = S(MAP[n]).getWorldQuaternion(new THREE.Quaternion()).multiply(restQ[n].clone().invert());
      world[n] = w;
      const local = parent ? world[parent].clone().invert().multiply(w) : w.clone();
      tracks[n].push(...local.toArray().map(v => +v.toFixed(5)));
    }
    const hp = S(MAP.Hips).getWorldPosition(new THREE.Vector3()).sub(srcHipRest).multiplyScalar(scale);
    hips.push(+hp.x.toFixed(4), +(ourHip.y + hp.y).toFixed(4), +hp.z.toFixed(4));
  }
  out.clips[key] = { duration: +(frames / FPS).toFixed(4), frames: frames + 1, rotations: tracks, hips };
}
const dest = new URL('../dist/assets/models/footballer-rig.json', import.meta.url);
fs.writeFileSync(dest, JSON.stringify(out));
console.log('wrote', dest.pathname, (fs.statSync(dest).size / 1024).toFixed(0) + ' KB', Object.entries(out.clips).map(([k, c]) => `${k} ${c.duration}s`).join(', '));
