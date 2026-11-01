import { emitSimulationEvent } from './ball-events.js';
import { endSimulationCarry } from './dribbling.js';
import { beginSimTransition } from './simulation-phases.js';
import { pointDistance } from './geometry.js';
import { simulationPlayerAvailable } from './duel-state.js';
import RESTART_DATA from '../../data/match-sim-restarts.json';

export function usesPositionedSimulationRestarts(simulation) { return simulation.clock.pauseHalfPreparation; }

export function nearestSimulationRestartPlayer(players, position) {
  return players.filter(simulationPlayerAvailable).reduce((best, player) => !best || pointDistance(player.position, position) < pointDistance(best.position, position) ? player : best, null);
}

export function beginSimulationRestart(simulation, input) {
  if (input.kind === 'corner') input = { ...input, position: insetCornerPosition(input.position) };
  const team = simulation.teams.find(team => team.id === input.teamId), ball = simulation.ball;
  const taker = input.taker ?? nearestSimulationRestartPlayer(team.players.filter(player => player.slot !== 'GK'), input.position);
  const receiver = nearestSimulationRestartPlayer(team.players.filter(player => player.id !== taker.id && player.slot !== 'GK'), input.position)
    ?? team.players.find(player => player.id !== taker.id && !player.sentOff);
  endSimulationCarry(simulation);
  if (ball.teamId !== team.id) beginSimTransition(simulation, team.id);
  const restart = { kind: input.kind, teamId: team.id, takerId: taker.id, receiverId: receiver?.id ?? taker.id,
    position: { ...input.position }, sinceTick: simulation.tick, stage: 'positioning', targets: null, indirect: !!input.indirect };
  simulation.offside = null;
  Object.assign(ball, { position: { ...input.position }, velocity: { x: 0, y: 0 }, height: 0, verticalVelocity: 0,
    ownerId: null, heldBy: null, shot: null, flight: null, assist: null, carry: null, control: null,
    backpassTeamId: null, excludedId: null, teamId: team.id, restart });
  simulation.ownerDecision.selected = null;
  simulation.passing = { options: [], selected: null, requested: null, nextEvaluationTick: simulation.tick };
  for (const team of simulation.teams) for (const player of team.players) player.duel.tackle = null;
  emitSimulationEvent(simulation, { type: 'restartPosition', fromId: taker.id, teamId: team.id, kind: input.kind,
    fromPos: { ...input.position }, toPos: { ...input.position }, success: true });
}

function insetCornerPosition(position) {
  const inset = RESTART_DATA.delivery.cornerInset;
  return { x: position.x - Math.sign(position.x) * inset, y: position.y - Math.sign(position.y) * inset };
}
