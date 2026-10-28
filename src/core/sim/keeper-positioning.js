import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance } from './geometry.js';
import { simulationRuntime } from './simulation-runtime.js';

export function simulationPenaltyAreaContains(team, point) {
  const pitch = MATCH_SIM_DATA.pitch;
  const depth = pitch.length / 2 + point.x * team.direction;
  return depth >= 0 && depth <= pitch.penaltyDepth && Math.abs(point.y) <= pitch.penaltyWidth / 2;
}

export function simulationKeeperTarget(simulation, team) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  const goalX = -MATCH_SIM_DATA.pitch.length / 2 * team.direction;
  const ball = simulation.ball.position;
  const distance = Math.abs(ball.x - goalX);
  const depth = keeperRushDepth(simulation, team) ?? clampSimValue(settings.minimumDepth + distance * settings.distanceDepthFactor, settings.minimumDepth, settings.maximumDepth);
  const half = MATCH_SIM_DATA.pitch.goalWidth / 2;
  const upper = { x: ball.x - goalX, y: ball.y - half }, lower = { x: ball.x - goalX, y: ball.y + half };
  const upperLength = Math.hypot(upper.x, upper.y) || 1, lowerLength = Math.hypot(lower.x, lower.y) || 1;
  const bisectorX = upper.x / upperLength + lower.x / lowerLength;
  const bisectorY = upper.y / upperLength + lower.y / lowerLength;
  const side = Math.abs(bisectorX) > MATCH_SIM_DATA.clock.epsilon ? Math.abs(depth / bisectorX) * bisectorY : 0;
  return { x: goalX + depth * team.direction, y: clampSimValue(side, -settings.bisectorSideLimit, settings.bisectorSideLimit) };
}

export function keeperRushDepth(simulation, team) {
  const ball = simulation.ball, settings = MATCH_SIM_DATA.goalkeeper;
  const attacker = simulationRuntime(simulation).byId.get(ball.ownerId ?? ball.carry?.playerId);
  if (!attacker || attacker.teamId === team.id || ball.shot) return null;
  const distance = MATCH_SIM_DATA.pitch.length / 2 + ball.position.x * team.direction;
  if (distance > settings.rushDistance || Math.abs(ball.position.y) > MATCH_SIM_DATA.pitch.goalAreaWidth / 2) return null;
  const covering = team.players.some(player => player.slot !== 'GK' && !player.sentOff && player.position.x * team.direction < ball.position.x * team.direction && Math.abs(player.position.y - ball.position.y) < MATCH_SIM_DATA.ball.controlRadius * 2);
  if (covering) return null;
  const keeper = team.players.find(player => player.slot === 'GK');
  const skill = (keeper.attributes.gk.oneOnOne + keeper.attributes.positioning) / (2 * MATCH_SIM_DATA.attributes.maximum);
  return Math.min(settings.rushDepth, Math.max(settings.minimumDepth, distance - settings.rushBallOffset)) * (1 - settings.rushSkillWeight + skill * settings.rushSkillWeight);
}

export function prepareSimulationKeepers(simulation) {
  for (const team of simulation.teams) prepareTeamKeeper(simulation, team);
}

function prepareTeamKeeper(simulation, team) {
  const keeper = team.players.find(player => player.slot === 'GK');
  if (keeperUnavailableForPositioning(simulation, keeper)) return;
  if (keeperFollowsFreeBall(simulation, keeper)) { keeper.keeper.setSeconds = 0; keeper.keeper.mode = 'rush'; return; }
  const state = keeper.keeper;
  keeper.role = 'keeper';
  if (state.shotIndex === simulation.ball.shot?.eventIndex && keeperShotActive(simulation.ball)) { prepareKeeperReaction(simulation, keeper); return; }
  state.shotIndex = null;
  keeper.target = simulationKeeperTarget(simulation, team);
  keeper.gait = 'sprint';
  prepareKeeperSet(simulation, team, keeper);
}

function keeperUnavailableForPositioning(simulation, keeper) {
  return !keeper || keeper.sentOff || simulation.ball.ownerId === keeper.id || simulation.ball.carry?.playerId === keeper.id;
}

function keeperFollowsFreeBall(simulation, keeper) {
  const ball = simulation.ball;
  if (ball.ownerId != null || ball.carry || keeperShotActive(ball)) return false;
  return ['restart', 'recover', 'receive', 'intercept'].includes(keeper.role);
}

function prepareKeeperSet(simulation, team, keeper) {
  const state = keeper.keeper, settings = MATCH_SIM_DATA.goalkeeper;
  const threat = simulation.ball.teamId !== team.id && pointDistance(simulation.ball.position, { x: -team.direction * MATCH_SIM_DATA.pitch.length / 2, y: 0 }) < MATCH_SIM_DATA.shooting.threatDistance;
  const near = pointDistance(keeper.position, keeper.target) <= settings.stepReach;
  const rushing = keeperRushDepth(simulation, team) !== null;
  if (threat && near && !rushing) keeper.target = { ...keeper.position };
  state.setSeconds = threat && near && Math.hypot(keeper.velocity.x, keeper.velocity.y) <= settings.setSpeed
    ? state.setSeconds + MATCH_SIM_DATA.clock.stepSeconds : 0;
  state.mode = state.setSeconds >= settings.setSeconds ? 'set' : rushing ? 'rush' : 'positioning';
}

function prepareKeeperReaction(simulation, keeper) {
  const state = keeper.keeper;
  if (simulation.time < state.reactionAt) { keeper.target = { ...keeper.position }; state.mode = 'reacting'; return; }
  keeper.target = { x: keeper.position.x, y: clampSimValue(state.target.y, -MATCH_SIM_DATA.pitch.width / 2, MATCH_SIM_DATA.pitch.width / 2) };
  keeper.gait = 'sprint';
  state.mode = Math.abs(state.target.y - keeper.position.y) > MATCH_SIM_DATA.goalkeeper.stepReach ? 'dive' : 'step';
}

function keeperShotActive(ball) {
  return ball.shot && !ball.shot.saved && !ball.shot.rebound;
}
