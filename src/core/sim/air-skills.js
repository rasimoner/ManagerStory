import SKILL_DATA from '../../data/match-sim-skills.json';
import { movesFor } from '../players/move-eligibility.js';
import { beginSimulationCarrySkill } from './ground-skills.js';
import { simulationSkillSituation, nearestSimulationSkillDefender } from './ground-skill-choice.js';
import { predictSimulationBall, simulationBallLandingSeconds } from './ball-physics.js';
import { fitCarryTarget } from './dribble-evaluation.js';

export function beginSimulationAirSkill(simulation, owner, choice) {
  return !!SKILL_DATA.air[choice.kind] && beginSimulationCarrySkill(simulation, owner, choice);
}

export function chooseSimulationAirSkill(simulation, owner) {
  if (!simulationSkillSituation(simulation, owner) || owner.attributes.technique < SKILL_DATA.airAbility) return null;
  if (Math.hypot(owner.velocity.x, owner.velocity.y) > SKILL_DATA.airMaximumSpeed) return null;
  const defender = nearestSimulationSkillDefender(simulation, owner);
  if (!defender) return null;
  const rating = movesFor(name => owner.attributes[name] ?? 0, owner.slot);
  const preferred = Object.keys(SKILL_DATA.air).find(kind => rating.moves.includes(kind));
  return preferred ? { kind: preferred, defenderId: defender.id } : null;
}

export function simulationSkillLandingTarget(ball) {
  return fitCarryTarget(predictSimulationBall(ball, simulationBallLandingSeconds(ball)).position);
}

