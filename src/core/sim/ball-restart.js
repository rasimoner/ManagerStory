import { temporaryGoalLineRestart } from './goal-line-restart.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance } from './geometry.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { endSimulationCarry } from './dribbling.js';
import { simulationPlayerAvailable } from './duel-state.js';
import { beginSimTransition } from './simulation-phases.js';
import { beginSimulationRestart, usesPositionedSimulationRestarts } from './restart-state.js';

const { min } = Math;

export function resolveSimulationBallOut(simulation, before, timing) {
  const ball = simulation.ball, pitch = MATCH_SIM_DATA.pitch;
  if (ball.ownerId != null || (Math.abs(ball.position.x) <= pitch.length / 2 + (ball.shot ? MATCH_SIM_DATA.ball.radius : 0) && Math.abs(ball.position.y) <= pitch.width / 2)) return;
  endSimulationCarry(simulation);
  const crossing = simulationBoundaryCrossing(before.position, ball.position, ball.shot != null);
  const goalLine = temporaryGoalLineRestart(simulation, crossing);
  const team = goalLine?.team ?? simulation.teams.find(candidate => candidate.id !== ball.lastTouchTeamId);
  const time = timing.startTime + crossing.fraction * timing.seconds;
  settleSimulationPass(simulation, { position: crossing.position, controlled: false, time });
  // TEMPORARY until task 7: touchlines use an opponent short restart; goal lines distinguish keeper and corner.
  emitSimulationEvent(simulation, { type: 'ballOut', time, fromId: ball.lastTouchId, fromPos: { ...before.position }, toPos: crossing.position,
    success: false, temporaryRestart: !usesPositionedSimulationRestarts(simulation), restartTeamId: team.id });
  placeSimulationRestart(simulation, { team, goalLine, crossing });
}

function placeSimulationRestart(simulation, input) {
  if (!usesPositionedSimulationRestarts(simulation)) { placeTemporaryRestart(simulation, input); return; }
  const { team, goalLine, crossing } = input;
  beginSimulationRestart(simulation, { teamId: team.id, position: goalLine?.position ?? crossing.position,
    taker: goalLine?.taker ?? nearestRestartTaker(team, crossing.position), kind: goalLine?.kind ?? 'throwIn' });
}

function placeTemporaryRestart(simulation, { team, goalLine, crossing }) {
  const ball = simulation.ball;
  if (ball.teamId !== team.id) beginSimTransition(simulation, team.id);
  const position = goalLine?.position ?? crossing.position;
  const taker = goalLine?.taker ?? nearestRestartTaker(team, crossing.position);
  Object.assign(ball, { position, velocity: { x: 0, y: 0 }, height: 0, verticalVelocity: 0, teamId: team.id,
    ownerId: null, heldBy: null, shot: null, assist: null, backpassTeamId: null, flight: null, excludedId: null,
    restart: { teamId: team.id, kind: goalLine?.kind ?? 'touchline', takerId: taker.id } });
  simulation.passing.options = [];
}

function simulationBoundaryCrossing(start, end, shot) {
  const pitch = MATCH_SIM_DATA.pitch;
  const horizontal = crossingFraction(start.x, end.x, pitch.length / 2 + (shot ? MATCH_SIM_DATA.ball.radius : 0));
  const vertical = crossingFraction(start.y, end.y, pitch.width / 2);
  const fraction = min(horizontal, vertical);
  // Keep the crossed axis: a clamped touchline point can sit on the goal line at a corner.
  return { fraction, goalLine: horizontal <= vertical, position: { x: clampSimValue(start.x + (end.x - start.x) * fraction, -pitch.length / 2, pitch.length / 2),
    y: clampSimValue(start.y + (end.y - start.y) * fraction, -pitch.width / 2, pitch.width / 2) } };
}

export function simulationBallExitFraction(motion) {
  const pitch = MATCH_SIM_DATA.pitch;
  return min(crossingFraction(motion.before.position.x, motion.after.position.x, pitch.length / 2 + (motion.shot ? MATCH_SIM_DATA.ball.radius : 0)),
    crossingFraction(motion.before.position.y, motion.after.position.y, pitch.width / 2));
}

function crossingFraction(start, end, boundary) {
  if (end > boundary) return (boundary - start) / (end - start);
  if (end < -boundary) return (-boundary - start) / (end - start);
  return Infinity;
}

function nearestRestartTaker(team, position) {
  let nearest = team.players[0], minimum = Infinity;
  for (const player of team.players.filter(simulationPlayerAvailable)) {
    const distance = pointDistance(player.position, position);
    if (distance < minimum) { nearest = player; minimum = distance; }
  }
  return nearest;
}
