import { M } from '../state.js';
import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import { simulationPlayerRatings } from '../match/career-ratings.js';
import { minutePlayed } from '../hooks.js';
import { matchEvent, userSide } from './match-support.js';
import { experimentalSourcePlayer } from './experimental-input.js';

export function synchronizeExperimentalPlayers() {
  const simulation = M.simulation;
  const ratings = simulationPlayerRatings(simulation);
  const players = [...simulation.teams.flatMap(team => team.players), ...simulation.departed];
  for (const player of players) synchronizeExperimentalPlayer(player, ratings[player.id]);
}

function synchronizeExperimentalPlayer(player, row) {
  const source = experimentalSourcePlayer(player.id);
  if (!source) return;
  source.fitness = player.attributes.fitness;
  if (player.teamId !== 'user') return;
  const previousMinutes = M.playerStats[player.id]?.minutes ?? 0;
  for (let minute = previousMinutes; minute < row.minutes; minute++) minutePlayed(source);
  M.playerStats[player.id] = row;
  if (row.minutes > 0 && !source.debutDone && !M.debutShown.includes(source.id)) recordExperimentalDebut(source);
}

function recordExperimentalDebut(player) {
  M.debutShown.push(player.id);
  matchEvent('debut', `${M.min}' ${player.name} profesyonel futboldaki ilk maçında.`, { simulationEvent: true, playerId: player.id, side: userSide() });
}

export function synchronizeExperimentalTeamStats() {
  for (const team of M.simulation.teams) {
    const side = team.id === 'user' ? userSide() : 1 - userSide();
    const stats = M.simulation.statistics.teams[team.id];
    M.shots[side] = stats.shots;
    M.ont[side] = stats.shotsOnTarget;
    copyExperimentalTeamStats(stats, side);
    if (team.id === 'user') M.userPossTicks = stats.possessionSeconds;
    else M.oppPossTicks = stats.possessionSeconds;
  }
}

function copyExperimentalTeamStats(stats, side) {
  const fields = { xg: 'xg', fouls: 'fouls', passes: 'passes', completedPasses: 'completedPasses', yellow: 'yellow', red: 'red', possessionsWon: 'ballWins', tackles: 'tacklesWon' };
  for (const [target, source] of Object.entries(fields)) M.stats[target][side] = stats[source];
  const teamId = side === userSide() ? 'user' : 'opponent';
  M.stats.bigChances[side] = M.simulation.events.filter(event => event.type === 'shot' && event.teamId === teamId && event.xg >= CAREER_SIM_DATA.bigChanceXg).length;
  M.stats.temporaryStoppages ??= [0, 0];
  M.stats.temporaryStoppages[side] = M.simulation.events.filter(event => event.type === 'ballOut' && event.restartTeamId === teamId).length;
}
