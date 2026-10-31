import { ACTIONS } from '../match3d/newview/actions.js';
import { MOTIONS } from '../match3d/newview/runtime.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function simulationContactAnimation(sample, frame, actor) {
  const pending = pendingRestartAnimation(sample, frame.ball.restart);
  if (pending) return pending;
  const tackle = sample.duel.tackle;
  if (tackle?.kind === 'sliding') return { motion: motionAt('tackle', tackle.contactTick * MATCH_SIM_DATA.clock.stepSeconds) };
  const contact = frame.contacts.findLast(event => event.time <= frame.physicsTime && animationName(event, sample));
  if (!contact) return {};
  const name = animationName(contact, sample);
  if (MOTIONS[name]) {
    const motion = motionAt(name, contact.time);
    return frame.physicsTime - motion.t0 < actor.A[name].getClip().duration ? { motion } : {};
  }
  const action = ACTIONS[name], start = contact.time - action.dur * (action.contact ?? 0);
  return frame.physicsTime - start <= action.dur ? { act: { name, t0: start } } : {};
}

function pendingRestartAnimation(sample, restart) {
  return restart?.kind === 'throwIn' && restart.stage === 'ready' && restart.takerId === sample.id
    ? { act: { name: 'throwIn', t0: restart.readyTime } } : null;
}

function animationName(contact, sample) {
  if (contact.type === 'firstTouch') return controlAnimation(contact, sample);
  if (contact.type === 'duel') return shoulderAnimation(contact, sample);
  if (contact.fromId !== sample.id) return null;
  return ownerAnimationName(contact);
}

function ownerAnimationName(contact) {
  const move = movementAnimationName(contact);
  if (move) return move;
  if (contact.type === 'pass') return contact.restartKind === 'throwIn' ? 'throwIn' : 'pass';
  if (contact.type === 'keeperDistribution') return contact.kind === 'throw' ? 'gkThrow' : 'gkVolley';
  if (contact.type === 'tackle') return contact.kind === 'sliding' ? 'tackle' : 'lunge';
  if (contact.type === 'block') return 'lunge';
  return contact.type === 'shot' ? 'shot' : null;
}

function movementAnimationName(contact) {
  if (contact.type === 'beat') return 'cut';
  return contact.type === 'skill' ? skillAnimationName(contact) : null;
}

function skillAnimationName(contact) {
  const name = contact.kind === 'bodyFeint' ? 'feint' : 'cut';
  return contact.turn < 0 ? name + 'Left' : name;
}

function shoulderAnimation(contact, sample) {
  return contact.kind === 'shoulder' && [contact.fromId, contact.toId].includes(sample.id) ? 'shoulder' : null;
}

function motionAt(name, time) { return { name, t0: time - MOTIONS[name].contact }; }
function controlAnimation(contact, sample) {
  if (contact.toId !== sample.id) return null;
  if (contact.kind === 'head') return 'header';
  return contact.height >= SIM_VIEW_DATA.pose.chestControlHeight ? 'chest' : null;
}

export function simulationShieldAnimation(actor, sample, frame) {
  if (sample.motionMode !== 'shield' || frame.ball.ownerId !== sample.id) { actor.sceneShieldStarted = null; return null; }
  actor.sceneShieldStarted ??= frame.physicsTime;
  const duration = ACTIONS.shoulder.dur;
  const cycles = Math.floor((frame.physicsTime - actor.sceneShieldStarted) / duration);
  return { name: 'shoulder', t0: actor.sceneShieldStarted + cycles * duration };
}
