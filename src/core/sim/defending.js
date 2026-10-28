import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime, drawSimulationRandom } from './simulation-runtime.js';
import { planningDistance } from './geometry.js';
import { simulationDurationTicks, simulationPlayerAvailable, recoverSimulationDefender } from './duel-state.js';
import { predictSimulationBall } from './ball-physics.js';
import { resolveSimulationTackle } from './tackle-resolution.js';
import { fitCarryTarget } from './dribble-evaluation.js';

export function prepareSimulationDefenders(simulation) {
  const runtime = simulationRuntime(simulation);
  const victim = runtime.byId.get(simulation.ball.ownerId ?? simulation.ball.carry?.playerId);
  for (const player of runtime.players) {
    player.motionMode = null;
    recoverSimulationDefender(simulation, player);
    if (simulation.ball.heldBy != null) { player.duel.tackle = null; continue; }
    if (!victim || victim.teamId === player.teamId || !simulationPlayerAvailable(player)) continue;
    if (player.duel.tackle) { player.motionMode = 'tackling'; continue; }
    if (!['press', 'cover'].includes(player.role)) { player.duel.state = 'idle'; continue; }
    planDefenderMovement(simulation, player, victim);
  }
}

function planDefenderMovement(simulation, defender, victim) {
  const distance = planningDistance(defender.position, victim.position);
  if (distance > MATCH_SIM_DATA.duels.jockeyRange) { defender.duel.state = 'idle'; return; }
  defender.motionMode = 'jockey';
  defender.facingTarget = victim.position;
  if (simulation.tick < defender.duel.nextPlanTick) return;
  defender.duel.nextPlanTick = simulation.tick + defender.limits.reactionTicks;
  defender.duel.state = 'jockey';
  defender.target = jockeyTarget(simulation, defender, victim);
  defender.gait = 'sprint';
  if (simulation.tick >= defender.duel.nextTackleTick) considerDefenderTackle(simulation, defender, victim);
}

function jockeyTarget(simulation, defender, victim) {
  const team = simulation.teams.find(candidate => candidate.id === defender.teamId);
  const goal = { x: -team.direction * MATCH_SIM_DATA.pitch.length / 2, y: 0 };
  const distance = planningDistance(goal, victim.position) || 1;
  const lead = defender.limits.reactionSeconds;
  const standOff = MATCH_SIM_DATA.duels.jockeyDistance * (defender.role === 'cover' ? MATCH_SIM_DATA.duels.coverJockeyFactor : 1);
  return fitCarryTarget({ x: victim.position.x + victim.velocity.x * lead + (goal.x - victim.position.x) / distance * standOff,
    y: victim.position.y + victim.velocity.y * lead + (goal.y - victim.position.y) / distance * standOff });
}

function considerDefenderTackle(simulation, defender, victim) {
  const settings = MATCH_SIM_DATA.duels, scale = MATCH_SIM_DATA.attributes.maximum;
  const team = simulation.teams.find(candidate => candidate.id === defender.teamId);
  const aggression = settings.pressAggression[team.tactics.press];
  const skill = (defender.attributes.tackling + defender.attributes.positioning + defender.attributes.composure) / (3 * scale);
  const exposed = planningDistance(victim.position, simulation.ball.position);
  const threshold = settings.opportunityDistance - skill * settings.opportunitySkillReduction - aggression * settings.opportunityPressureReduction
    + Number(defender.yellowCards > 0) * settings.bookedOpportunityAddition;
  if (exposed < threshold && !canReachUnshieldedBall(simulation, defender, victim)) return;
  const distance = planningDistance(defender.position, simulation.ball.position);
  defender.duel.state = 'ready';
  if (distance <= settings.standingReach) beginSimulationTackle(simulation, defender, { victim, kind: 'standing' });
  else if (distance <= settings.slidingReach && exposed > threshold + settings.opportunitySkillReduction) beginSimulationTackle(simulation, defender, { victim, kind: 'sliding' });
}

export function beginSimulationTackle(simulation, defender, { victim, kind }) {
  const settings = MATCH_SIM_DATA.duels;
  const error = 1 - defender.attributes.tackling / MATCH_SIM_DATA.attributes.maximum;
  const duration = (kind === 'sliding' ? settings.slidingSeconds : settings.standingSeconds)
    + drawSimulationRandom(simulation) * settings.timingErrorSeconds * error;
  const predicted = simulation.ball.ownerId == null ? predictSimulationBall(simulation.ball, duration).position
    : { x: simulation.ball.position.x + victim.velocity.x * duration, y: simulation.ball.position.y + victim.velocity.y * duration };
  const direction = Math.atan2(predicted.y - defender.position.y, predicted.x - defender.position.x)
    + (drawSimulationRandom(simulation) * 2 - 1) * settings.directionError * error;
  const reach = kind === 'sliding' ? settings.slidingReach : settings.standingReach;
  defender.duel.tackle = { victimId: victim.id, kind, direction, reach, startTick: simulation.tick, contactTick: simulation.tick + simulationDurationTicks(duration),
    distance: planningDistance(defender.position, simulation.ball.position), victimSpeed: Math.hypot(victim.velocity.x, victim.velocity.y) };
  defender.duel.state = 'tackling';
  defender.target = fitCarryTarget(predicted);
  defender.motionMode = 'tackling';
}

export function finishSimulationTackles(simulation) {
  if (simulation.referee.stoppage) return;
  for (const defender of simulationRuntime(simulation).players) {
    const tackle = defender.duel.tackle;
    if (!tackle || simulation.tick < tackle.contactTick) continue;
    const from = { ...defender.position };
    const to = { x: from.x + Math.cos(tackle.direction) * tackle.reach, y: from.y + Math.sin(tackle.direction) * tackle.reach };
    resolveSimulationTackle(simulation, { defenderId: defender.id, victimId: tackle.victimId, kind: tackle.kind, from, to,
      distance: tackle.distance, victimSpeed: tackle.victimSpeed, preparationSeconds: (simulation.tick - tackle.startTick) * MATCH_SIM_DATA.clock.stepSeconds,
      speed: Math.hypot(defender.velocity.x, defender.velocity.y) + MATCH_SIM_DATA.duels.lungeSpeed });
    if (simulation.referee.stoppage) break;
  }
}


function canReachUnshieldedBall(simulation, defender, victim) {
  const settings = MATCH_SIM_DATA.duels;
  const bodyDistance = planningDistance(defender.position, victim.position);
  const ballDistance = planningDistance(defender.position, simulation.ball.position);
  const caution = defender.yellowCards > 0 ? settings.bookedOpportunityAddition : 0;
  const skill = (defender.attributes.tackling + defender.attributes.positioning + defender.attributes.composure) / (3 * MATCH_SIM_DATA.attributes.maximum);
  const margin = (1 - skill) * settings.controlledBodyMargin;
  return ballDistance + settings.legRadius + caution + margin < bodyDistance;
}
