import { pointDistance } from './geometry.js';

export function createSimulationStatistics(teams) {
  return { possessionTeamId: null, teams: Object.fromEntries(teams.map(team => [team.id, { passes: 0, completedPasses: 0, resolvedPasses: 0, passDistance: 0,
    interceptions: 0, possessions: 0, possessionSeconds: 0, controlSeconds: 0, controls: 0 }])) };
}

export function emitSimulationEvent(simulation, event) {
  const entry = { time: simulation.time, fromId: null, toId: null, fromPos: null, toPos: null, success: null, ...event };
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
  pass.actualToPos = { ...result.position };
  pass.distance = pointDistance(pass.fromPos, result.position);
  stats.resolvedPasses++;
  stats.passDistance += pass.distance;
  if (pass.success) stats.completedPasses++;
}

export function readSimulationStatistics(simulation) {
  const teams = Object.entries(simulation.statistics.teams).map(([id, stats]) => ({ id, ...stats }));
  const sum = field => teams.reduce((total, team) => total + team[field], 0);
  const totalPossession = sum('possessionSeconds');
  for (const team of teams) team.possessionPercent = totalPossession ? team.possessionSeconds / totalPossession * 100 : 0;
  const passes = sum('passes'), resolved = sum('resolvedPasses'), controls = sum('controls');
  return { passes, completedPasses: sum('completedPasses'), accuracy: resolved ? sum('completedPasses') / resolved * 100 : 0,
    averageDistance: resolved ? sum('passDistance') / resolved : 0, passesPerMinute: simulation.time ? passes / (simulation.time / 60) : 0,
    interceptions: sum('interceptions'), averageHoldSeconds: controls ? sum('controlSeconds') / controls : 0,
    averagePossessionSeconds: sum('possessions') ? totalPossession / sum('possessions') : 0, teams };
}
