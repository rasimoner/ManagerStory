import * as THREE from 'three';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

// heldBy is authoritative possession. Its metric anchor stays in the engine; only the mesh uses the rig grip.
export function createSimulationBallAnchor(runtime) {
  let previous = null, release = null;
  return frame => {
    const elapsed = frame.physicsTime - (previous?.time ?? frame.physicsTime);
    if (elapsed < 0 || elapsed > SIM_VIEW_DATA.pose.maximumAnimationGapSeconds) { previous = null; release = null; }
    const grip = simulationGripPoint(runtime, frame.ball.heldBy);
    let position = grip ?? new THREE.Vector3().copy(frame.ball.position);
    if (grip) release = null;
    else if (previous?.held) release = { time: frame.physicsTime, from: previous.position.clone() };
    if (release) position = release.from.clone().lerp(position,
      THREE.MathUtils.smoothstep(frame.physicsTime - release.time, 0, SIM_VIEW_DATA.pose.gripReleaseSeconds));
    previous = { time: frame.physicsTime, position: position.clone(), held: !!grip };
    return position;
  };
}

export function simulationGripPoint(runtime, heldBy) {
  if (heldBy == null) return null;
  const actor = runtime?.players.find(player => player.id === heldBy && !player.offPitch);
  if (!actor) return null;
  return actor.bones.LeftHand.getWorldPosition(new THREE.Vector3())
    .add(actor.bones.RightHand.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
}

export function simulationKeeperGrip(actor) {
  const settings = SIM_VIEW_DATA.pose;
  const point = name => actor.bones[name].getWorldPosition(new THREE.Vector3());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(actor.bones.Spine2.getWorldQuaternion(new THREE.Quaternion()));
  const up = point('Head').sub(point('Hips')).normalize();
  const grip = point('Spine2').addScaledVector(forward, settings.gripForwardMetres).addScaledVector(up, -settings.gripDownMetres);
  grip.y = Math.max(grip.y, settings.gripGroundClearance + settings.gloveOffsetMetres);
  return grip;
}
