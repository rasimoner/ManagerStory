import * as THREE from 'three';
import { ACTIONS, applyAction, envelope } from '../match3d/newview/actions.js';
import { MOTIONS } from '../match3d/newview/runtime.js';
import { sampleKeeperClip, blendKeeperPoses, mirrorKeeperPose, applyKeeperRigPose, applyKeeperAngles } from './keeper-rig-pose.js';
import KEEPER_ANIMATION_DATA from '../../../data/match-sim-keeper-animation.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

const { timing, pose: settings } = KEEPER_ANIMATION_DATA;
const clamp = THREE.MathUtils.clamp;
const ease = value => { const bounded = clamp(value, 0, 1); return bounded * bounded * (3 - 2 * bounded); };
const end = {};
let duration = 0;
for (const name of ['transfer', 'extend', 'land', 'settle', 'tuck', 'push', 'stand', 'release']) { duration += timing[name]; end[name] = duration; }

// Every sample is absolute physics time: no cached dive phase, accumulated RAF time or future outcome.
export function poseSimulationKeeper(actor, sample, frame) {
  if (sample.slot !== 'GK') return;
  const base = keeperBasePose(actor, sample, frame);
  const attempt = keeperAttempt(sample, frame.physicsTime);
  const previous = previousKeeperAttempt(sample, frame.physicsTime);
  if (!attempt && !previous) { applyKeeperRigPose(actor, base); return; }
  const animated = interruptKeeperAttempt(actor, base, { attempt, previous });
  const release = keeperReleaseWeight(sample, frame, attempt ?? previous);
  applyKeeperRigPose(actor, blendKeeperPoses(animated.pose, base, release), animated.lift * (1 - release));
}

function interruptKeeperAttempt(actor, base, { attempt, previous }) {
  if (!previous) return keeperAttemptPose(actor, base, attempt);
  const grounded = keeperAttemptPose(actor, base, previous);
  if (!attempt) return grounded;
  const next = keeperAttemptPose(actor, base, attempt), weight = ease(attempt.elapsed / timing.interrupt);
  return { pose: blendKeeperPoses(grounded.pose, next.pose, weight), lift: THREE.MathUtils.lerp(grounded.lift, next.lift, weight) };
}

function previousKeeperAttempt(sample, time) {
  const save = sample.keeperPresentation?.previousSave;
  if (!save || save.time > time) return null;
  return keeperAttempt({ ...sample, keeperPresentation: null, keeper: { reactionAt: save.reactionAt, launchPosition: save.fromPos,
    target: { ...save.toPos, height: save.height } } }, time);
}

function keeperBasePose(actor, sample, frame) {
  const time = frame.physicsTime, speed = Math.hypot(sample.velocity.x, sample.velocity.z);
  const moving = speed > settings.movingSpeed, name = moving ? speed > settings.runSpeed ? 'run' : 'walk' : 'idle';
  const phase = moving ? sample.distanceMetres / settings.strideMetres : time;
  let pose = sampleKeeperClip(actor, name, phase % actor.A[name].getClip().duration);
  const ready = ['set', 'reacting', 'step', 'dive'].includes(sample.keeper.mode);
  if (ready) pose = blendKeeperPoses(pose, sampleKeeperClip(actor, 'gkReady', time % actor.A.gkReady.getClip().duration), settings.readyWeight);
  if (ready) applyAction(pose, 'keeperHands', 0, settings.readyWeight);
  if (frame.ball.heldBy === sample.id && sample.keeper.mode === 'holding') applyAction(pose, 'throwHold', 0, 1);
  return keeperContactPose(actor, pose, time);
}

function keeperContactPose(actor, pose, time) {
  const motion = actor.motion;
  if (motion) {
    const elapsed = time - motion.t0, data = MOTIONS[motion.name];
    const weight = ease(elapsed / data.fadeIn) * (1 - ease((elapsed - motion.dur + data.fadeOut) / data.fadeOut));
    pose = blendKeeperPoses(pose, sampleKeeperClip(actor, motion.name, elapsed), weight);
  }
  if (actor.act) {
    const elapsed = time - actor.act.t0, action = ACTIONS[actor.act.name];
    if (elapsed >= 0 && elapsed <= action.dur) applyAction(pose, actor.act.name, elapsed / action.dur, envelope(action, elapsed));
  }
  return pose;
}

function keeperAttempt(sample, time) {
  const state = sample.keeper, elapsed = time - state.reactionAt;
  if (!keeperAttemptActive(sample, time)) return null;
  const launch = state.launchPosition ?? { x: sample.position.x, y: sample.position.z };
  const lateral = -(state.target.x - launch.x || 0) * Math.cos(sample.heading) + (state.target.y - launch.y) * Math.sin(sample.heading);
  const height = clamp(((state.target.height ?? settings.lowHeight) - settings.lowHeight) / (settings.highHeight - settings.lowHeight), 0, 1);
  return { elapsed, side: lateral >= 0 ? 1 : -1, height, full: Math.abs(state.target.y - launch.y) > MATCH_SIM_DATA.goalkeeper.stepReach };
}

