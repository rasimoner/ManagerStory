import * as THREE from 'three';

// AnimationMixer skips writing unchanged tracks. Restore its unmodified sample before visual IK/overlays.
export function restorePoseBase(actor) {
  if (!actor.poseBase) return;
  for (const [name, pose] of Object.entries(actor.poseBase)) {
    actor.bones[name].quaternion.copy(pose.quaternion);
    actor.bones[name].position.copy(pose.position);
  }
}

export function rememberPoseBase(actor) {
  actor.poseBase ??= Object.fromEntries(Object.entries(actor.bones).map(([name, bone]) => [name, {
    quaternion: bone.quaternion.clone(), position: bone.position.clone(),
  }]));
  for (const [name, pose] of Object.entries(actor.poseBase)) {
    pose.quaternion.copy(actor.bones[name].quaternion);
    pose.position.copy(actor.bones[name].position);
  }
}

export function armPosePole(actor, side) {
  const point = name => actor.bones[name].getWorldPosition(new THREE.Vector3());
  const other = side === 'Left' ? 'Right' : 'Left';
  const across = point(`${side}Arm`).sub(point(`${other}Arm`)).normalize();
  const up = point('Head').sub(point('Hips')).normalize();
  return across.addScaledVector(up, -0.6);
}

export function stableArmPole(actor, { side, direction, time }) {
  const desired = projectArmPole(armPosePole(actor, side), direction);
  actor.armPoles ??= {};
  const previous = actor.armPoles[side], elapsed = time - (previous?.time ?? time);
  if (previous && elapsed >= 0 && elapsed <= actor.poseSettings.maximumAnimationGapSeconds) {
    const pole = projectArmPole(previous.pole.clone(), direction);
    if (desired.dot(pole) < 0) desired.negate();
    desired.copy(pole.lerp(desired, 1 - Math.exp(-elapsed / actor.poseSettings.armPoleBlendSeconds)).normalize());
  }
  actor.armPoles[side] = { time, pole: desired.clone() };
  return desired;
}

function projectArmPole(pole, direction) {
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < Number.EPSILON) pole.set(0, -1, 0);
  return pole.normalize();
}

export function blendArmPose(actor, pose, weight) {
  pose.upper.quaternion.copy(pose.beforeUpper.slerp(pose.upper.quaternion, weight));
  pose.lower.quaternion.copy(pose.beforeLower.slerp(pose.lower.quaternion, weight));
  actor.model.updateMatrixWorld(true);
}
