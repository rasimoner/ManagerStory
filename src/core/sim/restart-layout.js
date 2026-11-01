import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance } from './geometry.js';
import { simulationPenaltyAreaContains } from './keeper-positioning.js';
import { arrangeSimulationCross } from './cross-layout.js';

export function simulationRestartLayout(simulation, restart) {
  const targets = {};
  for (const team of simulation.teams) for (const player of team.players) targets[player.id] = restartPlayerTarget({ simulation, restart, team }, player);
  if (restart.kind === 'freeKick') placeFreeKickWall(simulation, restart, targets);
  arrangeSimulationCross(simulation, restart, targets);
  return targets;
}

function restartPlayerTarget({ simulation, restart, team }, player) {
  const pitch = MATCH_SIM_DATA.pitch, settings = MATCH_SIM_DATA.deadBalls;
  if (player.id === restart.takerId) return { ...restart.position };
  if (restart.kind === 'penalty') return penaltyPlayerTarget(player, team, restart);
  if (restart.kind === 'goalKick' && team.id !== restart.teamId && simulationPenaltyAreaContains(simulation.teams.find(team => team.id === restart.teamId), player.position)) {
    return { x: Math.sign(restart.position.x) * (pitch.length / 2 - pitch.penaltyDepth - settings.areaMargin), y: player.position.y };
  }
  if (team.id !== restart.teamId) return outsideRestartDistance(player.position, restart);
  if (player.id === restart.receiverId && ['throwIn', 'corner'].includes(restart.kind)) {
    return simulationShortRestartTarget(restart.position, player.position, settings.receiverDistance);
  }
  return { ...player.position };
}

function penaltyPlayerTarget(player, team, restart) {
  const pitch = MATCH_SIM_DATA.pitch, settings = MATCH_SIM_DATA.deadBalls, sign = Math.sign(restart.position.x);
  if (player.slot === 'GK' && team.id !== restart.teamId) return { x: sign * pitch.length / 2, y: 0 };
  if (player.slot === 'GK') return { x: -sign * (pitch.length / 2 - MATCH_SIM_DATA.goalkeeper.threatDepth), y: 0 };
  const behind = Math.min(player.position.x * sign, Math.abs(restart.position.x) - settings.penaltyBehindMargin);
  const position = { x: sign * Math.min(behind, pitch.length / 2 - pitch.penaltyDepth - settings.areaMargin), y: player.position.y };
  return outsideRestartDistance(position, restart);
}

function outsideRestartDistance(position, restart) {
  const distance = restart.kind === 'throwIn' ? MATCH_SIM_DATA.deadBalls.throwOpponentDistance : MATCH_SIM_DATA.refereeing.restartDistance;
  if (pointDistance(position, restart.position) >= distance + MATCH_SIM_DATA.refereeing.restartClearance) return { ...position };
  return legalRestartRetreat(restart.position, { position, distance });
}

function legalRestartRetreat(spot, { position, distance }) {
  const settings = MATCH_SIM_DATA.refereeing, pitch = MATCH_SIM_DATA.pitch;
  const preferred = Math.atan2(position.y - spot.y, position.x - spot.x), radius = distance + settings.restartClearance;
  for (let step = 0; step < settings.restartDirectionCount; step++) {
    const offset = Math.ceil(step / 2) * (step % 2 ? 1 : -1) * Math.PI * 2 / settings.restartDirectionCount;
    const target = { x: spot.x + Math.cos(preferred + offset) * radius, y: spot.y + Math.sin(preferred + offset) * radius };
    if (Math.abs(target.x) <= pitch.length / 2 - settings.restartClearance && Math.abs(target.y) <= pitch.width / 2 - settings.restartClearance) return target;
  }
  throw new RangeError('No legal restart position inside the pitch.');
}

function placeFreeKickWall(simulation, restart, targets) {
  const settings = MATCH_SIM_DATA.deadBalls, pitch = MATCH_SIM_DATA.pitch;
  const defending = simulation.teams.find(team => team.id !== restart.teamId), goalX = -defending.direction * pitch.length / 2;
  if (Math.hypot(goalX - restart.position.x, restart.position.y) > settings.wallGoalDistance) return;
  const angle = Math.atan2(-restart.position.y, goalX - restart.position.x);
  const players = defending.players.filter(player => player.slot !== 'GK' && !player.sentOff)
    .sort((a, b) => pointDistance(a.position, restart.position) - pointDistance(b.position, restart.position)).slice(0, settings.wallPlayers);
  const distance = MATCH_SIM_DATA.refereeing.restartDistance + MATCH_SIM_DATA.refereeing.restartClearance;
  players.forEach((player, index) => {
    const side = (index - (players.length - 1) / 2) * settings.wallSpacing;
    const position = { x: clampSimValue(restart.position.x + Math.cos(angle) * distance - Math.sin(angle) * side, -pitch.length / 2, pitch.length / 2),
      y: clampSimValue(restart.position.y + Math.sin(angle) * distance + Math.cos(angle) * side, -pitch.width / 2, pitch.width / 2) };
    targets[player.id] = outsideRestartDistance(position, restart);
  });
}

export function simulationShortRestartTarget(from, to, distance) {
  const fraction = Math.min(1, distance / Math.max(MATCH_SIM_DATA.clock.epsilon, pointDistance(from, to)));
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}