function keeperAttemptActive(sample, time) {
  const state = sample.keeper, elapsed = time - state.reactionAt, stopped = sample.keeperPresentation?.stoppedAt;
  if (state.reactionAt == null || !state.target || elapsed < 0 || elapsed > duration) return false;
  return !(stopped != null && stopped <= time && stopped < state.reactionAt);
}

function keeperAttemptPose(actor, base, attempt) {
  if (!attempt.full) return { pose: keeperShortReach(base, attempt), lift: 0 };
  const flight = keeperFlightPose(actor, attempt, base);
  if (attempt.elapsed <= end.settle) return flight;
  const crouch = keeperCrouchPose(actor, attempt);
  if (attempt.elapsed <= end.tuck) return { pose: blendKeeperPoses(flight.pose, crouch, ease((attempt.elapsed - end.settle) / timing.tuck)), lift: 0 };
  if (attempt.elapsed <= end.push) {
    const progress = ease((attempt.elapsed - end.tuck) / timing.push);
    return { pose: keeperCrouchPose(actor, { ...attempt, push: progress }), lift: 0 };
  }
  const progress = clamp((attempt.elapsed - end.push) / timing.stand, 0, 1);
  const clip = actor.A.gkGetUp.getClip(), time = THREE.MathUtils.lerp(settings.crouchTime, clip.duration, progress);
  const standing = sampleKeeperClip(actor, 'gkGetUp', time);
  return { pose: attempt.side < 0 ? mirrorKeeperPose(standing) : standing, lift: 0 };
}

function keeperFlightPose(actor, attempt, base) {
  const { elapsed, side, height } = attempt;
  const extension = ease((elapsed - timing.transfer) / timing.extend), landing = ease((elapsed - end.extend) / timing.land);
  const pose = sampleKeeperClip(actor, 'gkReady', 0);
  const action = 'diveRight';
  const progress = elapsed < end.extend ? ACTIONS[action].contact * ease(elapsed / end.extend)
    : THREE.MathUtils.lerp(ACTIONS[action].contact, 1, ease((elapsed - end.extend) / (timing.land + timing.settle)));
  applyAction(pose, action, progress, 1);
  applyKeeperAngles(pose, KEEPER_ANIMATION_DATA.landingAngles, landing);
  const directed = side < 0 ? mirrorKeeperPose(pose) : pose;
  const reachRoll = THREE.MathUtils.lerp(settings.lowRoll, settings.highRoll, height);
  const roll = THREE.MathUtils.lerp(reachRoll * extension, settings.landRoll, landing) * side;
  directed.Hips.quaternion.setFromEuler(new THREE.Euler(settings.forwardPitch, 0, roll, 'YXZ'));
  directed.Hips.position.x -= side * settings.transferMetres * ease(elapsed / timing.transfer);
  const airborne = Math.sin(Math.PI * clamp((elapsed - timing.transfer) / (timing.extend + timing.land), 0, 1));
  const lift = airborne * THREE.MathUtils.lerp(settings.lowLift, settings.highLift, height);
  return { pose: blendKeeperPoses(base, directed, ease(elapsed / timing.transfer)), lift };
}

function keeperCrouchPose(actor, attempt) {
  const crouch = sampleKeeperClip(actor, 'gkGetUp', settings.crouchTime);
  const support = blendKeeperPoses(crouch, crouch, 0);
  applyKeeperAngles(support, KEEPER_ANIMATION_DATA.supportAngles, 1);
  support.Hips.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), settings.tuckPitch);
  const pose = blendKeeperPoses(support, crouch, attempt.push ?? 0);
  return attempt.side < 0 ? mirrorKeeperPose(pose) : pose;
}

function keeperShortReach(base, attempt) {
  const pose = blendKeeperPoses(base, base, 0);
  const progress = ACTIONS.diveRight.contact * ease(attempt.elapsed / end.extend);
  const weight = 1 - ease((attempt.elapsed - end.extend) / (timing.land + timing.settle));
  applyAction(pose, attempt.side > 0 ? 'diveRight' : 'diveLeft', progress, weight);
  pose.Hips.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), settings.nearRoll * attempt.side * weight));
  return pose;
}

function keeperReleaseWeight(sample, frame, attempt) {
  const contact = frame.contacts.findLast(event => event.fromId === sample.id && event.type === 'keeperDistribution'
    && event.time <= frame.physicsTime && event.time >= sample.keeper.reactionAt);
  const interrupt = contact ? ease((frame.physicsTime - contact.time) / timing.interrupt) : 0;
  return Math.max(interrupt, ease((attempt.elapsed - end.stand) / timing.release));
}
