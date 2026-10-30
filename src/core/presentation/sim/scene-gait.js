import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

// Blend recorded limb samples before foot planting; IK corrections never feed the next gait sample.
export function blendSimulationGait(actor, seconds) {
  const settings = SIM_VIEW_DATA.pose;
  const weight = 1 - Math.exp(-seconds / settings.gaitBlendSeconds);
  const active = !actor.keeper && !actor.act && !actor.motion && seconds <= settings.maximumAnimationGapSeconds;
  actor.sceneGaitPose ??= {};
  for (const name of settings.gaitBones) {
    const bone = actor.bones[name], previous = actor.sceneGaitPose[name];
    if (active && previous) bone.quaternion.copy(previous.clone().slerp(bone.quaternion, weight));
    actor.sceneGaitPose[name] ??= bone.quaternion.clone();
    actor.sceneGaitPose[name].copy(bone.quaternion);
  }
  actor.model.updateMatrixWorld(true);
}
