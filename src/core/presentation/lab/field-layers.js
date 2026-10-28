import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { measureTeam } from '../../sim/team-measurements.js';
import { simAnchorPosition, simTeamShape } from '../../sim/team-shape.js';
import { toLabFieldPoint } from './field-markings.js';

export function labTeamShapeMarkup(simulation, team, color) {
  const box = measureTeam(simulation, team.id);
  const top = toLabFieldPoint({ x: box.maxX, y: box.minY });
  const lines = ['defence', 'midfield', 'attack'].map(line => team.players.filter(player => player.line === line).sort((left, right) => left.position.y - right.position.y));
  const paths = lines.map(players => `<polyline points="${players.map(player => { const point = toLabFieldPoint(player.position); return `${point.x},${point.y}`; }).join(' ')}"/>`).join('');
  return `<g data-overlay="shape" stroke="${color}" stroke-width=".18" fill="none" opacity=".45"><rect x="${top.x}" y="${top.y}" width="${box.width}" height="${box.length}" stroke-dasharray="1 .8"/>${paths}</g><text x="${top.x + .5}" y="${top.y - 1}" fill="${color}" font-size="1.8" opacity=".8">${box.length.toFixed(1)} × ${box.width.toFixed(1)} m</text>`;
}

export function labVelocityMarkup(player) {
  const start = toLabFieldPoint(player.position);
  const seconds = MATCH_SIM_DATA.lab.vectorSeconds;
  const end = toLabFieldPoint({ x: player.position.x + player.velocity.x * seconds, y: player.position.y + player.velocity.y * seconds });
  return `<path data-overlay="velocity" d="M${start.x},${start.y} L${end.x},${end.y}" stroke="#c8e4d7" stroke-width=".24" opacity=".6" marker-end="url(#velocity-arrow)"/>`;
}

export function labAnchorsMarkup(simulation, team, color) {
  const shape = simTeamShape(simulation, team);
  return `<g data-overlay="anchors" stroke="${color}" stroke-width=".2" opacity=".6">${team.players.filter(player => player.slot !== 'GK').map(player => {
    const point = toLabFieldPoint(simAnchorPosition(team, player, shape));
    return `<path d="M${point.x - .7},${point.y} h1.4 M${point.x},${point.y - .7} v1.4"/>`;
  }).join('')}</g>`;
}

export function labCoverLaneMarkup(simulation, team) {
  const cover = team.players.find(player => player.role === 'cover');
  const receiver = simulation.teams.flatMap(candidate => candidate.players).find(player => player.id === cover?.laneTargetId);
  if (!cover || !receiver) return '';
  const start = toLabFieldPoint(simulation.ball.position), end = toLabFieldPoint(receiver.position), target = toLabFieldPoint(cover.target);
  return `<g data-overlay="cover" stroke="#d9f0dd" opacity=".4" fill="none" stroke-width=".2"><path d="M${start.x},${start.y} L${end.x},${end.y}" stroke-dasharray=".7 .7"/><circle cx="${target.x}" cy="${target.y}" r="1"/></g>`;
}
