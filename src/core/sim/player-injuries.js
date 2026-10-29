import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { stopSimulationForFoul } from './foul-restart.js';
import { invalidateSimulationRuntime } from './simulation-runtime.js';
import { invalidateSimulationPlanning } from './off-ball-roles.js';

export function injureSimulationPlayer(simulation, incident) {
  const team = simulation.teams.find(candidate => candidate.players.some(player => player.id === incident.playerId));
  const player = team?.players.find(candidate => candidate.id === incident.playerId);
  if (!player || player.sentOff) throw new TypeError('An active player is required for an injury.');
  settleSimulationPass(simulation, { position: simulation.ball.position, controlled: false });
  team.players.splice(team.players.indexOf(player), 1);
  player.injured = true;
  player.leftSeconds = simulation.time;
  simulation.departed.push(player);
  invalidateSimulationRuntime(simulation);
  invalidateSimulationPlanning(team);
  stopSimulationForFoul(simulation, { teamId: team.id, restartPosition: { ...simulation.ball.position }, toPos: { ...player.position }, penaltyPending: false });
  Object.assign(simulation.referee.stoppage, { kind: 'injury', injuredPlayerId: player.id });
  simulation.match.restart = null;
  simulation.paused = true;
  emitSimulationEvent(simulation, { type: 'injury', tick: simulation.tick, teamId: team.id, fromId: player.id,
    fromPos: { ...player.position }, toPos: { ...player.position }, cause: incident.cause, success: true });
}
