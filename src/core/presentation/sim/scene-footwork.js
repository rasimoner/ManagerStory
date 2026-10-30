import * as THREE from 'three';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

// Keep a planted boot in world space while the detached root continues its real trajectory.
export function plantSimulationFeet(runtime, actor, seconds) {
  const settings = SIM_VIEW_DATA.pose;
  if (!canPlantFeet(actor, seconds)) {
    actor.scenePlants = {};
    return;
  }
  actor.scenePlants ??= {};
  for (const side of ['Left', 'Right']) {
    const toe = actor.bones[`${side}ToeBase`].getWorldPosition(new THREE.Vector3());
    let plant = actor.scenePlants[side];
    if (toe.y > settings.releaseHeight || plant && toe.distanceTo(plant) > settings.maximumPlantDrift) {
      delete actor.scenePlants[side];
      continue;
    }
    if (!plant && toe.y < settings.plantHeight) plant = actor.scenePlants[side] = toe.clone();
    if (plant) runtime.footIK(actor, side, plant, 1);
  }
}

function canPlantFeet(actor, seconds) {
  if (actor.keeper || actor.motion || actor.act && actor.act.name !== 'celebrate') return false;
  return actor.vel.length() >= SIM_VIEW_DATA.pose.minimumPlantSpeed && seconds <= SIM_VIEW_DATA.camera.maximumFrameSeconds;
}
