import { simulationNutmegRoute, simulationNutmegProgress } from './nutmeg-geometry.js';
import SKILL_DATA from '../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { chooseSimulationGroundSkill } from './ground-skill-choice.js';
import { startCarry } from './dribbling.js';
import { emitSimulationEvent } from './ball-events.js';
import { simulationRuntime } from './simulation-runtime.js';
import { pointDistance } from './geometry.js';
import { fitCarryTarget } from './dribble-evaluation.js';
import { faceSimulationPlayer } from './player-movement.js';
import { simulationCarrySkillData } from './carry-skill-data.js';
import { chooseSimulationAirSkill, simulationSkillLandingTarget } from './air-skills.js';

export function beginSimulationGroundSkill(simulation, owner, choice) {
  return !!SKILL_DATA.ground[choice.kind] && beginSimulationCarrySkill(simulation, owner, choice);
}

export function beginSimulationCarrySkill(simulation, owner, choice) {
  const pattern = simulationCarrySkillData(choice.kind), defender = simulationRuntime(simulation).byId.get(choice.defenderId);
  if (!pattern || !defender || defender.teamId === owner.teamId || simulation.ball.ownerId !== owner.id) return false;
  if (simulation.ball.height > SKILL_DATA.maximumBallHeight || pointDistance(owner.position, defender.position) > SKILL_DATA.maximumDefenderDistance) return false;
  if (!simulation.ball.carry) startCarry(simulation, owner);
  const lateral = (defender.position.y - owner.position.y) * Math.cos(owner.heading) - (defender.position.x - owner.position.x) * Math.sin(owner.heading);
  simulation.ball.carry.skill = { kind: choice.kind, defenderId: defender.id, startedAt: simulation.time, heading: owner.heading,
    side: lateral >= 0 ? -1 : 1, phase: 0, position: { ...simulation.ball.position }, lastTouch: null };
  simulation.ownerDecision.selected = 'dribble';
  return true;
}

export function prepareSimulationCarrySkill(simulation, owner) {
  const skill = simulation.ball.carry?.skill;
  if (!skill) return false;
  const pattern = simulationCarrySkillData(skill.kind), elapsed = simulation.time - skill.startedAt;
  if (elapsed >= pattern.duration) { simulation.ball.carry.skill = null; simulation.passing.nextEvaluationTick = simulation.tick; return false; }
  owner.role = 'holder'; owner.gait = 'walk'; owner.motionMode = 'jockey';
  owner.target = simulation.ball.ownerId == null ? simulation.ball.position : { ...owner.position };
  prepareSimulationAirSkillTarget(simulation, owner, pattern);
  prepareSimulationNutmegRoute(simulation, owner, { skill, pattern });
  const heading = skill.heading + (pattern.spin ?? 0) * Math.min(1, elapsed / (pattern.spinSeconds ?? pattern.duration));
  owner.facingTarget = { x: owner.position.x + Math.cos(heading), y: owner.position.y + Math.sin(heading) };
  if (pointDistance(owner.position, owner.target) <= MATCH_SIM_DATA.movement.arrivalRadius) faceSimulationPlayer(owner, owner.facingTarget);
  return true;
}

function prepareSimulationNutmegRoute(simulation, owner, { skill, pattern }) {
  if (!pattern.throughLegs || skill.phase !== 1) return;
  const defender = simulationRuntime(simulation).byId.get(skill.defenderId);
  owner.target = simulationNutmegRoute(defender, skill); owner.gait = 'sprint'; owner.motionMode = 'dribble';
}

function prepareSimulationAirSkillTarget(simulation, owner, pattern) {
  if (!pattern.air || simulation.ball.ownerId != null || simulation.ball.height <= 0) return;
  owner.target = simulationSkillLandingTarget(simulation.ball); owner.gait = 'sprint'; owner.motionMode = 'dribble';
}

export function simulationCarrySkillTouch(simulation, owner) {
  let skill = simulation.ball.carry?.skill;
  if (!skill) {
    const choice = chooseSimulationAirSkill(simulation, owner) ?? chooseSimulationGroundSkill(simulation, owner);
    if (!choice || !beginSimulationCarrySkill(simulation, owner, choice)) return null;
    skill = simulation.ball.carry.skill;
  }
  const pattern = simulationCarrySkillData(skill.kind), phase = pattern.contacts[skill.phase];
  if (!phase || simulation.time - skill.startedAt + MATCH_SIM_DATA.clock.epsilon < phase.at) return false;
  const angle = skill.heading + phase.angle * skill.side;
  return { angle, distance: phase.distance, duration: phase.seconds, speed: phase.speed, height: simulation.ball.height, verticalVelocity: phase.verticalVelocity };
}

export function recordSimulationSkillTouch(simulation, owner) {
  const skill = simulation.ball.carry?.skill;
  if (!skill) return;
  skill.phase++; skill.lastTouch = simulation.time;
  const pattern = simulationCarrySkillData(skill.kind);
  if (skill.phase !== pattern.contacts.length) return;
  if (!pattern.throughLegs) emitSimulationSkill(simulation, owner, skill);
  const heading = skill.heading + pattern.exitAngle * skill.side;
  simulation.ownerDecision.dribble.target = fitCarryTarget({ x: owner.position.x + Math.cos(heading) * SKILL_DATA.exitDistance,
    y: owner.position.y + Math.sin(heading) * SKILL_DATA.exitDistance });
}

function emitSimulationSkill(simulation, owner, skill) {
  emitSimulationEvent(simulation, { type: 'skill', kind: skill.kind, fromId: owner.id, toId: skill.defenderId,
    teamId: owner.teamId, fromPos: { ...skill.position }, toPos: { ...simulation.ball.position },
    startedAt: skill.startedAt, heading: skill.heading, side: skill.side, observed: false });
}

export function recordSimulationNutmeg(simulation, before) {
  const skill = simulation.ball.carry?.skill;
  if (!SKILL_DATA.ground[skill?.kind]?.throughLegs || skill.phase !== 1) return;
  const runtime = simulationRuntime(simulation);
  const defender = runtime.byId.get(skill.defenderId), index = runtime.players.indexOf(defender);
  const previous = { x: runtime.previousPositions[index * 2], y: runtime.previousPositions[index * 2 + 1] };
  if (!simulationNutmegProgress(simulation.ball, defender, { skill, before, previous })) return;
  skill.phase = 2;
  emitSimulationSkill(simulation, runtime.byId.get(simulation.ball.carry.playerId), skill);
}

export function simulationSkillDefenderTarget(simulation, defender, target) {
  const skill = simulation.ball.carry?.skill;
  if (!skill || skill.defenderId !== defender.id) return target;
  const pattern = simulationCarrySkillData(skill.kind), elapsed = simulation.time - skill.startedAt;
  if (pattern.throughLegs) return target;
  if (elapsed < SKILL_DATA.feintStartSeconds || elapsed > pattern.contacts[0].at) return target;
  const error = 1 - (defender.attributes.positioning + defender.attributes.reactions) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const side = skill.heading - skill.side * Math.PI / 2, distance = error * SKILL_DATA.feintReadDistance;
  return fitCarryTarget({ x: target.x + Math.cos(side) * distance, y: target.y + Math.sin(side) * distance });
}
