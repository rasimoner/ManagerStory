import SKILL_DATA from '../../data/match-sim-skills.json';
import { movesFor } from '../players/move-eligibility.js';
import { pointDistance } from './geometry.js';

export function chooseSimulationGroundSkill(simulation, owner) {
  if (!simulationSkillSituation(simulation, owner)) return null;
  const defender = nearestSimulationSkillDefender(simulation, owner);
  if (!defender) return null;
  const rating = movesFor(name => owner.attributes[name] ?? 0, owner.slot);
  const turn = carryHeadingChange(simulation, owner);
  const candidates = Object.entries(SKILL_DATA.ground).filter(([kind]) => kind === 'dragBack' || rating.moves.includes(kind));
  const preferred = candidates.sort((a, b) => Math.abs(Math.abs(turn) - a[1].preferredTurn) - Math.abs(Math.abs(turn) - b[1].preferredTurn))[0];
  return preferred ? { kind: preferred[0], defenderId: defender.id } : null;
}

export function simulationSkillSituation(simulation, owner) {
  if (!simulation.clock.pauseHalfPreparation || owner.slot === 'GK' || simulation.ball.height > SKILL_DATA.maximumBallHeight) return false;
  if (Math.min(owner.attributes.technique, owner.attributes.dribbling) < SKILL_DATA.minimumAbility) return false;
  if (Math.hypot(owner.velocity.x, owner.velocity.y) > SKILL_DATA.maximumSpeed || Math.abs(owner.position.y) > SKILL_DATA.maximumWidth) return false;
  const team = simulation.teams.find(team => team.id === owner.teamId);
  if (owner.position.x * team.direction < SKILL_DATA.minimumAttackX) return false;
  return !simulation.events.some(event => event.type === 'skill' && !event.observed && event.fromId === owner.id
    && simulation.time - event.time < SKILL_DATA.cooldownSeconds);
}

export function nearestSimulationSkillDefender(simulation, owner) {
  const opponents = simulation.teams.find(team => team.id !== owner.teamId).players.filter(player => !player.sentOff);
  const defender = opponents.sort((a, b) => pointDistance(a.position, owner.position) - pointDistance(b.position, owner.position))[0];
  return defender && pointDistance(defender.position, owner.position) <= SKILL_DATA.maximumDefenderDistance ? defender : null;
}

function carryHeadingChange(simulation, owner) {
  const target = simulation.ownerDecision.dribble?.target;
  if (!target) return 0;
  const turn = Math.atan2(target.y - owner.position.y, target.x - owner.position.x) - owner.heading;
  return Math.atan2(Math.sin(turn), Math.cos(turn));
}
