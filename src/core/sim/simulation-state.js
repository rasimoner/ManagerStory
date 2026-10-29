import { createSimulationMatch } from './match-lifecycle.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { playerMovementLimits } from './player-movement.js';
import { simAnchorPosition, simKeeperTarget, simTeamShape } from './team-shape.js';
import { validateSimulationInput } from './validation.js';
import { createSimulationBall, validateBallPhysics, validateBallOwner } from './ball-state.js';
import { createSimulationDuelState } from './duel-state.js';
import { createSimulationStatistics } from './ball-events.js';

export function createSimulation(input) {
  validateSimulationInput(input);
  validateBallPhysics(input.ball);
  const simulation = { match: createSimulationMatch(input), liveBall: false, shooting: null, seed: input.seed, rngState: input.seed, tick: 0, time: 0, accumulator: 0, automaticPasses: true, ball: createSimulationBall(input.ball),
    teams: input.teams.map(createSimTeam), events: [], statistics: createSimulationStatistics(input.teams),
    paused: false, commands: { substitutions: [] }, departed: [], workload: { enabled: input.workload === true, eventCursor: 0, nextInjuryTick: 0 },
    ownerDecision: { selected: null, forcedPlayerId: null }, defending: { engagements: [], lastContact: null }, referee: { advantage: null, stoppage: null },
    passing: { options: [], selected: null, requested: null, nextEvaluationTick: 0 } };
  for (const team of simulation.teams) initializeTeamPositions(simulation, team);
  validateBallOwner(simulation, simulation.ball);
  if (simulation.ball.ownerId != null) simulation.statistics.teams[simulation.ball.teamId].controls++;
  return simulation;
}

function createSimTeam(input) {
  const anchors = MATCH_SIM_DATA.formations[input.formation];
  return {
    id: input.id, direction: input.direction, formation: input.formation, tactics: { ...input.tactics },
    phase: 'defending', phaseSinceTick: 0, ownershipChangedTick: 0, pressReactionSeconds: null,
    pressTriggerDistance: MATCH_SIM_DATA.tactics.pressDistance[input.tactics.press],
    players: input.players.map(player => createSimulationPlayer({ ...player, teamId: input.id }, anchors)),
  };
}

export function createSimulationPlayer(input, anchors) {
  const anchor = anchors.find(candidate => candidate.slot === input.slot);
  const limits = playerMovementLimits(input.attributes);
  return {
    id: input.id, teamId: input.teamId, number: input.number, slot: input.slot, line: anchor.line,
    anchor: { x: anchor.x, y: anchor.y }, attributes: simPlayerAttributes({ ...input.attributes, gk: input.gk ?? input.attributes.gk }), limits,
    position: input.position ? { ...input.position } : null, velocity: { x: 0, y: 0 }, heading: 0,
    role: input.slot === 'GK' ? 'keeper' : 'block', gait: 'walk', target: null,
    motionMode: null, facingTarget: null, shoulderSpeedRatio: 1, shoulderAfterTick: 0,
    keeper: { setSeconds: 0, mode: 'positioning', reactionAt: null, target: null, shotIndex: null, lastSave: null },
    workload: { playedSeconds: 0, distanceMetres: 0, sprintMetres: 0, contacts: 0 },
    duel: createSimulationDuelState(), yellowCards: 0, sentOff: false, carrySpeedRatio: carrySpeedRatio(input.attributes),
    nextDecisionTick: limits.reactionTicks, coveringId: null, laneTargetId: null,
  };
}

function initializeTeamPositions(simulation, team) {
  team.phase = simulation.ball.teamId === team.id ? 'possession' : 'defending';
  const shape = simTeamShape(simulation, team);
  for (const player of team.players) {
    const anchor = player.slot === 'GK' ? simKeeperTarget(simulation, team) : simAnchorPosition(team, player, shape);
    player.position ??= anchor;
    player.target = { ...player.position };
    player.heading = team.direction > 0 ? 0 : Math.PI;
  }
}

function simPlayerAttributes(input) {
  const attributes = { ...input, gk: { reflexes: MATCH_SIM_DATA.ball.defaultAttribute, handling: MATCH_SIM_DATA.ball.defaultAttribute, oneOnOne: MATCH_SIM_DATA.ball.defaultAttribute, ...input.gk } };
  for (const name of ['finishing', 'passing', 'vision', 'technique', 'firstTouch', 'dribbling', 'strength', 'composure', 'tackling', 'positioning']) attributes[name] ??= MATCH_SIM_DATA.ball.defaultAttribute;
  return attributes;
}

function carrySpeedRatio(attributes) {
  const skill = ((attributes.dribbling ?? MATCH_SIM_DATA.ball.defaultAttribute) + (attributes.technique ?? MATCH_SIM_DATA.ball.defaultAttribute)) / (2 * MATCH_SIM_DATA.attributes.maximum);
  return MATCH_SIM_DATA.dribbling.minimumSpeedRatio + skill * MATCH_SIM_DATA.dribbling.skillSpeedRatio;
}

export function readSimulation(simulation, options = {}) {
  return structuredClone({ seed: simulation.seed, rngState: simulation.rngState, tick: simulation.tick, time: simulation.time,
    match: simulation.match, shooting: simulation.shooting, ownerDecision: simulation.ownerDecision, defending: simulation.defending, referee: simulation.referee,
    ball: simulation.ball, teams: simulation.teams, passing: simulation.passing, statistics: simulation.statistics,
    events: options.includeEvents === false ? [] : simulation.events });
}
