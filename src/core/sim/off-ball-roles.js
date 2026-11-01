import { planSimulationBoxDefence } from './box-defending.js';
import { simulationPlayerAvailable } from './duel-state.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import BALANCE from '../../data/balance.json';
import { usesNaturalMatchClock } from './simulation-clock.js';
import { pointDistance, pointSquaredDistance } from './geometry.js';
import { movementGait } from './player-movement.js';
import { fitTeamTarget, simAnchorPosition, simKeeperTarget, simTeamShape, teamOwnsSimBall } from './team-shape.js';
import { dangerousSimReceiver, simCoverTarget, simMarkTarget, simSupportTarget } from './off-ball-targets.js';

const { assign } = Object;
const exclusiveRoles = new Set(['press', 'cover', 'mark', 'support', 'depth', 'rebound']);
const planningStates = new WeakMap();
function teamPlanningState(team) {
  if (!planningStates.has(team)) planningStates.set(team, { players: team.players.filter(player => player.slot !== 'GK'), plan: new Map() });
  return planningStates.get(team);
}
const outfieldPlayers = team => teamPlanningState(team).players;
export function invalidateSimulationPlanning(team) { planningStates.delete(team); }
function nearestPlayer(players, point) {
  let nearest, minimum = Infinity;
  for (const player of players) {
    const distance = pointSquaredDistance(player.position, point);
    if (distance < minimum) { nearest = player; minimum = distance; }
  }
  return nearest;
}

export function updateOffBallDecisions(simulation, team) {
  if (!team.players.some(player => player.nextDecisionTick <= simulation.tick)) return;
  const plan = createOffBallPlan(simulation, team);
  for (const player of team.players) applyPlayerDecision({ simulation, team, plan }, player);
}

function createOffBallPlan(simulation, team) {
  const shape = simTeamShape(simulation, team);
  const plan = teamPlanningState(team).plan;
  for (const player of team.players) plan.set(player.id, {
    role: player.slot === 'GK' ? 'keeper' : 'block',
    target: player.slot === 'GK' ? simKeeperTarget(simulation, team) : simAnchorPosition(team, player, shape),
    coveringId: null, laneTargetId: null,
  });
  const context = { simulation, team, shape, plan, available: outfieldPlayers(team).filter(simulationPlayerAvailable) };
  if (teamOwnsSimBall(simulation, team)) planAttackingRoles(context);
  else planDefensiveRoles(context);
  return { instructions: plan, shape };
}

function assignSimRole(context, player, instruction) {
  if (!player) return;
  context.plan.set(player.id, { coveringId: null, laneTargetId: null, ...instruction, target: fitTeamTarget(instruction.target, context.shape) });
  context.available = context.available.filter(candidate => candidate.id !== player.id);
}

function planAttackingRoles(context) {
  const { simulation, team } = context;
  const flow = usesNaturalMatchClock(simulation) ? BALANCE.shortMatchFlow : null;
  if (flow) context.available = context.available.filter(player => player.id !== (simulation.ball.ownerId ?? simulation.ball.carry?.playerId));
  const runner = [...context.available].filter(player => player.line === 'attack').sort((left, right) => right.anchor.x - left.anchor.x)[0];
  if (runner) {
    const target = simAnchorPosition(team, runner, context.shape);
    target.x += team.direction * MATCH_SIM_DATA.roles.depthRunDistance;
    assignSimRole(context, runner, { role: 'depth', target });
  }
  for (let index = 0; index < MATCH_SIM_DATA.roles.supportCount; index++) {
    const side = index % 2 ? 1 : -1;
    const target = simSupportTarget(simulation.ball.position, team.direction, side);
    if (flow && index === 0) target.x = simulation.ball.position.x + team.direction * flow.supportForwardDistance;
    assignSimRole(context, nearestPlayer(context.available, target), { role: 'support', target });
  }
}

