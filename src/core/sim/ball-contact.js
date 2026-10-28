import { simulationPenaltyAreaContains } from './keeper-positioning.js';
import { simulationPlayerAvailable } from './duel-state.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall } from './ball-physics.js';
import { simulationRuntime } from './simulation-runtime.js';

const { max, min, sqrt } = Math;

export function captureSimulationPlayerPositions(simulation) {
  const runtime = simulationRuntime(simulation);
  runtime.players.forEach((player, index) => {
    runtime.previousPositions[index * 2] = player.position.x;
    runtime.previousPositions[index * 2 + 1] = player.position.y;
  });
}

export function earliestSimulationBallContact(simulation, motion) {
  const runtime = simulationRuntime(simulation);
  let earliest = null;
  runtime.players.forEach((player, index) => {
    if (!canTouchSimulationBall(simulation, player)) return;
    const previous = playerSegmentStart(runtime, index, motion);
    const fraction = simulationContactFraction(player, previous, motion);
    if (fraction === null) return;
    const candidate = { player, fraction, previous };
    if (contactPrecedes(simulation, candidate, earliest)) earliest = candidate;
  });
  return earliest;
}

function canTouchSimulationBall(simulation, player) {
  const ball = simulation.ball;
  if (!simulationPlayerAvailable(player)) return false;
  if (ball.heldBy != null) return false;
  if (keeperAwaitsShotContact(simulation, player)) return false;
  if (ball.restart && ball.restart.takerId !== player.id) return false;
  return ball.excludedId !== player.id || simulation.tick >= ball.controlAfterTick;
}

function contactPrecedes(simulation, candidate, earliest) {
  if (!earliest) return true;
  const difference = candidate.fraction - earliest.fraction;
  if (difference < -MATCH_SIM_DATA.clock.epsilon) return true;
  if (difference > MATCH_SIM_DATA.clock.epsilon) return false;
  const passingTeam = simulation.ball.flight?.teamId;
  // Equal-time contested contacts belong to the defender; a planned receiver gets no priority.
  return passingTeam != null && candidate.player.teamId !== passingTeam && earliest.player.teamId === passingTeam;
}

export function simulationContactFraction(player, previous, motion) {
  const offset = { x: motion.before.position.x - previous.x, y: motion.before.position.y - previous.y };
  const relative = { x: motion.after.position.x - motion.before.position.x - player.position.x + previous.x,
    y: motion.after.position.y - motion.before.position.y - player.position.y + previous.y };
  const interval = circleContactInterval(offset, relative);
  if (!interval) return null;
  const seconds = motion.seconds ?? MATCH_SIM_DATA.clock.stepSeconds;
  if (predictSimulationBall(motion.before, interval.start * seconds).height <= MATCH_SIM_DATA.ball.reachableHeight) return interval.start;
  const descending = reachableDescentSeconds(motion.before) / seconds;
  return descending >= interval.start && descending <= interval.end ? descending : null;
}

function circleContactInterval(offset, relative) {
  const squared = relative.x * relative.x + relative.y * relative.y;
  const radius = MATCH_SIM_DATA.ball.controlRadius;
  const distance = offset.x * offset.x + offset.y * offset.y - radius * radius;
  if (!squared) return distance <= 0 ? { start: 0, end: 1 } : null;
  const product = offset.x * relative.x + offset.y * relative.y;
  const discriminant = product * product - squared * distance;
  if (discriminant < 0) return null;
  const root = sqrt(discriminant);
  const start = max(0, (-product - root) / squared), end = min(1, (-product + root) / squared);
  return start <= end ? { start, end } : null;
}

function reachableDescentSeconds(ball) {
  const { gravity, reachableHeight } = MATCH_SIM_DATA.ball;
  const discriminant = ball.verticalVelocity ** 2 + 2 * gravity * (ball.height - reachableHeight);
  return discriminant >= 0 ? (ball.verticalVelocity + sqrt(discriminant)) / gravity : Infinity;
}

function keeperAwaitsShotContact(simulation, player) {
  const shot = simulation.ball.shot;
  if (!shot || shot.saved || shot.rebound || player.slot !== 'GK') return false;
  return simulationPenaltyAreaContains(simulation.teams.find(team => team.id === player.teamId), player.position);
}

function playerSegmentStart(runtime, index, motion) {
  const player = runtime.players[index];
  const elapsed = 1 - (motion.seconds ?? MATCH_SIM_DATA.clock.stepSeconds) / MATCH_SIM_DATA.clock.stepSeconds;
  const x = runtime.previousPositions[index * 2], y = runtime.previousPositions[index * 2 + 1];
  return { x: x + (player.position.x - x) * elapsed, y: y + (player.position.y - y) * elapsed };
}
