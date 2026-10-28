import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance } from './geometry.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { endSimulationCarry } from './dribbling.js';
import { simulationPlayerAvailable } from './duel-state.js';
import { beginSimTransition } from './simulation-phases.js';

const { min } = Math;

export function resolveSimulationBallOut(simulation, before, timing) {
  const ball = simulation.ball, pitch = MATCH_SIM_DATA.pitch;
  if (ball.ownerId != null || (Math.abs(ball.position.x) <= pitch.length / 2 && Math.abs(ball.position.y) <= pitch.width / 2)) return;
  endSimulationCarry(simulation);
  const crossing = simulationBoundaryCrossing(before.position, ball.position);
  const team = simulation.teams.find(candidate => candidate.id !== ball.lastTouchTeamId);
  const time = timing.startTime + crossing.fraction * timing.seconds;
  settleSimulationPass(simulation, { position: crossing.position, controlled: false, time });
  // TEMPORARY until set pieces: every exit is an opponent restart at the crossed line, without throw/goal/corner distinctions.
  emitSimulationEvent(simulation, { type: 'ballOut', time, fromId: ball.lastTouchId, fromPos: { ...before.position }, toPos: crossing.position,
    success: false, temporaryRestart: true, restartTeamId: team.id });
  if (ball.teamId !== team.id) beginSimTransition(simulation, team.id);
  Object.assign(ball, { position: crossing.position, velocity: { x: 0, y: 0 }, height: 0, verticalVelocity: 0, teamId: team.id,
    ownerId: null, flight: null, excludedId: null, restart: { teamId: team.id, takerId: nearestRestartTaker(team, crossing.position).id } });
  simulation.passing.options = [];
}

function simulationBoundaryCrossing(start, end) {
  const pitch = MATCH_SIM_DATA.pitch;
  const horizontal = crossingFraction(start.x, end.x, pitch.length / 2);
  const vertical = crossingFraction(start.y, end.y, pitch.width / 2);
  const fraction = min(horizontal, vertical);
  return { fraction, position: { x: clampSimValue(start.x + (end.x - start.x) * fraction, -pitch.length / 2, pitch.length / 2),
    y: clampSimValue(start.y + (end.y - start.y) * fraction, -pitch.width / 2, pitch.width / 2) } };
}

export function simulationBallExitFraction(motion) {
  const pitch = MATCH_SIM_DATA.pitch;
  return min(crossingFraction(motion.before.position.x, motion.after.position.x, pitch.length / 2),
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
