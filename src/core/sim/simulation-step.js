import MATCH_SIM_DATA from '../../data/match-sim.json';
import { validateSimBall } from './validation.js';
import { integrateSimPlayer } from './player-movement.js';
import { updateOffBallDecisions } from './off-ball-roles.js';

export function stepSimulation(simulation, ball) {
  validateSimBall(ball, simulation.teams);
  if (ball.teamId !== simulation.ball.teamId) beginSimTransition(simulation, ball.teamId);
  simulation.ball = { teamId: ball.teamId, position: { ...ball.position } };
  simulation.tick++;
  simulation.time = simulation.tick * MATCH_SIM_DATA.clock.stepSeconds;
  for (const team of simulation.teams) {
    updateSimPhase(simulation, team);
    updateOffBallDecisions(simulation, team);
  }
  // Decisions read the same positions; neither team's integration gets a first-mover advantage.
  for (const team of simulation.teams) for (const player of team.players) integrateSimPlayer(player);
  return simulation;
}

function beginSimTransition(simulation, ownerId) {
  for (const team of simulation.teams) {
    team.phase = team.id === ownerId ? 'winning' : 'counterpress';
    team.phaseSinceTick = simulation.tick;
    team.ownershipChangedTick = simulation.tick;
    team.pressReactionSeconds = null;
    for (const player of team.players) player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  }
}

function updateSimPhase(simulation, team) {
  const phases = MATCH_SIM_DATA.phases;
  const elapsed = (simulation.tick - team.phaseSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  if (team.phase === 'winning' && elapsed >= phases.winningSeconds) team.phase = 'possession';
  if (team.phase === 'counterpress' && elapsed >= phases.counterpressSeconds) team.phase = 'defending';
  const multiplier = team.phase === 'counterpress' ? phases.counterpressTriggerFactor : 1;
  team.pressTriggerDistance = MATCH_SIM_DATA.tactics.pressDistance[team.tactics.press] * multiplier;
}

export function advanceSimulation(simulation, input) {
  if (!Number.isFinite(input.seconds) || input.seconds < 0) throw new RangeError('Elapsed seconds must be finite and non-negative.');
  validateSimBall(input.ball, simulation.teams);
  simulation.accumulator += input.seconds;
  const { stepSeconds, epsilon } = MATCH_SIM_DATA.clock;
  while (simulation.accumulator + epsilon >= stepSeconds) {
    stepSimulation(simulation, input.ball);
    simulation.accumulator = Math.max(0, simulation.accumulator - stepSeconds);
  }
  return simulation;
}
