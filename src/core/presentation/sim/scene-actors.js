import { plantSimulationFeet } from './scene-footwork.js';
import { simulationCelebration } from './scene-atmosphere.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import { poseSimulationKeeper } from './keeper-animation.js';
import { poseSimulationHands } from './scene-hands.js';
import { simulationContactAnimation, simulationShieldAnimation } from './scene-actions.js';
import { blendSimulationGait } from './scene-gait.js';
import { poseSimulationContactFoot } from './scene-contact-feet.js';

// Only the detached scene sample reaches here. Runtime locomotion/ball solvers are never called.
export function createSimulationActors(runtime, describe) {
  const actors = new Map();
  let previousTime = null;
  return {
    apply(frame) {
      const seconds = previousTime == null ? 0 : Math.max(0, frame.physicsTime - previousTime);
      previousTime = frame.physicsTime;
      runtime.S.t = frame.physicsTime;
      synchronizeSceneRoster(runtime, actors, { frame, describe });
      runtime.ball.p.copy(frame.ball.position);
      runtime.ball.v.copy(frame.ball.velocity);
      runtime.ball.owner = actors.get(frame.ball.ownerId) ?? null;
      for (const sample of frame.players) poseSimulationActor(runtime, actors.get(sample.id), { sample, frame, seconds });
    },
  };
}

function synchronizeSceneRoster(runtime, actors, { frame, describe }) {
  for (const actor of actors.values()) { actor.offPitch = true; actor.model.visible = false; }
  for (const sample of frame.players) {
    if (!actors.has(sample.id)) actors.set(sample.id, runtime.addPlayer(describe(sample)));
    const actor = actors.get(sample.id);
    actor.offPitch = false;
    actor.model.visible = true;
  }
}

function poseSimulationActor(runtime, actor, { sample, frame, seconds }) {
  if (actor.sceneSampled && sameActorPose(actor, sample, frame)) return;
  sampleActorVelocity(actor, sample, seconds);
  prepareActorPose(actor, sample, frame);
  runtime.pose(actor, seconds);
  poseSimulationKeeper(actor, sample, frame);
  poseSimulationHands(runtime, actor, frame);
  blendSimulationGait(actor, seconds);
  plantSimulationFeet(runtime, actor, seconds);
  poseSimulationContactFoot(runtime, actor, { sample, frame });
  // The rig may lift a foot or lean, but its root never chases a contact marker.
  actor.model.position.x = sample.position.x;
  actor.model.position.z = sample.position.z;
  actor.model.updateMatrixWorld(true);
}

function prepareActorPose(actor, sample, frame) {
  const firstSample = !actor.sceneSampled;
  actor.poseSettings = SIM_VIEW_DATA.pose;
  actor.pos.copy(sample.position);
  actor.sceneSampled = true;
  actor.scenePoseTime = frame.physicsTime;
  actor.scenePoseKey = actorPoseKey(sample, frame);
  actor.heading = sample.heading;
  const animation = simulationContactAnimation(sample, frame, actor);
  const shield = simulationShieldAnimation(actor, sample, frame);
  actor.act = animation.act ?? simulationCelebration(sample, frame) ?? shield;
  actor.motion = animation.motion ? { ...animation.motion, dur: actor.A[animation.motion.name].getClip().duration } : null;
  actor.loopsWant.jockey = Number(sample.motionMode === 'jockey');
  actor.loopsWant.keeperReady = Number(sample.slot === 'GK' && ['set', 'reacting', 'step', 'dive'].includes(sample.keeper.mode));
  actor.loopsWant.throwHold = Number(frame.ball.heldBy === sample.id);
  if (firstSample) Object.assign(actor.loops, actor.loopsWant);
}

function sameActorPose(actor, sample, frame) {
  return actor.scenePoseTime === frame.physicsTime && actor.pos.x === sample.position.x
    && actor.pos.z === sample.position.z && actor.heading === sample.heading && actor.scenePoseKey === actorPoseKey(sample, frame);
}

function actorPoseKey(sample, frame) {
  return `${sample.motionMode}:${sample.keeper.mode}:${frame.ball.heldBy}:${frame.contacts.length}:${frame.contacts.at(-1)?.time}`;
}

function sampleActorVelocity(actor, sample, seconds) {
  if (!actor.sceneSampled) actor.vel.copy(sample.velocity);
  else if (seconds > SIM_VIEW_DATA.pose.minimumStepSeconds) {
    actor.vel.set((sample.position.x - actor.pos.x) / seconds, 0, (sample.position.z - actor.pos.z) / seconds);
  }
}
