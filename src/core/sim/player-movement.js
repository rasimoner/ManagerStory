import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance, subtractPoints } from './geometry.js';
import { accelerateInsidePitch } from './pitch-movement.js';

export function playerMovementLimits(attributes) {
  const movement = MATCH_SIM_DATA.movement;
  const scale = MATCH_SIM_DATA.attributes.maximum;
  const fitness = movement.minimumFitnessFactor + movement.fitnessFactorRange * attributes.fitness / scale;
  const decisions = MATCH_SIM_DATA.decisions;
  const reaction = decisions.maximumSeconds - (decisions.maximumSeconds - decisions.minimumSeconds) * attributes.reactions / scale;
  const reactionTicks = Math.ceil((reaction - MATCH_SIM_DATA.clock.epsilon) / MATCH_SIM_DATA.clock.stepSeconds);
  return {
    maxSpeed: (movement.baseSpeed + movement.paceSpeed * attributes.pace / scale) * fitness,
    acceleration: (movement.baseAcceleration + movement.attributeAcceleration * attributes.acceleration / scale) * fitness,
    turnRate: movement.turnRate,
    reactionTicks, reactionSeconds: reactionTicks * MATCH_SIM_DATA.clock.stepSeconds,
  };
}

export function movementGait(role, distance) {
  const movement = MATCH_SIM_DATA.movement;
  if (role === 'press' || distance >= movement.sprintDistance) return 'sprint';
  if (distance < movement.walkDistance) return 'walk';
  return distance < movement.jogDistance ? 'jog' : 'run';
}

export function integrateSimPlayer(player) {
  const seconds = MATCH_SIM_DATA.clock.stepSeconds;
  const desired = desiredPlayerVelocity(player);
  player.velocity = accelerateInsidePitch(player, desired);
  player.position = { x: player.position.x + player.velocity.x * seconds, y: player.position.y + player.velocity.y * seconds };
}

function desiredPlayerVelocity(player) {
  const offset = subtractPoints(player.target, player.position);
  const distance = pointDistance(player.target, player.position);
  const movement = MATCH_SIM_DATA.movement;
  if (distance <= movement.arrivalRadius) return { x: 0, y: 0 };
  turnPlayerTowards(player, Math.atan2(offset.y, offset.x));
  const arrivalSpeed = Math.sqrt(2 * player.limits.acceleration * Math.max(0, distance - movement.arrivalRadius));
  const desiredSpeed = Math.min(player.limits.maxSpeed * movement.gaits[player.gait], arrivalSpeed);
  // The facing limit also steers travel; a target switch cannot rotate a sprint instantly.
  const alignment = Math.max(0, Math.cos(player.heading - Math.atan2(offset.y, offset.x)));
  const speed = desiredSpeed * alignment;
  return { x: Math.cos(player.heading) * speed, y: Math.sin(player.heading) * speed };
}

function turnPlayerTowards(player, targetHeading) {
  const difference = Math.atan2(Math.sin(targetHeading - player.heading), Math.cos(targetHeading - player.heading));
  const maximum = player.limits.turnRate * MATCH_SIM_DATA.clock.stepSeconds;
  player.heading += clampSimValue(difference, -maximum, maximum);
  // Keep long headless runs numerically stable without changing the direction.
  player.heading = Math.atan2(Math.sin(player.heading), Math.cos(player.heading));
}

