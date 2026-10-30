import * as THREE from 'three';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

// A support foot fades out before its swing; releasing a full-strength IK lock caused turning jitter.
export function plantSimulationFeet(runtime, actor, seconds) {
  if (!canPlantFeet(actor, seconds)) { actor.scenePlants = {}; return; }
  actor.scenePlants ??= {};
  for (const side of ['Left', 'Right']) plantFoot(runtime, actor, { side, seconds });
}

function plantFoot(runtime, actor, { side, seconds }) {
  const settings = SIM_VIEW_DATA.pose, toe = actor.bones[`${side}ToeBase`].getWorldPosition(new THREE.Vector3());
  let plant = actor.scenePlants[side];
  if (!plant && toe.y < settings.plantHeight) plant = actor.scenePlants[side] = { target: toe.clone(), heading: actor.heading, weight: 1 };
  if (!plant) return;
  const turn = Math.abs(Math.atan2(Math.sin(actor.heading - plant.heading), Math.cos(actor.heading - plant.heading)));
  if (toe.y > settings.releaseHeight || toe.distanceTo(plant.target) > settings.maximumPlantDrift || turn > settings.plantTurnLimitRadians) plant.releasing = true;
  if (plant.releasing) plant.weight = Math.max(0, plant.weight - seconds / settings.plantFadeSeconds);
  if (plant.weight > 0) runtime.footIK(actor, side, plant.target, plant.weight);
  else delete actor.scenePlants[side];
}

function canPlantFeet(actor, seconds) {
  if (actor.keeper || actor.motion || actor.act && actor.act.name !== 'celebrate') return false;
  return actor.vel.length() >= SIM_VIEW_DATA.pose.minimumPlantSpeed && seconds <= SIM_VIEW_DATA.pose.maximumAnimationGapSeconds;
}
