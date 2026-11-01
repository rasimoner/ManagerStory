import SKILL_DATA from '../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { chooseSimulationGroundSkill } from './ground-skill-choice.js';
import { startCarry } from './dribbling.js';
import { emitSimulationEvent } from './ball-events.js';
import { simulationRuntime } from './simulation-runtime.js';
import { pointDistance } from './geometry.js';
import { fitCarryTarget } from './dribble-evaluation.js';
import { faceSimulationPlayer } from './player-movement.js';

export function beginSimulationGroundSkill(simulation, owner, choice) {
  const pattern = SKILL_DATA.ground[choice.kind], defender = simulationRuntime(simulation).byId.get(choice.defenderId);
  if (!pattern || !defender || defender.teamId === owner.teamId || simulation.ball.ownerId !== owner.id) return false;
  if (simulation.ball.height > SKILL_DATA.maximumBallHeight || pointDistance(owner.position, defender.position) > SKILL_DATA.maximumDefenderDistance) return false;
  if (!simulation.ball.carry) startCarry(simulation, owner);
  const lateral = (defender.position.y - owner.position.y) * Math.cos(owner.heading) - (defender.position.x - owner.position.x) * Math.sin(owner.heading);
  simulation.ball.carry.skill = { kind: choice.kind, defenderId: defender.id, startedAt: simulation.time, heading: owner.heading,
    side: lateral >= 0 ? -1 : 1, phase: 0, position: { ...simulation.ball.position }, lastTouch: null };
  simulation.ownerDecision.selected = 'dribble';
  return true;
}

export function prepareSimulationGroundSkill(simulation, owner) {
  const skill = simulation.ball.carry?.skill;
  if (!skill) return false;
  const pattern = SKILL_DATA.ground[skill.kind], elapsed = simulation.time - skill.startedAt;
  if (elapsed >= pattern.duration) { simulation.ball.carry.skill = null; simulation.passing.nextEvaluationTick = simulation.tick; return false; }
  owner.role = 'holder'; owner.gait = 'walk'; owner.motionMode = 'jockey';
  owner.target = simulation.ball.ownerId == null ? simulation.ball.position : { ...owner.position };
  const heading = skill.heading + (pattern.spin ?? 0) * Math.min(1, elapsed / (pattern.spinSeconds ?? pattern.duration));
  owner.facingTarget = { x: owner.position.x + Math.cos(heading), y: owner.position.y + Math.sin(heading) };
  if (pointDistance(owner.position, owner.target) <= MATCH_SIM_DATA.movement.arrivalRadius) faceSimulationPlayer(owner, owner.facingTarget);
  return true;
}

export function simulationGroundSkillTouch(simulation, owner) {
  let skill = simulation.ball.carry?.skill;
  if (!skill) {
    const choice = chooseSimulationGroundSkill(simulation, owner);
    if (!choice || !beginSimulationGroundSkill(simulation, owner, choice)) return null;
    skill = simulation.ball.carry.skill;
  }
  const pattern = SKILL_DATA.ground[skill.kind], phase = pattern.contacts[skill.phase];
  if (!phase || simulation.time - skill.startedAt + MATCH_SIM_DATA.clock.epsilon < phase.at) return false;
  const angle = skill.heading + phase.angle * skill.side;
  return { angle, distance: phase.distance, duration: phase.seconds };
}

export function recordSimulationGroundSkillTouch(simulation, owner) {
  const skill = simulation.ball.carry?.skill;
  if (!skill) return;
  skill.phase++; skill.lastTouch = simulation.time;
  const pattern = SKILL_DATA.ground[skill.kind];
  if (skill.phase !== pattern.contacts.length) return;
  emitSimulationEvent(simulation, { type: 'skill', kind: skill.kind, fromId: owner.id, toId: skill.defenderId,
    teamId: owner.teamId, fromPos: { ...skill.position }, toPos: { ...simulation.ball.position },
    startedAt: skill.startedAt, heading: skill.heading, side: skill.side, observed: false });
  const heading = skill.heading + pattern.exitAngle * skill.side;
  simulation.ownerDecision.dribble.target = fitCarryTarget({ x: owner.position.x + Math.cos(heading) * SKILL_DATA.exitDistance,
    y: owner.position.y + Math.sin(heading) * SKILL_DATA.exitDistance });
}

export function simulationSkillDefenderTarget(simulation, defender, target) {
  const skill = simulation.ball.carry?.skill;
  if (!skill || skill.defenderId !== defender.id) return target;
  const pattern = SKILL_DATA.ground[skill.kind], elapsed = simulation.time - skill.startedAt;
  if (elapsed < SKILL_DATA.feintStartSeconds || elapsed > pattern.contacts[0].at) return target;
  const error = 1 - (defender.attributes.positioning + defender.attributes.reactions) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const side = skill.heading - skill.side * Math.PI / 2, distance = error * SKILL_DATA.feintReadDistance;
  return fitCarryTarget({ x: target.x + Math.cos(side) * distance, y: target.y + Math.sin(side) * distance });
}
