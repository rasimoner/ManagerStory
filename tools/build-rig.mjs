#!/usr/bin/env node
// Builds src/assets/models/footballer-rig.json: ManagerStory's own footballer skeleton plus
// motion clips retargeted from Quaternius' Universal Animation Library 1 and 2 (CC0 1.0,
// models and animations by Quaternius, https://quaternius.com).
//
// Sources (CC0): https://quaternius.com/packs/universalanimationlibrary.html and
// https://quaternius.com/packs/universalanimationlibrary2.html. Any build of the libraries works;
// the tool recognises both bone naming schemes they ship with (Rigify "DEF-*" and the
// Unreal/Godot mannequin names). Git mirrors used here:
//   https://github.com/J-Ponzo/gltf-universal-animation-library      (glTF, UAL1 standard)
//   https://github.com/tilakpatell/tilakverse-assets                 (GLB, UAL1 + UAL2)
//
//   npm install            # three, for the GLTF loader
//   node tools/build-rig.mjs UAL1.glb UAL2.glb [--out file.json] [--only kick,celebrate]
//
// Retargeting: every rig is T-posed, Y-up and faces +Z with its left side on +X. For every frame
// the source bone's world rotation relative to its rest is applied to our bone (whose rest world
// rotation is identity), then converted back to a local rotation. The pelvis translation is
// scaled by the hip-height ratio. Loops have their last frame equal to the first. One-shot clips
// keep their pelvis travel; the runtime decides how much of it to use.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
const OURS = BONES.map(([n]) => n);
const MAPS = {
  rigify: ['DEF-hips', 'DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003', 'DEF-neck', 'DEF-head',
    'DEF-shoulder.L', 'DEF-upper_arm.L', 'DEF-forearm.L', 'DEF-hand.L', 'DEF-shoulder.R', 'DEF-upper_arm.R', 'DEF-forearm.R', 'DEF-hand.R',
    'DEF-thigh.L', 'DEF-shin.L', 'DEF-foot.L', 'DEF-toe.L', 'DEF-thigh.R', 'DEF-shin.R', 'DEF-foot.R', 'DEF-toe.R'],
  mannequin: ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
    'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
    'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'],
};
// Loops: [source clip]. One-shot motions: segments [source clip, from s, to s] joined with a short
// crossfade. The first source file that has a clip provides it, so the locomotion loops keep
// coming from the first file given.
const CLIPS = {
  idle: { loop: 'Idle_Loop' }, walk: { loop: 'Walk_Loop' }, run: { loop: 'Jog_Fwd_Loop' }, sprint: { loop: 'Sprint_Loop' },
  // sliding tackle: drop, slide on the hip, get up into a run
  tackle: { seq: [['Slide_Start', 0, 0.833], ['Slide_Loop', 0, 0.3], ['Slide_Exit', 0, 0.5]], fade: 0.1 },
  // header jump: load, take off, tuck, land (the flight itself is lifted by the runtime)
  header: { seq: [['Jump_Start', 0, 0.62], ['Jump_Land', 0.02, 0.9]], fade: 0.1 },
  // goal celebration: both arms up
  cheer: { seq: [['Celebration', 0, 2.4]] },
  // goalkeeper (V7.9): the set position, its side-steps and backpedal, getting up after a dive, a punch
  // and the overarm throw
  gkReady: { loop: 'Crouch_Idle_Loop' }, gkLeft: { loop: 'Crouch_Left_Loop' }, gkRight: { loop: 'Crouch_Right_Loop' }, gkBack: { loop: 'Jog_Bwd_Loop' },
  gkGetUp: { seq: [['LayToIdle', 0, 1.53]] },
  gkPunch: { seq: [['Punch_Cross', 0, 1.0]] },
  gkThrow: { seq: [['OverhandThrow', 0, 1.33]] },
};
const FPS = 30;

