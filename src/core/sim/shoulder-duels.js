import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { simulationPlayerAvailable, simulationDurationTicks } from './duel-state.js';
import { planningDistance, pointSquaredDistance } from './geometry.js';
import { emitSimulationEvent } from './ball-events.js';

export function prepareSimulationShoulders(simulation) {
  const runtime = simulationRuntime(simulation);
  runtime.shoulders ??= [];
  runtime.shoulders.length = 0;
  for (const player of runtime.players) player.shoulderSpeedRatio = 1;
  if (simulation.ball.ownerId != null) return;
  const near = runtime.players.filter(player => simulationPlayerAvailable(player) && pointSquaredDistance(player.position, simulation.ball.position) < MATCH_SIM_DATA.duels.shoulderBallDistance ** 2);
  for (let index = 0; index < near.length; index++) for (let other = index + 1; other < near.length; other++) prepareShoulderPair(simulation, near[index], near[other]);
}

function prepareShoulderPair(simulation, left, right) {
  const settings = MATCH_SIM_DATA.duels;
  if (left.teamId === right.teamId || planningDistance(left.position, right.position) > settings.shoulderDistance) return;
  const dot = left.velocity.x * right.velocity.x + left.velocity.y * right.velocity.y;
  if (dot <= 0) return;
  const leftForce = shoulderForce(left), rightForce = shoulderForce(right);
  const slowed = leftForce < rightForce ? left : right;
  slowed.shoulderSpeedRatio = settings.shoulderSpeedRatio;
  if (simulation.tick < Math.max(left.shoulderAfterTick ?? 0, right.shoulderAfterTick ?? 0)) return;
  left.shoulderAfterTick = right.shoulderAfterTick = simulation.tick + simulationDurationTicks(settings.shoulderCooldownSeconds);
  simulationRuntime(simulation).shoulders.push({ fromId: left.id, toId: right.id, fromPos: { ...left.position }, toPos: { ...right.position }, slowedId: slowed.id });
}

function shoulderForce(player) {
  const settings = MATCH_SIM_DATA.duels;
  return player.attributes.strength / MATCH_SIM_DATA.attributes.maximum * settings.shoulderStrengthWeight
    + Math.hypot(player.velocity.x, player.velocity.y) / player.limits.maxSpeed * settings.shoulderSpeedWeight;
}

export function recordSimulationShoulders(simulation) {
  for (const pair of simulationRuntime(simulation).shoulders) {
    emitSimulationEvent(simulation, { type: 'duel', ...pair, kind: 'shoulder', success: true });
    for (const id of [pair.fromId, pair.toId]) {
      const player = simulationRuntime(simulation).byId.get(id);
      simulation.statistics.teams[player.teamId].duels++;
    }
  }
}
