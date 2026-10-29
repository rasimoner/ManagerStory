import MATCH_SIM_DATA from '../../data/match-sim.json';
import { createSimulationPlayer } from './simulation-state.js';
import { validateSimulationReplacement } from './validation.js';
import { emitSimulationEvent } from './ball-events.js';
import { invalidateSimulationRuntime } from './simulation-runtime.js';
import { invalidateSimulationPlanning } from './off-ball-roles.js';

export function requestSimulationSubstitution(simulation, command) {
  const team = simulation.teams.find(candidate => candidate.id === command.teamId);
  const outgoing = findOutgoingPlayer(simulation, command);
  if (!team || !outgoing) throw new TypeError('Unknown substitution team or player.');
  validateSubstitution(simulation, { team, outgoing, command });
  const pending = { ...structuredClone(command), slot: command.slot ?? outgoing.slot, requestedTick: simulation.tick };
  simulation.commands.substitutions.push(pending);
  emitSimulationEvent(simulation, { type: 'substitutionRequested', tick: simulation.tick, teamId: team.id, fromId: outgoing.id, toId: command.player.id, success: true });
}

function findOutgoingPlayer(simulation, command) {
  return [...simulation.teams.flatMap(team => team.players), ...simulation.departed]
    .find(player => player.id === command.outId && player.teamId === command.teamId && !player.replaced);
}

function validateSubstitution(simulation, { team, outgoing, command }) {
  if (outgoing.sentOff) throw new TypeError('A sent-off player cannot be substituted.');
  validateSimulationReplacement(command.player);
  const players = [...simulation.teams.flatMap(candidate => candidate.players), ...simulation.departed];
  if (players.some(player => player.id === command.player.id)) throw new TypeError('A substitute must be a new player.');
  if (simulation.commands.substitutions.some(pending => pending.outId === outgoing.id || pending.player.id === command.player.id)) throw new TypeError('Substitution already pending.');
  const slot = command.slot ?? outgoing.slot;
  if (!MATCH_SIM_DATA.formations[team.formation].some(anchor => anchor.slot === slot)) throw new TypeError('Unknown substitution slot.');
  if (team.players.some(player => player.id !== outgoing.id && player.slot === slot)) throw new TypeError('Substitution slot is occupied.');
}

export function applySimulationCommands(simulation) {
  if (!simulationFootballStopped(simulation)) return;
  const pending = simulation.commands.substitutions.splice(0);
  for (const command of pending) applySubstitution(simulation, command);
}

export function simulationFootballStopped(simulation) {
  return simulation.match.phase !== 'playing' || !!simulation.referee.stoppage || !!simulation.ball.restart;
}

function applySubstitution(simulation, command) {
  const team = simulation.teams.find(candidate => candidate.id === command.teamId);
  const outgoing = findOutgoingPlayer(simulation, command);
  if (outgoing.sentOff) { emitSimulationEvent(simulation, { type: 'substitutionCancelled', fromId: outgoing.id, success: false }); return; }
  const incoming = createSimulationPlayer({ ...command.player, teamId: team.id, slot: command.slot }, MATCH_SIM_DATA.formations[team.formation]);
  copySubstitutionSlot(incoming, outgoing);
  replaceTeamPlayer(simulation, { team, outgoing, incoming });
  invalidateSimulationRuntime(simulation);
  invalidateSimulationPlanning(team);
  repairSubstitutionRestart(simulation, { outgoing, incoming });
  emitSimulationEvent(simulation, { type: 'substitution', tick: simulation.tick, teamId: team.id, fromId: outgoing.id, toId: incoming.id, slot: incoming.slot, success: true });
}

function copySubstitutionSlot(incoming, outgoing) {
  incoming.position = { ...outgoing.position };
  incoming.target = { ...outgoing.position };
  incoming.heading = outgoing.heading;
  if (incoming.slot === outgoing.slot) { incoming.anchor = { ...outgoing.anchor }; incoming.line = outgoing.line; }
}

function replaceTeamPlayer(simulation, { team, outgoing, incoming }) {
  const index = team.players.indexOf(outgoing);
  outgoing.replaced = true;
  if (index >= 0) { team.players.splice(index, 1, incoming); simulation.departed.push(outgoing); }
  else team.players.push(incoming);
}

function repairSubstitutionRestart(simulation, { outgoing, incoming }) {
  if (simulation.match.restart) simulation.match.restart = null;
  for (const restart of [simulation.ball.restart, simulation.referee.stoppage]) {
    if (restart?.takerId === outgoing.id) restart.takerId = incoming.id;
  }
}