function planDefensiveRoles(context) {
  const { simulation, team } = context;
  if (simulation.ball.flight?.cross && planSimulationBoxDefence(context, assignSimRole)) return;
  const pressers = selectSimPressers(simulation, team);
  for (const presser of pressers) assignSimRole(context, presser, { role: 'press', target: simPressTarget(simulation, presser) });
  const receiver = dangerousSimReceiver(simulation, team);
  if (pressers.length) planSimCover(context, pressers[0], receiver);
  if (planSimulationBoxDefence(context, assignSimRole)) return;
  if (receiver) {
    const target = simMarkTarget(receiver, team);
    for (let index = 0; index < MATCH_SIM_DATA.roles.markCount; index++) assignSimRole(context, nearestPlayer(context.available, target), { role: 'mark', target, laneTargetId: receiver.id });
  }
}

function simPressTarget(simulation, player) {
  const ball = simulation.ball;
  if (ball.ownerId == null) return ball.position;
  const distance = pointDistance(player.position, ball.position);
  const standOff = MATCH_SIM_DATA.roles.holderStandOffDistance;
  const team = simulation.teams.find(candidate => candidate.id === player.teamId);
  if (!distance) return { x: ball.position.x - team.direction * standOff, y: ball.position.y };
  // This coarse approach target is refined into a goal-side jockey by the contact system.
  return { x: ball.position.x + (player.position.x - ball.position.x) / distance * standOff,
    y: ball.position.y + (player.position.y - ball.position.y) / distance * standOff };
}

function selectSimPressers(simulation, team) {
  const ball = simulation.ball.position;
  const candidates = outfieldPlayers(team).filter(simulationPlayerAvailable);
  const nearest = nearestSimPressers(candidates, ball).filter(player => pointDistance(player.position, ball) <= team.pressTriggerDistance);
  const ready = nearest.filter(player => player.nextDecisionTick <= simulation.tick || player.role === 'press');
  if (ready.length) return ready;
  return candidates.filter(player => player.role === 'press' && pointDistance(player.position, ball) <= team.pressTriggerDistance).slice(0, MATCH_SIM_DATA.roles.maxPressers);
}

function nearestSimPressers(players, point) {
  if (MATCH_SIM_DATA.roles.maxPressers === 1) { const nearest = nearestPlayer(players, point); return nearest ? [nearest] : []; }
  const remaining = players.slice(), selected = [];
  for (let index = 0; index < MATCH_SIM_DATA.roles.maxPressers; index++) {
    const nearest = nearestPlayer(remaining, point);
    if (!nearest) break;
    selected.push(nearest);
    remaining.splice(remaining.indexOf(nearest), 1);
  }
  return selected;
}

function planSimCover(context, presser, receiver) {
  const target = simCoverTarget(context.simulation, context.team, receiver);
  for (let index = 0; index < MATCH_SIM_DATA.roles.coverCount; index++) {
    assignSimRole(context, nearestPlayer(context.available, target), { role: 'cover', target, coveringId: presser.id, laneTargetId: receiver?.id ?? null });
  }
}

function applyPlayerDecision(context, player) {
  const { simulation, team, plan } = context;
  if (!simulationPlayerAvailable(player)) return;
  const instruction = plan.instructions.get(player.id);
  const cancelled = exclusiveRoles.has(player.role) && player.role !== instruction.role;
  if (player.nextDecisionTick > simulation.tick && !cancelled) return;
  if (player.nextDecisionTick > simulation.tick) {
    // Exclusive jobs are handed over atomically; cancelling one must not create a second presser.
    player.role = 'block';
    player.target = simAnchorPosition(team, player, plan.shape);
    player.gait = movementGait(player.role, pointDistance(player.position, player.target));
    player.coveringId = null;
    player.laneTargetId = null;
    return;
  }
  assign(player, instruction);
  player.gait = movementGait(player.role, pointDistance(player.position, player.target));
  player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  if (player.role === 'press' && team.pressReactionSeconds === null) team.pressReactionSeconds = (simulation.tick - team.ownershipChangedTick) * MATCH_SIM_DATA.clock.stepSeconds;
}
