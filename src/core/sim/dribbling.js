import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime, drawSimulationRandom } from './simulation-runtime.js';
import { planningDistance } from './geometry.js';
import { emitSimulationEvent } from './ball-events.js';
import { simulationDurationTicks } from './duel-state.js';
import { simulationCarrySkillTouch, recordSimulationSkillTouch } from './ground-skills.js';

export function forceSimulationDribble(simulation, playerId) {
  const player = simulationRuntime(simulation).byId.get(playerId);
  if (!player || player.sentOff) throw new TypeError('Dribbling requires an available player.');
  simulation.ownerDecision.forcedPlayerId = playerId;
  simulation.passing.requested = null;
  simulation.passing.nextEvaluationTick = simulation.tick;
}

export function kickSimulationDribble(simulation, owner) {
  const ball = simulation.ball;
  if (!ball.carry) startCarry(simulation, owner);
  const special = simulationCarrySkillTouch(simulation, owner);
  if (special === false) return;
  if (!special && simulation.clock.pauseHalfPreparation && !carryTouchAligned(simulation, owner)) return;
  releaseCarryTouch(simulation, owner, special);
}

function releaseCarryTouch(simulation, owner, special) {
  const ball = simulation.ball;
  const settings = MATCH_SIM_DATA.dribbling;
  const skill = (owner.attributes.dribbling + owner.attributes.technique) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const speedRatio = Math.hypot(owner.velocity.x, owner.velocity.y) / owner.limits.maxSpeed;
  const pressure = simulation.ownerDecision.pressure ?? 0;
  const error = 1 - skill;
  const touch = carryTouchGeometry(owner, { settings, speedRatio, pressure, error }, special);
  const angle = touch.angle + (drawSimulationRandom(simulation) * 2 - 1) * settings.touchErrorAngle * error;
  const speed = touch.speed + (drawSimulationRandom(simulation) * 2 - 1) * settings.touchErrorDistance * error;
  const duration = touch.duration;
  Object.assign(ball, { ownerId: null, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    excludedId: owner.id, controlAfterTick: simulation.tick + simulationDurationTicks(duration), height: special?.height ?? 0, verticalVelocity: special?.verticalVelocity ?? 0 });
  if (ball.control) ball.control = null;
  ball.carry.touchTick = simulation.tick;
  simulation.events[ball.carry.eventIndex].touches++;
  if (special) recordSimulationSkillTouch(simulation, owner);
}

function carryTouchGeometry(owner, context, special) {
  const { settings, speedRatio, pressure, error } = context;
  const distance = special?.distance ?? (settings.touchMinimum + speedRatio * settings.touchSpeedDistance + error * settings.touchSkillDistance) * (1 - pressure * settings.touchPressureFactor);
  const duration = special?.duration ?? Math.max(settings.touchMinimumSeconds, distance / Math.max(1, Math.hypot(owner.velocity.x, owner.velocity.y)));
  return { angle: special?.angle ?? owner.heading, duration,
    speed: special?.speed ?? distance / duration + MATCH_SIM_DATA.ball.rollingDeceleration * duration / 2 };
}

export function startCarry(simulation, owner) {
  const eventIndex = emitSimulationEvent(simulation, { type: 'dribble', fromId: owner.id, toId: owner.id,
    fromPos: { ...owner.position }, toPos: { ...owner.position }, teamId: owner.teamId, distance: 0, touches: 0, success: true });
  simulation.ball.carry = { playerId: owner.id, teamId: owner.teamId, ownerSinceTick: simulation.ball.ownerSinceTick,
    eventIndex, previousPosition: { ...owner.position }, touchTick: null };
  simulation.statistics.teams[owner.teamId].dribbles++;
}

function carryTouchAligned(simulation, owner) {
  const target = simulation.ownerDecision.dribble.target;
  const turn = Math.atan2(target.y - owner.position.y, target.x - owner.position.x) - owner.heading;
  return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) <= MATCH_SIM_DATA.passing.angleTolerance;
}

export function recordSimulationCarryDistance(simulation) {
  const carry = simulation.ball.carry;
  if (!carry) return;
  const owner = simulationRuntime(simulation).byId.get(carry.playerId);
  const distance = planningDistance(owner.position, carry.previousPosition);
  simulation.statistics.teams[owner.teamId].dribbleDistance += distance;
  const event = simulation.events[carry.eventIndex];
  event.distance += distance;
  event.toPos = { ...owner.position };
  carry.previousPosition = { ...owner.position };
}

export function endSimulationCarry(simulation) {
  if (simulation.ball.carry) simulation.events[simulation.ball.carry.eventIndex].resolvedAt = simulation.time;
  simulation.ball.carry = null;
}
