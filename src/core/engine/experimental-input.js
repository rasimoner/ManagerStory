import { M, S } from '../state.js';
import { createCareerSimulation, careerSimulationPlayer } from '../match/career-input.js';
import { opponentPlayer } from '../league/opponents-v731.js';
import { oppRadarPos } from './match-minute.js';
import { matchSeed, orderKey } from './match-support.js';
import { commandSimulationInstruction } from '../sim/team-commands.js';
import { userSquad } from './user-team.js';
import { createSimulationPlayback } from '../match/continuous-playback.js';

export function initializeExperimentalMatch() {
  const own = userSquad().filter(player => M.active.includes(player.id)).map(player => ({ ...player, role: M.matchRoles[player.id], lineupPosition: M.matchPositions[player.id] }));
  const opponent = M.oppIds.map((id, index) => ({ ...opponentPlayer(id), id, number: opponentPlayer(id).number ?? index + 1,
    role: opponentPlayer(id).position, lineupPosition: oppositeLineupPosition(id) }));
  M.experimental = true;
  M.fieldView = '2d';
  M.simulationCursor = 0;
  M.simulationNames = Object.fromEntries([...own, ...opponent].map(player => [player.id, player.name]));
  M.simulationTeams = Object.fromEntries([...own.map(player => [player.id, 'user']), ...opponent.map(player => [player.id, 'opponent'])]);
  M.simulation = createCareerSimulation({ seed: matchSeed(), userHome: M.userHome, user: { players: own, tactics: M }, opponent: { players: opponent } });
  for (const player of own) commandSimulationInstruction(M.simulation, { teamId: 'user', playerId: player.id, key: orderKey(player) });
  M.simulationPlayback = createSimulationPlayback(M.simulation);
}

function oppositeLineupPosition(id) {
  const point = oppRadarPos(Number(id.slice(1)));
  return [point[0], 100 - point[1]];
}

export function prepareExperimentalSubstitute(player, teamId) {
  M.simulationNames[player.id] = player.name;
  M.simulationTeams[player.id] = teamId;
  return careerSimulationPlayer(player);
}

export function experimentalSourcePlayer(id) {
  return typeof id === 'number' ? userSquad().find(player => player.id === id) : opponentPlayer(id);
}

export function experimentalOpponentBench() {
  const squad = S.opponentSquads[M.userHome ? M.away : M.home];
  const used = new Set(Object.values(M.oppLineup));
  return squad.map((player, index) => ({ ...player, number: player.number ?? index + 1 }))
    .filter(player => !used.has(player.id) && !(player.injury > 0));
}
