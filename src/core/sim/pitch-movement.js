import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, limitVector, pointDistance, subtractPoints } from './geometry.js';

export function accelerateInsidePitch(player, desired) {
  const seconds = MATCH_SIM_DATA.clock.stepSeconds;
  const bounds = pitchVelocityBounds(player, seconds);
  const safe = fitVelocity(player.velocity, bounds);
  const remaining = Math.max(0, player.limits.acceleration * seconds - pointDistance(safe, player.velocity));
  const change = limitVector(subtractPoints(desired, safe), remaining);
  return fitVelocity({ x: safe.x + change.x, y: safe.y + change.y }, bounds);
}

function pitchVelocityBounds(player, seconds) {
  const pitch = MATCH_SIM_DATA.pitch;
  // Each axis reserves its share of the vector acceleration, so corner braking is feasible too.
  const acceleration = player.limits.acceleration / Math.SQRT2;
  const maximum = (distance) => safeBoundarySpeed(distance, acceleration, seconds);
  return {
    minX: -maximum(pitch.length / 2 + player.position.x), maxX: maximum(pitch.length / 2 - player.position.x),
    minY: -maximum(pitch.width / 2 + player.position.y), maxY: maximum(pitch.width / 2 - player.position.y),
  };
}

function safeBoundarySpeed(distance, acceleration, seconds) {
  const brakingStep = acceleration * seconds;
  return Math.max(0, Math.sqrt(brakingStep * brakingStep + 2 * acceleration * Math.max(0, distance)) - brakingStep);
}

function fitVelocity(velocity, bounds) {
  return { x: clampSimValue(velocity.x, bounds.minX, bounds.maxX), y: clampSimValue(velocity.y, bounds.minY, bounds.maxY) };
}
