import { pointDistance } from './geometry.js';

export function measureTeam(simulation, teamId) {
  const team = simulation.teams.find(candidate => candidate.id === teamId);
  if (!team) throw new TypeError('Measurement team does not exist.');
  const players = team.players.filter(player => player.slot !== 'GK');
  const longitudinal = players.map(player => player.position.x);
  const lateral = players.map(player => player.position.y);
  const bounds = { minX: Math.min(...longitudinal), maxX: Math.max(...longitudinal), minY: Math.min(...lateral), maxY: Math.max(...lateral) };
  const presser = players.find(player => player.role === 'press');
  return {
    ...bounds, length: bounds.maxX - bounds.minX, width: bounds.maxY - bounds.minY,
    center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    presserId: presser?.id ?? null, pressDistance: presser ? pointDistance(presser.position, simulation.ball.position) : null,
    pressReactionSeconds: team.pressReactionSeconds, phase: team.phase,
  };
}
