import SKILL_DATA from '../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { movesFor } from '../players/move-eligibility.js';
import { simulationOwnerPressure } from './pass-evaluation.js';
import { pointDistance } from './geometry.js';

export function simulationNoLookPass(simulation, owner, option) {
  if (!canLookAway(simulation, owner, option)) return null;
  const direction = Math.atan2(option.target.y - owner.position.y, option.target.x - owner.position.x);
  const mates = simulation.teams.find(team => team.id === owner.teamId).players;
  const target = mates.filter(player => player.id !== owner.id && player.id !== option.toId && player.slot !== 'GK' && !player.sentOff)
    .find(player => visibleDecoy(owner, player, direction));
  return target ? { style: 'nolook', gazeTargetId: target.id, gazeTarget: { ...target.position } } : null;
}

function canLookAway(simulation, owner, option) {
  const settings = SKILL_DATA.noLook;
  if (!ordinaryFootPass(simulation, owner, option)) return false;
  if (!movesFor(name => owner.attributes[name] ?? 0, owner.slot).moves.includes('nolook')) return false;
  const distance = pointDistance(simulation.ball.position, option.target), pressure = simulationOwnerPressure(simulation, owner);
  const team = simulation.teams.find(team => team.id === owner.teamId);
  return distance >= settings.minimumDistance && distance <= settings.maximumDistance && owner.position.x * team.direction > settings.minimumAttackX
    && pressure >= settings.minimumPressure && pressure <= settings.maximumPressure
    && Math.hypot(owner.velocity.x, owner.velocity.y) <= settings.maximumSpeed;
}

function ordinaryFootPass(simulation, owner, option) {
  return simulation.clock.pauseHalfPreparation && owner.slot !== 'GK' && !option.lofted && !option.restartKind && option.contactTime == null;
}

function visibleDecoy(owner, player, direction) {
  const settings = SKILL_DATA.noLook, passing = MATCH_SIM_DATA.passing;
  const vision = passing.minimumVisionDistance + owner.attributes.vision / MATCH_SIM_DATA.attributes.maximum * passing.visionDistanceRange;
  const angle = Math.atan2(player.position.y - owner.position.y, player.position.x - owner.position.x) - direction;
  const difference = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  return pointDistance(owner.position, player.position) <= vision && difference >= settings.minimumGazeTurn && difference <= settings.maximumGazeTurn;
}
