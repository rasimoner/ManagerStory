import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { predictSimulationBall } from './ball-physics.js';
import { earliestSimulationBallContact } from './ball-contact.js';
import { controlSimulationBall } from './ball-possession.js';
import { resolveSimulationBallOut, simulationBallExitFraction } from './ball-restart.js';

export function advanceSimulationFreeBall(simulation) {
  const before = { position: { ...simulation.ball.position }, velocity: { ...simulation.ball.velocity },
    height: simulation.ball.height, verticalVelocity: simulation.ball.verticalVelocity };
  const after = predictSimulationBall(before, MATCH_SIM_DATA.clock.stepSeconds);
  Object.assign(simulation.ball, after);
  const contact = earliestSimulationBallContact(simulation, { before, after });
  let continuation = { before, startTime: simulation.time - MATCH_SIM_DATA.clock.stepSeconds, seconds: MATCH_SIM_DATA.clock.stepSeconds };
  if (contact && contact.fraction <= simulationBallExitFraction({ before, after })) continuation = controlSimulationBall(simulation, contact, { before, after }) ?? continuation;
  resolveSimulationBallOut(simulation, continuation.before, continuation);
}

export function recordSimulationPossessionTime(simulation) {
  const ball = simulation.ball, seconds = MATCH_SIM_DATA.clock.stepSeconds;
  if (!ball.restart) recordTeamPossession(simulation, seconds);
  const owner = simulationRuntime(simulation).byId.get(ball.ownerId);
  if (owner) simulation.statistics.teams[owner.teamId].controlSeconds += seconds;
}

function recordTeamPossession(simulation, seconds) {
  const statistics = simulation.statistics, teamId = simulation.ball.teamId;
  const team = statistics.teams[teamId];
  if (statistics.possessionTeamId !== teamId) { team.possessions++; statistics.possessionTeamId = teamId; }
  team.possessionSeconds += seconds;
}
