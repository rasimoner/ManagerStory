import * as THREE from 'three';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

// Gloves approach the engine ball and release from their grip; the ball itself is never attached to a rig.
export function poseSimulationHands(runtime, actor, frame) {
  if (!actor.keeper) return;
  const grip = observedGrip(actor, frame);
  if (!grip || grip.weight <= 0) return;
  const right = new THREE.Vector3(Math.cos(actor.heading), 0, -Math.sin(actor.heading));
  for (const side of ['Left', 'Right']) {
    const target = grip.target.clone().addScaledVector(right, SIM_VIEW_DATA.pose.gloveOffsetMetres * (side === 'Left' ? -1 : 1));
    runtime.handIK(actor, side, target, grip.weight);
  }
}

function observedGrip(actor, frame) {
  const holding = frame.ball.heldBy === actor.id;
  const claim = frame.contacts.findLast(event => event.type === 'keeperClaim' && event.fromId === actor.id && event.time <= frame.physicsTime);
  if (!claim) return holding ? { target: new THREE.Vector3().copy(frame.ball.position), weight: 1 } : null;
  const release = frame.contacts.findLast(event => ['keeperDistribution', 'pass', 'shot'].includes(event.type)
    && event.time > claim.time && event.time <= frame.physicsTime);
  const elapsed = frame.physicsTime - claim.time, duration = SIM_VIEW_DATA.pose.handGripSeconds;
  const weight = THREE.MathUtils.smoothstep(elapsed, 0, duration);
  if (holding) return { target: new THREE.Vector3().copy(frame.ball.position), weight };
  if (!release) return null;
  const fade = 1 - THREE.MathUtils.smoothstep(frame.physicsTime - release.time, 0, duration);
  return { target: actor.pos.clone().setY(MATCH_SIM_DATA.goalkeeper.carryHeight + MATCH_SIM_DATA.ball.radius), weight: weight * fade };
}
