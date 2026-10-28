import MATCH_SIM_DATA from '../../data/match-sim.json';
import { pointDistance, subtractPoints } from './geometry.js';

export function dangerousSimReceiver(simulation, team) {
  const goal = { x: -MATCH_SIM_DATA.pitch.length / 2 * team.direction, y: 0 };
  const opponents = simulation.teams.find(candidate => candidate.id !== team.id).players;
  return opponents.filter(player => player.slot !== 'GK' && (player.position.x - simulation.ball.position.x) * team.direction < 0)
    .sort((left, right) => pointDistance(left.position, goal) - pointDistance(right.position, goal))[0] ?? null;
}

export function simCoverTarget(simulation, team, receiver) {
  const ball = simulation.ball.position;
  const end = receiver?.position ?? { x: -MATCH_SIM_DATA.pitch.length / 2 * team.direction, y: 0 };
  const distance = pointDistance(ball, end);
  const fraction = distance ? Math.min(MATCH_SIM_DATA.roles.coverDistance / distance, MATCH_SIM_DATA.roles.coverLaneFraction) : 0;
  const offset = subtractPoints(end, ball);
  return { x: ball.x + offset.x * fraction, y: ball.y + offset.y * fraction };
}

export function simSupportTarget(ball, direction, side) {
  const roles = MATCH_SIM_DATA.roles;
  return { x: ball.x - roles.supportBackDistance * direction, y: ball.y + side * roles.supportSideDistance };
}

export function simMarkTarget(receiver, team) {
  return { x: receiver.position.x - team.direction * MATCH_SIM_DATA.roles.markGoalSideDistance, y: receiver.position.y };
}
