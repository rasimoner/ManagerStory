import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance, subtractPoints } from './geometry.js';
import { accelerateInsidePitch } from './pitch-movement.js';

// Bind once: hot steps also run in an isolated VM for deterministic acceptance tests.
const { ceil, max, min, atan2, cos, sin, sqrt, SQRT2 } = Math;

export function playerMovementLimits(attributes) {
  const movement = MATCH_SIM_DATA.movement;
  const scale = MATCH_SIM_DATA.attributes.maximum;
  const fitness = movement.minimumFitnessFactor + movement.fitnessFactorRange * attributes.fitness / scale;
  const decisions = MATCH_SIM_DATA.decisions;
  const reaction = decisions.maximumSeconds - (decisions.maximumSeconds - decisions.minimumSeconds) * attributes.reactions / scale;
  const reactionTicks = ceil((reaction - MATCH_SIM_DATA.clock.epsilon) / MATCH_SIM_DATA.clock.stepSeconds);
  const maxSpeed = (movement.baseSpeed + movement.paceSpeed * attributes.pace / scale) * fitness;
  const acceleration = (movement.baseAcceleration + movement.attributeAcceleration * attributes.acceleration / scale) * fitness;
  return {
    maxSpeed, acceleration,
    boundaryClearance: maxSpeed * maxSpeed / (2 * acceleration / SQRT2) + maxSpeed * MATCH_SIM_DATA.clock.stepSeconds,
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
  if (!desired.x && !desired.y && !player.velocity.x && !player.velocity.y) return;
  player.velocity = accelerateInsidePitch(player, desired);
  player.position.x += player.velocity.x * seconds;
  player.position.y += player.velocity.y * seconds;
}

function desiredPlayerVelocity(player) {
  const offset = subtractPoints(player.target, player.position);
  const distance = pointDistance(player.target, player.position);
  const movement = MATCH_SIM_DATA.movement;
  if (distance <= movement.arrivalRadius) return { x: 0, y: 0 };
  const targetHeading = atan2(offset.y, offset.x);
  turnPlayerTowards(player, targetHeading);
  const arrivalSpeed = sqrt(2 * player.limits.acceleration * max(0, distance - movement.arrivalRadius));
  const desiredSpeed = min(player.limits.maxSpeed * movement.gaits[player.gait], arrivalSpeed);
  // The facing limit also steers travel; a target switch cannot rotate a sprint instantly.
  const alignment = max(0, cos(player.heading - targetHeading));
  const speed = desiredSpeed * alignment;
  return { x: cos(player.heading) * speed, y: sin(player.heading) * speed };
}

function turnPlayerTowards(player, targetHeading) {
  const difference = atan2(sin(targetHeading - player.heading), cos(targetHeading - player.heading));
  const maximum = player.limits.turnRate * MATCH_SIM_DATA.clock.stepSeconds;
  player.heading += clampSimValue(difference, -maximum, maximum);
  // Keep long headless runs numerically stable without changing the direction.
  player.heading = atan2(sin(player.heading), cos(player.heading));
}

export function faceSimulationPlayer(player, point) {
  turnPlayerTowards(player, atan2(point.y - player.position.y, point.x - player.position.x));
}

