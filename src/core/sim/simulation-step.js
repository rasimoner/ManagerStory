import MATCH_SIM_DATA from '../../data/match-sim.json';
import { validateSimBall } from './validation.js';
import { integrateSimPlayer } from './player-movement.js';
import { updateOffBallDecisions } from './off-ball-roles.js';
import { beginSimTransition, updateSimPhase } from './simulation-phases.js';
import { captureSimulationPlayerPositions } from './ball-contact.js';
import { updateSimulationBallChasers } from './ball-chasing.js';
import { prepareSimulationOwner, finishSimulationOwnerStep } from './owner-decision.js';
import { advanceSimulationFreeBall, recordSimulationPossessionTime } from './ball-step.js';

export function stepSimulation(simulation, replayBall) {
  if (replayBall !== undefined) applyOffBallReplay(simulation, replayBall);
  simulation.tick++;
  simulation.time = simulation.tick * MATCH_SIM_DATA.clock.stepSeconds;
  for (const team of simulation.teams) {
    updateSimPhase(simulation, team);
    updateOffBallDecisions(simulation, team);
  }
  const owned = simulation.ball.ownerId != null;
  if (replayBall === undefined) prepareBallMovement(simulation, owned);
  // Decisions read the same positions; neither team's integration gets a first-mover advantage.
  for (const team of simulation.teams) for (const player of team.players) integrateSimPlayer(player);
  if (replayBall === undefined) finishBallMovement(simulation, owned);
  return simulation;
}

function prepareBallMovement(simulation, owned) {
  if (owned) prepareSimulationOwner(simulation);
  else { updateSimulationBallChasers(simulation); captureSimulationPlayerPositions(simulation); }
}

function finishBallMovement(simulation, owned) {
  if (owned) finishSimulationOwnerStep(simulation);
  else advanceSimulationFreeBall(simulation);
  recordSimulationPossessionTime(simulation);
}

function applyOffBallReplay(simulation, ball) {
  // Retained only for the bit-for-bit off-ball regression fixture, never used by the laboratory game.
  validateSimBall(ball, simulation.teams);
  if (ball.teamId !== simulation.ball.teamId) beginSimTransition(simulation, ball.teamId);
  simulation.ball = { teamId: ball.teamId, position: { ...ball.position } };
}

export function advanceSimulation(simulation, input) {
  if (!Number.isFinite(input.seconds) || input.seconds < 0) throw new RangeError('Elapsed seconds must be finite and non-negative.');
  if (input.ball !== undefined) validateSimBall(input.ball, simulation.teams);
  simulation.accumulator += input.seconds;
  const { stepSeconds, epsilon } = MATCH_SIM_DATA.clock;
  while (simulation.accumulator + epsilon >= stepSeconds) {
    stepSimulation(simulation, input.ball);
    simulation.accumulator = Math.max(0, simulation.accumulator - stepSeconds);
  }
  return simulation;
}
