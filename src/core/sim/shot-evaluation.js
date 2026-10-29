import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue, pointDistance } from './geometry.js';
import { simulationOwnerPressure } from './pass-evaluation.js';
import { simulationPlayerAvailable } from './duel-state.js';

export function evaluateSimulationShot(simulation, owner) {
  const team = simulation.teams.find(candidate => candidate.id === owner.teamId);
  const goal = { x: team.direction * MATCH_SIM_DATA.pitch.length / 2, y: 0 };
  const distance = pointDistance(owner.position, goal);
  const angle = visibleGoalAngle(owner.position, goal);
  const opponents = simulation.teams.find(candidate => candidate.id !== team.id);
  const blocked = blockedGoalFraction(owner.position, goal, opponents.players);
  const pressure = simulationOwnerPressure(simulation, owner);
  const body = simulationShotBody(owner, goal);
  const keeper = opponents.players.find(player => player.slot === 'GK' && !player.sentOff);
  const displacement = keeperGoalDisplacement(owner, goal, keeper);
  const xg = shotExpectedGoals({ distance, angle, blocked, pressure, body, displacement });
  const style = shotStyle(owner, { keeper, goal, distance });
  const target = shotTarget(owner, { goal, keeper, style });
  return { xg, distance, angle, blocked, pressure, body, style, target, power: shotPower(owner, style),
    score: shotDecisionScore(owner, { team, xg, pressure, distance }), goalPosts: [-1, 1].map(side => ({ x: goal.x, y: side * MATCH_SIM_DATA.pitch.goalWidth / 2 })) };
}

function visibleGoalAngle(position, goal) {
  const depth = Math.abs(goal.x - position.x), half = MATCH_SIM_DATA.pitch.goalWidth / 2;
  return Math.abs(Math.atan2(half - position.y, depth) - Math.atan2(-half - position.y, depth));
}

function blockedGoalFraction(position, goal, players) {
  const depth = goal.x - position.x, half = MATCH_SIM_DATA.pitch.goalWidth / 2;
  const intervals = [];
  for (const player of players.filter(player => player.slot !== 'GK' && simulationPlayerAvailable(player))) {
    const fraction = (player.position.x - position.x) / depth;
    if (fraction <= 0 || fraction >= 1) continue;
    const centre = position.y + (player.position.y - position.y) / fraction;
    const radius = MATCH_SIM_DATA.shooting.blockRadius / fraction;
    if (centre + radius >= -half && centre - radius <= half) intervals.push([Math.max(-half, centre - radius), Math.min(half, centre + radius)]);
  }
  return mergedIntervalWidth(intervals) / (2 * half);
}

function mergedIntervalWidth(intervals) {
  let width = 0, end = -Infinity;
  for (const [left, right] of intervals.sort((a, b) => a[0] - b[0])) {
    width += Math.max(0, right - Math.max(left, end));
    end = Math.max(end, right);
  }
  return width;
}

export function simulationShotBody(owner, target) {
  const direction = Math.atan2(target.y - owner.position.y, target.x - owner.position.x) - owner.heading;
  return { turn: Math.abs(Math.atan2(Math.sin(direction), Math.cos(direction))) / Math.PI,
    running: Math.hypot(owner.velocity.x, owner.velocity.y) / owner.limits.maxSpeed };
}

function shotExpectedGoals({ distance, angle, blocked, pressure, body, displacement }) {
  const settings = MATCH_SIM_DATA.shooting;
  const logit = settings.xgIntercept - distance * settings.distanceCost + Math.log(Math.max(angle, MATCH_SIM_DATA.clock.epsilon)) * settings.angleWeight
    - blocked * settings.blockedAngleCost - pressure * settings.pressureCost - body.turn * settings.bodyCost - body.running * settings.runningCost
    + displacement * settings.keeperDisplacementWeight;
  const opening = Math.max(settings.blockedChanceFloor, 1 - blocked) ** settings.blockedChancePower;
  return clampSimValue(opening / (1 + Math.exp(-logit)), settings.minimumXg, settings.maximumXg);
}

function shotDecisionScore(owner, { team, xg, pressure, distance }) {
  const settings = MATCH_SIM_DATA.shooting;
  if (distance > settings.maximumDistance || owner.slot === 'GK' || xg < settings.minimumDecisionXg) return -Infinity;
  const skill = (owner.attributes.finishing + owner.attributes.composure) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const mentality = settings.mentalities[team.tactics.mentality ?? settings.defaultMentality];
  const longCost = Math.max(0, distance - settings.longShotDistance) * (1 - skill) * settings.longShotSkillCost;
  return (settings.scoreBase + xg * settings.scoreXgWeight + skill * settings.scoreSkillWeight) * mentality + pressure * settings.pressureUrgency - longCost;
}

function shotStyle(owner, { keeper, goal, distance }) {
  const settings = MATCH_SIM_DATA.shooting;
  const depth = keeper ? Math.abs(goal.x - keeper.position.x) : 0;
  if (depth > settings.chipDepth && Math.abs(keeper.position.x - owner.position.x) < settings.chipDistance && owner.attributes.technique >= settings.chipTechnique) return 'chip';
  return distance > settings.longShotDistance || owner.attributes.strength > owner.attributes.technique ? 'drive' : 'placed';
}

function shotTarget(owner, { goal, keeper }) {
  const settings = MATCH_SIM_DATA.shooting;
  const skill = (owner.attributes.finishing + owner.attributes.technique) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const side = keeper?.position.y > 0 ? -1 : keeper?.position.y < 0 ? 1 : owner.position.y >= 0 ? -1 : 1;
  return { x: goal.x, y: side * (MATCH_SIM_DATA.pitch.goalWidth / 2 - settings.cornerInset - (1 - skill) * settings.cornerSkillInset),
    height: settings.targetHeight + skill * settings.heightSkillRange };
}

function shotPower(owner, style) {
  const settings = MATCH_SIM_DATA.shooting, scale = MATCH_SIM_DATA.attributes.maximum;
  const speed = settings.minimumPower + owner.attributes.strength / scale * settings.strengthPower + owner.attributes.technique / scale * settings.techniquePower;
  return style === 'chip' ? settings.chipSpeed : speed * (style === 'placed' ? settings.placedPowerFactor : 1);
}

function keeperGoalDisplacement(owner, goal, keeper) {
  if (!keeper) return 1;
  const depth = goal.x - owner.position.x;
  const fraction = depth ? (keeper.position.x - owner.position.x) / depth : 0;
  if (fraction <= 0) return 1;
  const projectedCentre = owner.position.y * (1 - fraction);
  const sideOpening = Math.abs(keeper.position.y - projectedCentre) / MATCH_SIM_DATA.pitch.goalWidth;
  const closingSkill = (keeper.attributes.gk.oneOnOne + keeper.attributes.positioning) / (2 * MATCH_SIM_DATA.attributes.maximum);
  return sideOpening - Math.max(0, 1 - fraction) * closingSkill;
}
