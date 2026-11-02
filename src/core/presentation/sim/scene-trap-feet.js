import { trapBoot } from '../match3d/newview/beats/first-touch.js';
import SKILL_DATA from '../../../data/match-sim-skills.json';

export function prepareSimulationTrapFeet(runtime, actor, { sample, frame }) {
  const contact = frame.contacts.findLast(event => event.type === 'firstTouch' && event.style === 'trap'
    && event.toId === sample.id && event.time <= frame.physicsTime);
  const pending = frame.ball.trapIntent?.playerId === sample.id;
  const active = contact && frame.physicsTime - contact.time <= SKILL_DATA.footTrap.poseSeconds;
  if (!pending && !active) { actor.sceneTrapStarted = null; return; }
  actor.sceneTrapStarted ??= active ? contact.time - SKILL_DATA.footTrap.poseLeadSeconds : frame.physicsTime;
  actor.feet = trapBoot({ ball: runtime.ball, S: { t: actor.sceneTrapStarted } }, actor);
}
