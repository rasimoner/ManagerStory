import { integrateSimPlayer } from './player-movement.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue } from './geometry.js';

const { max, sqrt, atan2, sin, cos, abs } = Math;

export function simulationPlayerArrival(player, point) {
  const offsetX = point.x - player.position.x, offsetY = point.y - player.position.y;
  const distance = sqrt(offsetX * offsetX + offsetY * offsetY);
  const travel = max(0, distance - MATCH_SIM_DATA.ball.controlRadius);
  if (!travel) return 0;
  const projected = max(0, (player.velocity.x * offsetX + player.velocity.y * offsetY) / distance);
  const initial = clampSimValue(projected, 0, player.limits.maxSpeed);
  const heading = atan2(offsetY, offsetX) - player.heading;
  const turn = abs(atan2(sin(heading), cos(heading))) / player.limits.turnRate;
  return player.limits.reactionSeconds + turn + acceleratedTravelSeconds(player.limits, travel, initial);
}

function acceleratedTravelSeconds(limits, distance, initial) {
  const accelerating = (limits.maxSpeed - initial) / limits.acceleration;
  const accelerationDistance = initial * accelerating + limits.acceleration * accelerating * accelerating / 2;
  if (distance <= accelerationDistance) return (sqrt(initial * initial + 2 * limits.acceleration * distance) - initial) / limits.acceleration;
  return accelerating + (distance - accelerationDistance) / limits.maxSpeed;
}

export function simulationOpponentArrival(player, point, knownDistance) {
  const offsetX = point.x - player.position.x, offsetY = point.y - player.position.y;
  const distance = knownDistance ?? sqrt(offsetX * offsetX + offsetY * offsetY);
  const travel = max(0, distance - MATCH_SIM_DATA.ball.controlRadius);
  if (!travel) return 0;
  const projected = max(0, (player.velocity.x * offsetX + player.velocity.y * offsetY) / distance);
  // Opponents get an optimistic bound: no extra reaction or turn delay for an already developing lane.
  return acceleratedTravelSeconds(player.limits, travel, clampSimValue(projected, 0, player.limits.maxSpeed));
}

// Reuse the movement integrator: a braking or turning carrier is not a constant-velocity target.
export function predictSimulationPlayerPosition(player, seconds) {
  const projected = { ...player, position: { ...player.position }, velocity: { ...player.velocity } };
  const steps = Math.ceil(seconds / MATCH_SIM_DATA.clock.stepSeconds);
  for (let tick = 0; tick < steps; tick++) integrateSimPlayer(projected);
  return { position: projected.position, heading: projected.heading };
}
