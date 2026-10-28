import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance } from './geometry.js';
import { simulationPlayerAvailable } from './duel-state.js';

export function temporaryGoalLineRestart(simulation, crossing) {
  const ball = simulation.ball, pitch = MATCH_SIM_DATA.pitch;
  if (Math.abs(crossing.position.x) < pitch.length / 2 - MATCH_SIM_DATA.clock.epsilon) return null;
  const direction = Math.sign(crossing.position.x);
  const defending = simulation.teams.find(team => team.direction === -direction);
  const attacking = simulation.teams.find(team => team.id !== defending.id);
  // TEMPORARY until task 7: an attacking last touch becomes a keeper hand restart; a defensive touch a short corner.
  if (ball.lastTouchTeamId !== defending.id) {
    const keeper = defending.players.find(player => player.slot === 'GK' && simulationPlayerAvailable(player));
    const position = { x: direction * (pitch.length / 2 - pitch.goalAreaDepth), y: clampSimValue(crossing.position.y, -pitch.goalAreaWidth / 2, pitch.goalAreaWidth / 2) };
    return { team: defending, position, taker: keeper ?? nearestGoalLineTaker(defending, position), kind: 'keeper' };
  }
  const position = { x: direction * pitch.length / 2, y: Math.sign(crossing.position.y || 1) * pitch.width / 2 };
  return { team: attacking, position, taker: nearestGoalLineTaker(attacking, position), kind: 'corner' };
}

function nearestGoalLineTaker(team, position) {
  return team.players.filter(player => player.slot !== 'GK' && simulationPlayerAvailable(player))
    .reduce((best, player) => !best || pointDistance(player.position, position) < pointDistance(best.position, position) ? player : best, null);
}

export function prepareTemporaryCornerPass(simulation, player, restart) {
  if (restart?.kind !== 'corner') return;
  const team = simulation.teams.find(candidate => candidate.id === player.teamId);
  const receiver = team.players.filter(candidate => candidate.id !== player.id && candidate.slot !== 'GK' && simulationPlayerAvailable(candidate))
    .reduce((best, candidate) => !best || pointDistance(candidate.position, player.position) < pointDistance(best.position, player.position) ? candidate : best, null);
  if (receiver) simulation.passing.requested = { toId: receiver.id, lofted: false, target: temporaryCornerTarget(simulation.ball.position, receiver.position) };
}

function temporaryCornerTarget(start, receiver) {
  const fraction = Math.min(1, MATCH_SIM_DATA.match.cornerPassDistance / Math.max(MATCH_SIM_DATA.clock.epsilon, pointDistance(start, receiver)));
  return { x: start.x + (receiver.x - start.x) * fraction, y: start.y + (receiver.y - start.y) * fraction };
}
