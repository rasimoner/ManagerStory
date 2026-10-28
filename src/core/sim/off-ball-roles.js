import MATCH_SIM_DATA from '../../data/match-sim.json';
import { pointDistance } from './geometry.js';
import { movementGait } from './player-movement.js';
import { fitTeamTarget, simAnchorPosition, simKeeperTarget, simTeamShape, teamOwnsSimBall } from './team-shape.js';
import { dangerousSimReceiver, simCoverTarget, simMarkTarget, simSupportTarget } from './off-ball-targets.js';

const exclusiveRoles = new Set(['press', 'cover', 'mark', 'support', 'depth']);
const outfieldPlayers = team => team.players.filter(player => player.slot !== 'GK');
function nearestPlayer(players, point) {
  let nearest, minimum = Infinity;
  for (const player of players) {
    const distance = pointDistance(player.position, point);
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
  const plan = new Map(team.players.map(player => [player.id, {
    role: player.slot === 'GK' ? 'keeper' : 'block',
    target: player.slot === 'GK' ? simKeeperTarget(simulation, team) : simAnchorPosition(team, player, shape),
    coveringId: null, laneTargetId: null,
  }]));
  const context = { simulation, team, shape, plan, available: outfieldPlayers(team) };
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
  const runner = [...context.available].filter(player => player.line === 'attack').sort((left, right) => right.anchor.x - left.anchor.x)[0];
  if (runner) {
    const target = simAnchorPosition(team, runner, context.shape);
    target.x += team.direction * MATCH_SIM_DATA.roles.depthRunDistance;
    assignSimRole(context, runner, { role: 'depth', target });
  }
  for (let index = 0; index < MATCH_SIM_DATA.roles.supportCount; index++) {
    const side = index % 2 ? 1 : -1;
    const target = simSupportTarget(simulation.ball.position, team.direction, side);
    assignSimRole(context, nearestPlayer(context.available, target), { role: 'support', target });
  }
}

function planDefensiveRoles(context) {
  const { simulation, team } = context;
  const pressers = selectSimPressers(simulation, team);
  for (const presser of pressers) assignSimRole(context, presser, { role: 'press', target: simulation.ball.position });
  const receiver = dangerousSimReceiver(simulation, team);
  if (pressers.length) planSimCover(context, pressers[0], receiver);
  if (receiver) {
    const target = simMarkTarget(receiver, team);
    for (let index = 0; index < MATCH_SIM_DATA.roles.markCount; index++) assignSimRole(context, nearestPlayer(context.available, target), { role: 'mark', target, laneTargetId: receiver.id });
  }
}

function selectSimPressers(simulation, team) {
  const ball = simulation.ball.position;
  const candidates = outfieldPlayers(team);
  const nearest = nearestSimPressers(candidates, ball).filter(player => pointDistance(player.position, ball) <= team.pressTriggerDistance);
  const ready = nearest.filter(player => player.nextDecisionTick <= simulation.tick || player.role === 'press');
  if (ready.length) return ready;
  return candidates.filter(player => player.role === 'press' && pointDistance(player.position, ball) <= team.pressTriggerDistance).slice(0, MATCH_SIM_DATA.roles.maxPressers);
}

function nearestSimPressers(players, point) {
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
  Object.assign(player, instruction);
  player.gait = movementGait(player.role, pointDistance(player.position, player.target));
  player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  if (player.role === 'press' && team.pressReactionSeconds === null) team.pressReactionSeconds = (simulation.tick - team.ownershipChangedTick) * MATCH_SIM_DATA.clock.stepSeconds;
}
