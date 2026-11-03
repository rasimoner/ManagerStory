import * as THREE from 'three';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import { simulationKeeperGrip } from './scene-grip.js';

// Observed possession closes the gloves around a reachable chest grip, through the existing recovery pose.
export function poseSimulationHands(runtime, actor, frame) {
  const follow = actor.keeper ? null : throwFollowThrough(actor, frame);
  if (follow) { reachWith(runtime, actor, follow); return; }
  if (!actor.keeper && frame.ball.heldBy !== actor.id) return;
  const grip = observedGrip(actor, frame);
  if (!grip || grip.weight <= 0) return;
  reachWith(runtime, actor, grip);
}

function reachWith(runtime, actor, grip) {
  const right = actor.bones.RightArm.getWorldPosition(new THREE.Vector3())
    .sub(actor.bones.LeftArm.getWorldPosition(new THREE.Vector3())).normalize();
  for (const side of ['Left', 'Right']) {
    const target = grip.target.clone().addScaledVector(right, (grip.spread ?? SIM_VIEW_DATA.pose.gloveOffsetMetres) * (side === 'Left' ? -1 : 1));
    runtime.handIK(actor, side, target, grip.weight);
  }
}

function observedGrip(actor, frame) {
  const holding = frame.ball.heldBy === actor.id;
  if (!actor.keeper) return holding ? { target: throwGrip(actor, frame), weight: 1 } : null;
  const claim = frame.contacts.findLast(event => event.type === 'keeperClaim' && event.fromId === actor.id && event.time <= frame.physicsTime);
  if (!claim) return holding ? { target: simulationKeeperGrip(actor), weight: 1 } : null;
  const release = frame.contacts.findLast(event => ['keeperDistribution', 'pass', 'shot'].includes(event.type)
    && event.time > claim.time && event.time <= frame.physicsTime);
  const elapsed = frame.physicsTime - claim.time, duration = SIM_VIEW_DATA.pose.handGripSeconds;
  const weight = THREE.MathUtils.smoothstep(elapsed, 0, duration);
  if (holding) return { target: simulationKeeperGrip(actor), weight };
  if (!release) return null;
  const fade = 1 - THREE.MathUtils.smoothstep(frame.physicsTime - release.time, 0, duration);
  return { target: simulationKeeperGrip(actor), weight: weight * fade };
}

// A thrower holds the ball over his own head wherever the restart spot was marked; only its height comes from the simulation.
function throwGrip(actor, frame) {
  const forward = SIM_VIEW_DATA.pose.throwGripForwardMetres;
  return new THREE.Vector3(actor.pos.x + Math.sin(actor.heading) * forward, frame.ball.position.y, actor.pos.z + Math.cos(actor.heading) * forward);
}

// After the release both hands travel on, forward and down through the line of the throw, instead of snapping to a loose pose.
function throwFollowThrough(actor, frame) {
  const settings = SIM_VIEW_DATA.pose.throwFollow;
  const release = frame.contacts.findLast(event => event.type === 'pass' && event.restartKind === 'throwIn'
    && event.fromId === actor.id && event.time <= frame.physicsTime);
  if (!release) return null;
  const progress = (frame.physicsTime - release.time) / settings.seconds;
  if (progress < 0 || progress >= 1) return null;
  const swing = THREE.MathUtils.smoothstep(progress, 0, 1), reach = THREE.MathUtils.lerp(settings.startForwardMetres, settings.endForwardMetres, swing);
  const target = new THREE.Vector3(actor.pos.x + Math.sin(actor.heading) * reach, THREE.MathUtils.lerp(settings.startHeightMetres, settings.endHeightMetres, swing),
    actor.pos.z + Math.cos(actor.heading) * reach);
  return { target, spread: settings.spreadMetres, weight: 1 - THREE.MathUtils.smoothstep(progress, settings.fadeFrom, 1) };
}
