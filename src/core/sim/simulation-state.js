import MATCH_SIM_DATA from '../../data/match-sim.json';
import { playerMovementLimits } from './player-movement.js';
import { simAnchorPosition, simKeeperTarget, simTeamShape } from './team-shape.js';
import { validateSimulationInput } from './validation.js';

export function createSimulation(input) {
  validateSimulationInput(input);
  const simulation = { seed: input.seed, tick: 0, time: 0, accumulator: 0, ball: structuredClone(input.ball), teams: input.teams.map(createSimTeam) };
  for (const team of simulation.teams) initializeTeamPositions(simulation, team);
  return simulation;
}

function createSimTeam(input) {
  const anchors = MATCH_SIM_DATA.formations[input.formation];
  return {
    id: input.id, direction: input.direction, formation: input.formation, tactics: { ...input.tactics },
    phase: 'defending', phaseSinceTick: 0, ownershipChangedTick: 0, pressReactionSeconds: null,
    pressTriggerDistance: MATCH_SIM_DATA.tactics.pressDistance[input.tactics.press],
    players: input.players.map(player => createSimPlayer(player, anchors)),
  };
}

function createSimPlayer(input, anchors) {
  const anchor = anchors.find(candidate => candidate.slot === input.slot);
  const limits = playerMovementLimits(input.attributes);
  return {
    id: input.id, number: input.number, slot: input.slot, line: anchor.line,
    anchor: { x: anchor.x, y: anchor.y }, attributes: { ...input.attributes }, limits,
    position: input.position ? { ...input.position } : null, velocity: { x: 0, y: 0 }, heading: 0,
    role: input.slot === 'GK' ? 'keeper' : 'block', gait: 'walk', target: null,
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

export function readSimulation(simulation) {
  return structuredClone({ seed: simulation.seed, tick: simulation.tick, time: simulation.time, ball: simulation.ball, teams: simulation.teams });
}
