import MATCH_SIM_DATA from '../../data/match-sim.json';
import { validateSimulationTactics } from './tactic-settings.js';
import { emitSimulationEvent } from './ball-events.js';
import { invalidateSimulationPlanning } from './off-ball-roles.js';
import { invalidateSimulationRuntime } from './simulation-runtime.js';

export function commandSimulationTactics(simulation, command) {
  const team = simulation.teams.find(candidate => candidate.id === command.teamId);
  if (!team) throw new TypeError('Unknown tactic team.');
  const tactics = { ...team.tactics, ...command.tactics };
  validateSimulationTactics(tactics);
  if (command.formation && !MATCH_SIM_DATA.formations[command.formation]) throw new TypeError('Unknown formation.');
  if (command.formation) applyTeamFormation(team, command.formation);
  team.tactics = tactics;
  for (const player of team.players) player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  invalidateSimulationPlanning(team);
  invalidateSimulationRuntime(simulation);
  emitSimulationEvent(simulation, { type: 'tactics', tick: simulation.tick, teamId: team.id, tactics: { ...tactics }, formation: team.formation, success: true });
}

function applyTeamFormation(team, formation) {
  const anchors = MATCH_SIM_DATA.formations[formation];
  const previous = MATCH_SIM_DATA.formations[team.formation];
  team.formation = formation;
  team.players.forEach(player => {
    const anchor = anchors[previous.findIndex(slot => slot.slot === player.slot)];
    Object.assign(player, { slot: anchor.slot, line: anchor.line, anchor: { x: anchor.x, y: anchor.y } });
  });
}

export function commandSimulationInstruction(simulation, command) {
  const team = simulation.teams.find(candidate => candidate.id === command.teamId);
  const player = team?.players.find(candidate => candidate.id === command.playerId && !candidate.sentOff);
  const instruction = MATCH_SIM_DATA.instructions[command.key];
  if (!player || !instruction) throw new TypeError('Unknown instruction or player.');
  player.instruction = command.key;
  emitSimulationEvent(simulation, { type: 'instruction', tick: simulation.tick, teamId: team.id, fromId: player.id,
    key: command.key, effective: instruction.effective, success: true });
}

export function commandSimulationMotivation(simulation, command) {
  if (!simulation.teams.some(team => team.id === command.teamId)) throw new TypeError('Unknown motivation team.');
  emitSimulationEvent(simulation, { type: 'motivation', tick: simulation.tick, teamId: command.teamId, kind: command.kind, effective: false, success: true });
}
