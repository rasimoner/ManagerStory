import { pointDistance } from './geometry.js';
import { simulationMatchSeconds, usesNaturalMatchClock } from './simulation-clock.js';

export function createSimulationStatistics(teams) {
  return { possessionTeamId: null, teams: Object.fromEntries(teams.map(team => [team.id, { passes: 0, completedPasses: 0, resolvedPasses: 0, passDistance: 0,
    dribbles: 0, dribbleDistance: 0, beats: 0, tackles: 0, tacklesWon: 0, tacklesLoose: 0, tacklesMissed: 0, duels: 0, fouls: 0, yellow: 0, red: 0, advantages: 0, ballWins: 0,
    shots: 0, shotsOnTarget: 0, goals: 0, xg: 0, blocks: 0, saves: 0, posts: 0, interceptions: 0, possessions: 0, possessionSeconds: 0, controlSeconds: 0, controls: 0 }])) };
}

export function emitSimulationEvent(simulation, event) {
  const entry = { tick: simulation.tick, time: simulation.time, fromId: null, toId: null, fromPos: null, toPos: null, success: null, ...event };
  entry.physicsTime = entry.time;
  entry.matchTime = simulationMatchSeconds(simulation, entry.time);
  simulation.events.push(entry);
  return simulation.events.length - 1;
}

export function settleSimulationPass(simulation, result) {
  const flight = simulation.ball.flight;
  if (!flight) return;
  const pass = simulation.events[flight.eventIndex];
  const stats = simulation.statistics.teams[flight.teamId];
  pass.success = result.controlled && result.teamId === flight.teamId;
  pass.actualToId = result.playerId ?? null;
  pass.resolvedAt = result.time ?? simulation.time;
  pass.resolvedMatchTime = simulationMatchSeconds(simulation, pass.resolvedAt);
  pass.actualToPos = { ...result.position };
  pass.distance = pointDistance(pass.fromPos, result.position);
  if (flight.crossEventIndex != null) Object.assign(simulation.events[flight.crossEventIndex], {
    success: pass.success, actualToId: pass.actualToId, actualToPos: { ...result.position }, resolvedAt: pass.resolvedAt });
  stats.resolvedPasses++;
  stats.passDistance += pass.distance;
  if (pass.success) {
    stats.completedPasses++;
    simulation.ball.assist = { fromId: flight.fromId, toId: result.playerId, teamId: flight.teamId };
  } else simulation.ball.assist = null;
}

export function readSimulationStatistics(simulation) {
  const teams = Object.entries(simulation.statistics.teams).map(([id, stats]) => ({ id, ...stats }));
  const sum = field => teams.reduce((total, team) => total + team[field], 0);
  const totalPossession = sum('possessionSeconds');
  for (const team of teams) team.possessionPercent = totalPossession ? team.possessionSeconds / totalPossession * 100 : 0;
  const passes = sum('passes'), resolved = sum('resolvedPasses'), controls = sum('controls');
  return { passes, completedPasses: sum('completedPasses'), accuracy: resolved ? sum('completedPasses') / resolved * 100 : 0,
    averageDistance: resolved ? sum('passDistance') / resolved : 0, passesPerMinute: simulation.matchTime ? passes / (simulation.matchTime / 60) : 0,
    ...(usesNaturalMatchClock(simulation) ? { passesPerPhysicsMinute: simulation.time ? passes / (simulation.time / 60) : 0 } : {}),
    ...Object.fromEntries(['shots', 'shotsOnTarget', 'goals', 'xg', 'blocks', 'saves', 'posts', 'dribbles', 'dribbleDistance', 'beats', 'tackles', 'tacklesWon', 'tacklesLoose', 'tacklesMissed', 'duels', 'fouls', 'yellow', 'red', 'advantages', 'ballWins'].map(field => [field, sum(field)])),
    duels: sum('duels') / 2, interceptions: sum('interceptions'), averageHoldSeconds: controls ? sum('controlSeconds') / controls : 0,
    averagePossessionSeconds: sum('possessions') ? totalPossession / sum('possessions') : 0, teams };
}
