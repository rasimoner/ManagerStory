import RESTART_DATA from '../../data/match-sim-restarts.json';
import { pointDistance } from './geometry.js';

export function arrangeSimulationCross(simulation, restart, targets) {
  if (restart.delivery?.kind !== 'cross') return;
  const attack = simulation.teams.find(team => team.id === restart.teamId), defence = simulation.teams.find(team => team.id !== restart.teamId);
  const runners = attack.players.filter(player => player.slot !== 'GK' && player.id !== restart.takerId && !player.sentOff);
  runners.sort((a, b) => Number(b.id === restart.receiverId) - Number(a.id === restart.receiverId)
    || pointDistance(a.position, restart.delivery.target) - pointDistance(b.position, restart.delivery.target));
  const markers = defence.players.filter(player => player.slot !== 'GK' && !player.sentOff);
  for (const [index, spot] of RESTART_DATA.delivery.runnerPositions.entries()) {
    const runner = runners[index];
    if (!runner) break;
    targets[runner.id] = { x: spot.x * attack.direction, y: spot.y };
    const marker = markers.sort((a, b) => pointDistance(a.position, targets[runner.id]) - pointDistance(b.position, targets[runner.id])).shift();
    if (marker) targets[marker.id] = { x: targets[runner.id].x + attack.direction * RESTART_DATA.delivery.markingDistance, y: spot.y };
  }
  const keeper = defence.players.find(player => player.slot === 'GK');
  if (keeper) targets[keeper.id] = { x: -defence.direction * (RESTART_DATA.delivery.goalX - RESTART_DATA.delivery.keeperDepth), y: 0 };
}
