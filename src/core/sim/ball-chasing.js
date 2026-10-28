import { simulationPlayerAvailable } from './duel-state.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { pointSquaredDistance, clampSimValue } from './geometry.js';
import { predictSimulationBall } from './ball-physics.js';
import { simulationPlayerArrival } from './player-arrival.js';
import { simulationRuntime } from './simulation-runtime.js';

export function updateSimulationBallChasers(simulation) {
  const ball = simulation.ball;
  if (!simulationNeedsBallChasers(ball)) return;
  if (ball.restart) { chaseSimulationBall(simulation, simulationRuntime(simulation).byId.get(ball.restart.takerId), 'restart'); return; }
  const receiver = simulationRuntime(simulation).byId.get(ball.flight?.toId);
  if (receiver) chaseSimulationBall(simulation, receiver, 'receive');
  for (const team of simulation.teams) {
    const selected = nearestBallChasers(team, ball);
    for (const player of selected) {
      if (player.id === receiver?.id) continue;
      chaseSimulationBall(simulation, player, ball.flight ? 'intercept' : 'recover');
    }
  }
}

function nearestBallChasers(team, ball) {
  const selected = [], candidates = team.players.filter(player => simulationPlayerAvailable(player) && player.id !== ball.excludedId && player.id !== ball.carry?.playerId);
  for (let index = 0; index < MATCH_SIM_DATA.passing.chasePlayersPerTeam; index++) {
    let nearest = null, minimum = Infinity;
    for (const player of candidates) {
      if (selected.includes(player)) continue;
      const distance = pointSquaredDistance(player.position, ball.position);
      if (distance < minimum) { nearest = player; minimum = distance; }
    }
    if (nearest) selected.push(nearest);
  }
  return selected;
}

function chaseSimulationBall(simulation, player, role) {
  if (!simulationPlayerAvailable(player)) return;
  const runtime = simulationRuntime(simulation), ball = simulation.ball;
  const launchTick = ball.flight?.launchTick ?? 0;
  if (simulation.tick < launchTick + player.limits.reactionTicks) return;
  let chase = runtime.chaseTicks.get(player.id);
  if (!chase || simulation.tick >= chase.nextTick) {
    chase = { target: simulationInterceptTarget(player, ball), nextTick: simulation.tick + player.limits.reactionTicks };
    runtime.chaseTicks.set(player.id, chase);
  }
  player.target = chase.target;
  player.role = role;
  player.gait = 'sprint';
  player.coveringId = null;
  player.laneTargetId = null;
}

export function simulationInterceptTarget(player, ball) {
  const settings = MATCH_SIM_DATA.passing;
  let predicted = ball;
  for (let time = 0; time <= settings.chaseHorizonSeconds; time += settings.chaseStepSeconds) {
    predicted = predictSimulationBall(ball, time);
    if (predicted.height > MATCH_SIM_DATA.ball.reachableHeight) continue;
    if (Math.max(0, simulationPlayerArrival(player, predicted.position) - player.limits.reactionSeconds) <= time) break;
  }
  return fitBallChaseTarget(predicted.position);
}

function fitBallChaseTarget(position) {
  const pitch = MATCH_SIM_DATA.pitch;
  return { x: clampSimValue(position.x, -pitch.length / 2, pitch.length / 2), y: clampSimValue(position.y, -pitch.width / 2, pitch.width / 2) };
}

function simulationNeedsBallChasers(ball) {
  return ball.ownerId == null && !ball.carry;
}
