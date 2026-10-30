import { plantSimulationFeet } from './scene-footwork.js';
import { simulationCelebration } from './scene-atmosphere.js';
import { ACTIONS } from '../match3d/newview/actions.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { MOTIONS } from '../match3d/newview/runtime.js';
import { poseSimulationKeeper } from './keeper-animation.js';

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
  const firstSample = !actor.sceneSampled;
  actor.vel.copy(sample.velocity);
  if (actor.sceneSampled && seconds > SIM_VIEW_DATA.pose.minimumStepSeconds) {
    actor.vel.set((sample.position.x - actor.pos.x) / seconds, 0, (sample.position.z - actor.pos.z) / seconds);
  }
  actor.pos.copy(sample.position);
  actor.sceneSampled = true;
  actor.heading = sample.heading;
  actor.act = simulationCelebration(sample, frame) ?? contactAction(sample, frame);
  actor.motion = contactMotion(actor, sample, frame);
  actor.loopsWant.jockey = Number(sample.motionMode === 'jockey');
  actor.loopsWant.keeperReady = Number(sample.slot === 'GK' && ['set', 'reacting', 'step', 'dive'].includes(sample.keeper.mode));
  actor.loopsWant.throwHold = Number(frame.ball.heldBy === sample.id);
  if (firstSample) Object.assign(actor.loops, actor.loopsWant);
  runtime.pose(actor, seconds);
  poseSimulationKeeper(actor, sample, frame);
  plantSimulationFeet(runtime, actor, seconds);
  // The rig may lift a foot or lean, but its root never chases a contact marker.
  actor.model.position.x = sample.position.x;
  actor.model.position.z = sample.position.z;
  actor.model.updateMatrixWorld(true);
}

function contactMotion(actor, sample, frame) {
  const contact = frame.contacts.findLast(event => event.fromId === sample.id && event.time <= frame.physicsTime
    && (event.type === 'keeperDistribution' || event.type === 'tackle' && event.kind === 'sliding'));
  const tackle = sample.duel.tackle;
  const name = contactMotionName(tackle, contact);
  if (!name || !actor.A[name]) return null;
  const time = tackle?.kind === 'sliding' ? tackle.contactTick * MATCH_SIM_DATA.clock.stepSeconds : contact.time;
  const start = time - MOTIONS[name].contact, duration = actor.A[name].getClip().duration;
  return frame.physicsTime - start < duration ? { name, t0: start, dur: duration } : null;
}

function contactMotionName(tackle, contact) {
  if (tackle?.kind === 'sliding' || contact?.type === 'tackle') return 'tackle';
  return contact?.kind === 'throw' ? 'gkThrow' : null;
}

function contactAction(sample, frame) {
  const contact = frame.contacts.findLast(event => event.fromId === sample.id && event.time <= frame.physicsTime
    && ['pass', 'shot', 'tackle', 'block'].includes(event.type));
  if (!contact) return null;
  const name = ['tackle', 'block'].includes(contact.type) ? 'lunge' : contact.type;
  const action = ACTIONS[name], start = contact.time - action.dur * (action.contact ?? 0);
  return frame.physicsTime - start <= action.dur ? { name, t0: start } : null;
}