function toGlb(file) {
  const raw = fs.readFileSync(file);
  if (raw.readUInt32LE(0) === 0x46546c67) return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const j = JSON.parse(raw.toString('utf8'));
  const bin = fs.readFileSync(path.join(path.dirname(file), j.buffers[0].uri));
  j.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const bb = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([head, js, bh, bb]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

const args = process.argv.slice(2), files = [], opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else files.push(args[i]);
if (!files.length) { console.error('usage: node tools/build-rig.mjs <UAL1.glb|.gltf> [UAL2.glb] [--out file.json] [--only a,b]'); process.exit(1); }

const sources = [];
for (const file of files) {
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(toGlb(file), '', res, rej));
  const find = n => gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const scheme = Object.keys(MAPS).find(k => MAPS[k].every(n => find(n)));
  if (!scheme) throw new Error(file + ': unknown skeleton');
  const map = Object.fromEntries(OURS.map((n, i) => [n, find(MAPS[scheme][i])]));
  gltf.scene.updateMatrixWorld(true);
  const restQ = Object.fromEntries(OURS.map(n => [n, map[n].getWorldQuaternion(new THREE.Quaternion())]));
  const hipRest = map.Hips.getWorldPosition(new THREE.Vector3());
  const thighY = map.LeftUpLeg.getWorldPosition(new THREE.Vector3()).y;
  sources.push({ file: path.basename(file), gltf, map, restQ, hipRest, scale: BONES[14][2][1] / thighY, mixer: new THREE.AnimationMixer(gltf.scene) });
}

const ourHip = new THREE.Vector3(...BONES[0][2]);
const only = opt.only ? opt.only.split(',') : null;
const out = { format: 'managerstory-rig-1', source: 'Quaternius Universal Animation Library 1 and 2 (CC0 1.0), retargeted by tools/build-rig.mjs', bones: BONES, fps: FPS, clips: {} };
function sampler(name) {
  const src = sources.find(s => s.gltf.animations.some(a => a.name === name));
  if (!src) throw new Error('missing clip ' + name);
  const clip = src.gltf.animations.find(a => a.name === name), { gltf, map, restQ, hipRest, scale, mixer } = src;
  mixer.stopAllAction(); mixer.clipAction(clip).play();
  return {
    from: src.file + ':' + name, duration: clip.duration,
    at(t) {
      mixer.setTime(clamp(t, 0, clip.duration - 1e-4)); gltf.scene.updateMatrixWorld(true);
      const world = {}, local = {};
      for (const [n, parent] of BONES) {
        world[n] = map[n].getWorldQuaternion(new THREE.Quaternion()).multiply(restQ[n].clone().invert());
        local[n] = parent ? world[parent].clone().invert().multiply(world[n]) : world[n].clone();
      }
      const hp = map.Hips.getWorldPosition(new THREE.Vector3()).sub(hipRest).multiplyScalar(scale);
      return { local, hip: [hp.x, ourHip.y + hp.y, hp.z] };
    },
  };
}
const clamp = THREE.MathUtils.clamp;
function store(frames) {
  const rotations = Object.fromEntries(OURS.map(n => [n, []])), hips = [];
  for (const f of frames) {
    for (const n of OURS) rotations[n].push(...f.local[n].toArray().map(v => +v.toFixed(4)));
    hips.push(...f.hip.map(v => +v.toFixed(3)));
  }
  return { rotations, hips };
}
for (const [key, spec] of Object.entries(CLIPS)) {
  if (only && !only.includes(key)) continue;
  let frames = [], from;
  if (spec.loop) {
    const s = sampler(spec.loop), n = Math.max(2, Math.round(s.duration * FPS));
    for (let f = 0; f <= n; f++) frames.push(s.at(f === n ? 0 : f / n * s.duration));   // last frame = first: seamless loop
    from = s.from;
  } else {
    const K = Math.round((spec.fade ?? 0) * FPS), parts = [];
    for (const [name, a, b] of spec.seq) {
      const s = sampler(name), n = Math.max(1, Math.round((b - a) * FPS)), seg = [];
      for (let f = 0; f <= n; f++) seg.push(s.at(a + f / n * (b - a)));
      if (frames.length) {
        // crossfade from where the previous segment stopped into the new one
        const last = frames.at(-1);
        for (let j = 1; j <= K && j < seg.length; j++) {
          const u = THREE.MathUtils.smoothstep(j / (K + 1), 0, 1);
          for (const bn of OURS) seg[j].local[bn] = last.local[bn].clone().slerp(seg[j].local[bn], u);
          seg[j].hip = seg[j].hip.map((v, i) => last.hip[i] + (v - last.hip[i]) * u);
        }
        seg.shift();
      }
      frames.push(...seg); parts.push(s.from + '[' + a + '-' + b + ']');
    }
    from = parts.join(' + ');
  }
  out.clips[key] = { duration: +((frames.length - 1) / FPS).toFixed(4), frames: frames.length, loop: !!spec.loop, from, ...store(frames) };
}
const dest = opt.out ? path.resolve(opt.out) : new URL('../src/assets/models/footballer-rig.json', import.meta.url).pathname;
fs.writeFileSync(dest, JSON.stringify(out));
console.log('wrote', dest, (fs.statSync(dest).size / 1024).toFixed(0) + ' KB', Object.entries(out.clips).map(([k, c]) => `${k} ${c.duration}s`).join(', '));
