// ManagerStory's own footballer skeleton and its locomotion clips.
// Data: assets/models/footballer-rig.json, built by tools/build-rig.mjs from Quaternius'
// Universal Animation Library (CC0 1.0). No third-party model files are loaded at runtime.
import * as THREE from 'three';

export function loadRig(data) {
  if (data?.format !== 'managerstory-rig-1') throw new Error('Unknown rig format');
  const bones = data.bones;
  const world = Object.fromEntries(bones.map(([n, , p]) => [n, new THREE.Vector3(...p)]));

  function newInstance() {
    const group = new THREE.Group(), byName = {}, list = [];
    for (const [name, parent] of bones) {
      const b = new THREE.Bone(); b.name = name;
      const local = world[name].clone(); if (parent) local.sub(world[parent]);
      b.position.copy(local);
      (parent ? byName[parent] : group).add(b);
      byName[name] = b; list.push(b);
    }
    group.updateMatrixWorld(true);
    return { group, bones: byName, skeleton: new THREE.Skeleton(list) };
  }

  const clips = {};
  for (const [key, c] of Object.entries(data.clips)) {
    const times = Float32Array.from({ length: c.frames }, (_, i) => i / data.fps);
    const tracks = bones.map(([n]) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, Float32Array.from(c.rotations[n])));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, Float32Array.from(c.hips)));
    clips[key] = new THREE.AnimationClip(key, (c.frames - 1) / data.fps, tracks);
  }
  return { newInstance, clips, source: data.source };
}
