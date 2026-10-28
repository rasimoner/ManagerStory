import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue } from './geometry.js';

// Bind once: hot steps also run in an isolated VM for deterministic acceptance tests.
const { max, sqrt, hypot, SQRT2 } = Math;

export function accelerateInsidePitch(player, desired) {
  const seconds = MATCH_SIM_DATA.clock.stepSeconds;
  const bounds = pitchVelocityBounds(player, seconds);
  const safeX = clampSimValue(player.velocity.x, bounds.minX, bounds.maxX);
  const safeY = clampSimValue(player.velocity.y, bounds.minY, bounds.maxY);
  const remaining = max(0, player.limits.acceleration * seconds - hypot(safeX - player.velocity.x, safeY - player.velocity.y));
  const changeX = desired.x - safeX, changeY = desired.y - safeY;
  const length = hypot(changeX, changeY);
  const factor = length > remaining ? remaining / length : 1;
  return { x: clampSimValue(safeX + changeX * factor, bounds.minX, bounds.maxX), y: clampSimValue(safeY + changeY * factor, bounds.minY, bounds.maxY) };
}

function pitchVelocityBounds(player, seconds) {
  const pitch = MATCH_SIM_DATA.pitch;
  // Each axis reserves its share of the vector acceleration, so corner braking is feasible too.
  const acceleration = player.limits.acceleration / SQRT2;
  return {
    minX: -safeBoundarySpeed(pitch.length / 2 + player.position.x, acceleration, seconds), maxX: safeBoundarySpeed(pitch.length / 2 - player.position.x, acceleration, seconds),
    minY: -safeBoundarySpeed(pitch.width / 2 + player.position.y, acceleration, seconds), maxY: safeBoundarySpeed(pitch.width / 2 - player.position.y, acceleration, seconds),
  };
}

function safeBoundarySpeed(distance, acceleration, seconds) {
  const brakingStep = acceleration * seconds;
  return max(0, sqrt(brakingStep * brakingStep + 2 * acceleration * max(0, distance)) - brakingStep);
}
