import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointSquaredDistance } from './geometry.js';

export function simulationBoxDepth(simulation, team) {
  if (!simulation.liveBall || simulation.ball.teamId === team.id) return 0;
  const distance = MATCH_SIM_DATA.pitch.length / 2 + simulation.ball.position.x * team.direction;
  const settings = MATCH_SIM_DATA.boxDefending;
  return clampSimValue((settings.triggerDistance - distance) / settings.blendDistance, 0, 1);
}

export function simulationBoxShape(settings, depth) {
  const box = MATCH_SIM_DATA.boxDefending;
  const blend = field => settings[field] + (box[field] - settings[field]) * depth;
  return { ...settings, length: blend('length'), width: blend('width'), envelopeLength: blend('envelopeLength'), envelopeWidth: blend('envelopeWidth') };
}

export function planSimulationBoxDefence(context, assignRole) {
  const { simulation, team } = context;
  if (!simulationBoxDepth(simulation, team)) return false;
  const settings = MATCH_SIM_DATA.boxDefending;
  const goalX = -team.direction * MATCH_SIM_DATA.pitch.length / 2;
  const opponents = simulation.teams.find(candidate => candidate.id !== team.id).players;
  const threats = opponents.filter(player => boxReceiver(player, simulation, goalX)).sort((a, b) => boxReceiverDistance(a, simulation, goalX) - boxReceiverDistance(b, simulation, goalX));
  for (const receiver of threats.slice(0, settings.markCount)) markBoxReceiver(context, { receiver, assignRole, goalX });
  const rebound = { x: goalX + team.direction * settings.reboundDepth, y: simulation.ball.position.y * settings.reboundSideFactor };
  assignRole(context, nearestAvailable(context.available, rebound), { role: 'rebound', target: rebound });
  return true;
}

function boxReceiver(player, simulation, goalX) {
  return player.slot !== 'GK' && !player.sentOff && player.id !== simulation.ball.ownerId && player.id !== simulation.ball.carry?.playerId
    && boxReceiverDistance(player, simulation, goalX) <= MATCH_SIM_DATA.boxDefending.receiverDistance;
}

function boxReceiverDistance(player, simulation, goalX) {
  const depth = Math.abs(goalX - player.position.x);
  return simulation.ball.flight?.cross ? Math.hypot(depth, player.position.y) : depth;
}

function markBoxReceiver(context, { receiver, assignRole, goalX }) {
  const candidates = context.available.filter(player => player.line === 'defence');
  const defender = nearestAvailable(candidates.length ? candidates : context.available, receiver.position);
  if (!defender) return;
  const settings = MATCH_SIM_DATA.boxDefending;
  const gap = settings.markDistance + (1 - defender.attributes.positioning / MATCH_SIM_DATA.attributes.maximum) * settings.markSkillDistance;
  const target = { x: receiver.position.x - context.team.direction * gap, y: receiver.position.y };
  target.x = context.team.direction > 0 ? Math.max(goalX + settings.goalMargin, target.x) : Math.min(goalX - settings.goalMargin, target.x);
  assignRole(context, defender, { role: 'mark', target, laneTargetId: receiver.id });
}

function nearestAvailable(players, point) {
  let nearest, minimum = Infinity;
  for (const player of players) {
    const distance = pointSquaredDistance(player.position, point);
    if (distance < minimum) { minimum = distance; nearest = player; }
  }
  return nearest;
}
