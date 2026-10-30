import * as THREE from 'three';
import KEEPER_ANIMATION_DATA from '../../../data/match-sim-keeper-animation.json';

const samplers = new WeakMap();
const soleVertices = new WeakMap();
const worldPoint = new THREE.Vector3();

export function sampleKeeperClip(actor, name, time) {
  if (!samplers.has(actor)) samplers.set(actor, new Map());
  const clips = samplers.get(actor);
  if (!clips.has(name)) clips.set(name, actor.A[name].getClip().tracks.map(track => ({
    name: track.name.split('.')[0], rotation: track.name.endsWith('.quaternion'), interpolant: track.createInterpolant(),
  })));
  const pose = {};
  for (const track of clips.get(name)) {
    pose[track.name] ??= { quaternion: new THREE.Quaternion(), position: actor.bones[track.name].position.clone() };
    const value = track.interpolant.evaluate(time);
    if (track.rotation) pose[track.name].quaternion.fromArray(value).normalize();
    else pose[track.name].position.fromArray(value);
  }
  return pose;
}

export function blendKeeperPoses(from, to, weight) {
  const result = {};
  for (const name of Object.keys(from)) result[name] = {
    quaternion: from[name].quaternion.clone().slerp(to[name].quaternion, weight),
    position: from[name].position.clone().lerp(to[name].position, weight),
  };
  return result;
}

export function mirrorKeeperPose(pose) {
  const result = {};
  for (const [name, bone] of Object.entries(pose)) {
    const mirrored = name.startsWith('Left') ? name.replace('Left', 'Right') : name.replace('Right', 'Left');
    const quaternion = bone.quaternion.clone(), position = bone.position.clone();
    quaternion.y *= -1; quaternion.z *= -1;
    // Only the pelvis has a translation track; limb offsets remain the rig's bind geometry.
    if (name === 'Hips') position.x *= -1;
    result[mirrored] = { quaternion, position: name === 'Hips' ? position : pose[mirrored].position.clone() };
  }
  return result;
}

export function applyKeeperRigPose(actor, pose, lift = 0) {
  for (const [name, bone] of Object.entries(pose)) {
    actor.bones[name].quaternion.copy(bone.quaternion);
    if (name === 'Hips') actor.bones[name].position.copy(bone.position);
  }
  actor.model.position.copy(actor.pos);
  actor.model.rotation.set(0, actor.heading, 0);
  actor.model.updateMatrixWorld(true);
  const lowest = Math.min(keeperBootClearance(actor), ...Object.entries(KEEPER_ANIMATION_DATA.clearance).map(([name, radius]) => actor.bones[name].getWorldPosition(worldPoint).y - radius));
  actor.bones.Hips.position.y += KEEPER_ANIMATION_DATA.pose.groundClearance + lift - lowest;
  actor.model.updateMatrixWorld(true);
}

function keeperBootClearance(actor) {
  const geometry = actor.body.geometry;
  if (!soleVertices.has(geometry)) {
    const indices = [];
    for (let index = 0; index < geometry.attributes.position.count; index++) {
      if (KEEPER_ANIMATION_DATA.meshClearanceParts.includes(geometry.attributes.part.getX(index))) indices.push(index);
    }
    soleVertices.set(geometry, indices);
  }
  let lowest = Infinity;
  for (const index of soleVertices.get(geometry)) {
    worldPoint.fromBufferAttribute(geometry.attributes.position, index);
    actor.body.applyBoneTransform(index, worldPoint).applyMatrix4(actor.body.matrixWorld);
    lowest = Math.min(lowest, worldPoint.y);
  }
  return lowest;
}

export function applyKeeperAngles(pose, angles, weight) {
  for (const [name, values] of Object.entries(angles)) {
    const rotation = new THREE.Euler(...values.map(THREE.MathUtils.degToRad), 'XZY');
    pose[name].quaternion.slerp(new THREE.Quaternion().setFromEuler(rotation), weight);
  }
}
