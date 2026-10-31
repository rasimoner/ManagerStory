import { finishSimulationKeeperRush } from './keeper-rushing.js';
import { advanceSimulationClock } from './simulation-clock.js';
import { applySimulationCommands } from './substitutions.js';
import { consumeSimulationFitness } from './player-workload.js';
import { prepareSimulationMatch } from './match-lifecycle.js';
import { preparePositionedSimulationRestart } from './restart-step.js';
import { prepareSimulationKeepers } from './keeper-positioning.js';
import { advanceSimulationKeeperPossession } from './keeper-possession.js';
import { prepareSimulationDefenders, finishSimulationTackles } from './defending.js';
import { prepareSimulationShoulders, recordSimulationShoulders } from './shoulder-duels.js';
import { trackSimulationBeats } from './beat-tracking.js';
import { recordSimulationCarryDistance } from './dribbling.js';
import { prepareSimulationFoulRestart, finishSimulationFoulRestart } from './foul-restart.js';
import { updateSimulationReferee } from './refereeing.js';
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
  if (simulationStepStopped(simulation, replayBall)) return simulation;
  if (replayBall !== undefined) applyOffBallReplay(simulation, replayBall);
  advanceSimulationClock(simulation);
  if (prepareLiveSimulationStep(simulation, replayBall)) return simulation;
  for (const team of simulation.teams) {
    updateSimPhase(simulation, team);
    updateOffBallDecisions(simulation, team);
  }
  const owned = simulation.ball.ownerId != null;
  if (replayBall === undefined) prepareBallMovement(simulation, owned);
  // Decisions read the same positions; neither team's integration gets a first-mover advantage.
  for (const team of simulation.teams) for (const player of team.players) integrateSimPlayer(player);
  if (replayBall === undefined) { finishBallMovement(simulation, owned); consumeSimulationFitness(simulation); }
  return simulation;
}

function prepareBallMovement(simulation, owned) {
  prepareSimulationDefenders(simulation);
  if (!owned && !simulation.referee.stoppage) updateSimulationBallChasers(simulation);
  if (simulation.ball.heldBy == null) prepareSimulationOwner(simulation);
  prepareSimulationKeepers(simulation);
  prepareSimulationShoulders(simulation);
  prepareSimulationFoulRestart(simulation);
  if (!owned) captureSimulationPlayerPositions(simulation);
}

function finishBallMovement(simulation, owned) {
  if (simulation.referee.stoppage) { finishSimulationFoulRestart(simulation); return; }
  if (simulation.ball.heldBy != null) { advanceSimulationKeeperPossession(simulation); recordSimulationPossessionTime(simulation); return; }
  recordSimulationCarryDistance(simulation);
  if (owned) finishSimulationOwnerStep(simulation);
  else advanceSimulationFreeBall(simulation);
  finishSimulationKeeperRush(simulation);
  recordSimulationShoulders(simulation);
  finishSimulationTackles(simulation);
  trackSimulationBeats(simulation);
  updateSimulationReferee(simulation);
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
  if (simulation.paused) return simulation;
  simulation.accumulator += input.seconds;
  const { stepSeconds, epsilon } = MATCH_SIM_DATA.clock;
  while (!simulation.paused && simulation.accumulator + epsilon >= stepSeconds) {
    stepSimulation(simulation, input.ball);
    simulation.accumulator = Math.max(0, simulation.accumulator - stepSeconds);
  }
  return simulation;
}

function simulationHasEnded(simulation, replayBall) {
  return replayBall === undefined && simulation.match.phase === 'ended';
}

function simulationStepStopped(simulation, replayBall) {
  return simulation.paused || simulationHasEnded(simulation, replayBall);
}

function prepareLiveSimulationStep(simulation, replayBall) {
  if (replayBall !== undefined) return false;
  applySimulationCommands(simulation);
  simulation.liveBall = true;
  const preparingHalf = simulation.match.phase === 'half';
  const prepared = prepareSimulationMatch(simulation) || preparePositionedSimulationRestart(simulation);
  if (prepared && (!preparingHalf || !simulation.clock.pauseHalfPreparation)) consumeSimulationFitness(simulation);
  return prepared;
}
