import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, planningDistance } from './geometry.js';
import { simulationOpponentArrival } from './player-arrival.js';
import { simulationPlayerAvailable } from './duel-state.js';

export function evaluateSimulationDribble(simulation, owner) {
  const team = simulation.teams.find(candidate => candidate.id === owner.teamId);
  const opponents = simulation.teams.find(candidate => candidate.id !== team.id).players.filter(simulationPlayerAvailable);
  const carrier = { position: owner.position, velocity: owner.velocity, limits: { maxSpeed: owner.limits.maxSpeed * owner.carrySpeedRatio, acceleration: owner.limits.acceleration } };
  let best = null;
  for (const angle of MATCH_SIM_DATA.dribbling.angles) {
    const option = evaluateCarryDirection({ owner, carrier, team, opponents }, angle);
    if (!best || option.score > best.score) best = option;
  }
  return best;
}

function evaluateCarryDirection({ owner, carrier, team, opponents }, angle) {
  const settings = MATCH_SIM_DATA.dribbling, weights = MATCH_SIM_DATA.ownerDecision;
  const heading = (team.direction > 0 ? 0 : Math.PI) + angle;
  const distance = Math.max(settings.minimumLookAhead, owner.limits.maxSpeed * owner.carrySpeedRatio * settings.lookAheadSeconds);
  const target = fitCarryTarget({ x: owner.position.x + Math.cos(heading) * distance, y: owner.position.y + Math.sin(heading) * distance });
  const safeSeconds = carrySafeSeconds({ owner, carrier, opponents, target });
  const turn = Math.abs(Math.atan2(Math.sin(heading - owner.heading), Math.cos(heading - owner.heading)));
  const progress = (target.x - owner.position.x) * team.direction;
  return { target, safeSeconds, progress, score: weights.dribbleBase + safeSeconds * weights.dribbleSafetyWeight + progress * weights.dribbleProgressWeight - turn * weights.turnCost };
}

function carrySafeSeconds({ owner, carrier, opponents, target }) {
  let safe = MATCH_SIM_DATA.dribbling.safeTimeCap;
  for (const fraction of MATCH_SIM_DATA.dribbling.routeFractions) {
    const point = { x: owner.position.x + (target.x - owner.position.x) * fraction, y: owner.position.y + (target.y - owner.position.y) * fraction };
    const arrival = simulationOpponentArrival(carrier, point);
    safe = closestCarryMargin({ opponents, point, arrival }, safe);
  }
  return clampSimValue(safe, -MATCH_SIM_DATA.dribbling.safeTimeCap, MATCH_SIM_DATA.dribbling.safeTimeCap);
}

function closestCarryMargin({ opponents, point, arrival }, initial) {
  let margin = initial;
  for (const opponent of opponents) {
    const horizon = arrival + margin;
    if (horizon <= 0) break;
    const reach = MATCH_SIM_DATA.ball.controlRadius + opponent.limits.maxSpeed * horizon;
    const squared = (opponent.position.x - point.x) ** 2 + (opponent.position.y - point.y) ** 2;
    if (squared > reach * reach + MATCH_SIM_DATA.clock.epsilon) continue;
    margin = Math.min(margin, simulationOpponentArrival(opponent, point) - arrival);
  }
  return margin;
}

export function fitCarryTarget(point) {
  const pitch = MATCH_SIM_DATA.pitch;
  return { x: clampSimValue(point.x, -pitch.length / 2 + pitch.targetMargin, pitch.length / 2 - pitch.targetMargin),
    y: clampSimValue(point.y, -pitch.width / 2 + pitch.targetMargin, pitch.width / 2 - pitch.targetMargin) };
}

export function simulationShieldTarget(simulation, owner) {
  const opponents = simulation.teams.find(team => team.id !== owner.teamId).players.filter(simulationPlayerAvailable);
  const nearest = opponents.reduce((best, player) => !best || planningDistance(player.position, owner.position) < planningDistance(best.position, owner.position) ? player : best, null);
  if (!nearest) return { ...owner.position };
  const distance = planningDistance(nearest.position, owner.position) || 1;
  const offset = MATCH_SIM_DATA.dribbling.shieldOffset;
  return fitCarryTarget({ x: owner.position.x + (owner.position.x - nearest.position.x) / distance * offset,
    y: owner.position.y + (owner.position.y - nearest.position.y) / distance * offset });
}
