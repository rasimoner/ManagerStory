import SKILL_DATA from '../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { movesFor } from '../players/move-eligibility.js';
import { pointDistance } from './geometry.js';
import { simulationOwnerPressure } from './pass-evaluation.js';
import { faceSimulationPlayer } from './player-movement.js';

export function prepareSimulationPassTechnique(simulation, owner) {
  const option = simulation.passing.selected;
  if (simulation.ownerDecision.selected !== 'pass' || !option) { if (simulation.passing.technique) simulation.passing.technique = null; return; }
  simulation.passing.technique ??= selectPassTechnique(simulation, owner, option);
  const technique = simulation.passing.technique;
  if (!technique) return;
  owner.motionMode = 'jockey'; owner.gait = 'walk';
  owner.target = technique.stance;
  owner.facingTarget = simulationPassFacingTarget(simulation, owner, option);
  settlePassTechnique(simulation, owner, technique);
}

function settlePassTechnique(simulation, owner, technique) {
  if (pointDistance(owner.position, technique.stance) > MATCH_SIM_DATA.movement.arrivalRadius) return;
  faceSimulationPlayer(owner, owner.facingTarget);
  if (Math.hypot(owner.velocity.x, owner.velocity.y) <= MATCH_SIM_DATA.passing.recoverySpeedThreshold) technique.readyAt ??= simulation.time;
}

function selectPassTechnique(simulation, owner, option) {
  const settings = SKILL_DATA.flairPass;
  if (!simulation.clock.pauseHalfPreparation || owner.slot === 'GK' || option.restartKind || simulation.ball.height > settings.maximumHeight) return null;
  if (Math.hypot(owner.velocity.x, owner.velocity.y) > settings.maximumSpeed || simulationOwnerPressure(simulation, owner) > settings.maximumPressure) return null;
  const rating = movesFor(name => owner.attributes[name] ?? 0, owner.slot);
  const distance = pointDistance(simulation.ball.position, option.target);
  const heading = Math.atan2(option.target.y - owner.position.y, option.target.x - owner.position.x);
  const turn = Math.abs(Math.atan2(Math.sin(heading - owner.heading), Math.cos(heading - owner.heading)));
  const kind = passTechniqueKind({ option, rating, distance, turn });
  if (!kind) return null;
  return createPassTechnique(simulation, owner, { kind, option, heading });
}

function passTechniqueKind({ option, rating, distance, turn }) {
  const settings = SKILL_DATA.flairPass;
  if (!option.lofted && rating.moves.includes('backheel') && distance >= settings.backheel.minimumDistance
    && distance <= settings.backheel.maximumDistance && turn >= settings.backheel.minimumTurn) return 'backheel';
  return option.lofted && rating.moves.includes('rabona') && distance >= settings.rabona.minimumDistance
    && distance <= settings.rabona.maximumDistance ? 'rabona' : null;
}

function createPassTechnique(simulation, owner, { kind, option, heading }) {
  const settings = SKILL_DATA.flairPass[kind], position = { ...simulation.ball.position };
  const facing = heading + (kind === 'backheel' ? Math.PI : 0), forward = { x: Math.cos(facing), y: Math.sin(facing) };
  const side = { x: -forward.y, y: forward.x };
  const stance = { x: position.x - forward.x * settings.behind + side.x * settings.side,
    y: position.y - forward.y * settings.behind + side.y * settings.side };
  const pitch = MATCH_SIM_DATA.pitch;
  if (Math.abs(stance.x) > pitch.length / 2 || Math.abs(stance.y) > pitch.width / 2) return null;
  return { kind, ownerId: owner.id, toId: option.toId, position, target: { ...option.target }, heading: facing,
    stance, readyAt: null };
}

export function simulationPassFacingTarget(simulation, owner, option) {
  const technique = simulation.passing.technique;
  return technique ? { x: owner.position.x + Math.cos(technique.heading), y: owner.position.y + Math.sin(technique.heading) } : option.target;
}

export function holdSimulationPassBall(simulation) {
  const technique = simulation.passing.technique;
  if (!technique || simulation.ball.ownerId !== technique.ownerId) return false;
  simulation.ball.position = { ...technique.position }; simulation.ball.velocity = { x: 0, y: 0 };
  return true;
}

export function simulationPassTechniqueReady(simulation) {
  const technique = simulation.passing.technique;
  return !technique || technique.readyAt != null && simulation.time - technique.readyAt >= SKILL_DATA.flairPass[technique.kind].windup;
}

export function simulationPassTechniqueCue(simulation, owner) {
  const technique = simulation.passing.technique;
  return technique?.ownerId === owner.id ? { style: technique.kind, technique: structuredClone(technique) } : null;
}
