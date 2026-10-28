import { endSimulationCarry } from './dribbling.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { validateSimBall } from './validation.js';
import { pointDistance } from './geometry.js';
import { simulationRuntime } from './simulation-runtime.js';
import { beginSimTransition } from './simulation-phases.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';

export function createSimulationBall(input) {
  return { position: { ...input.position }, teamId: input.teamId, ownerId: input.ownerId ?? null,
    velocity: { ...(input.velocity ?? { x: 0, y: 0 }) }, height: input.height ?? 0, verticalVelocity: input.verticalVelocity ?? 0,
    lastTouchId: input.ownerId ?? null, lastTouchTeamId: input.teamId, flight: null, restart: null, carry: null,
    ownerSinceTick: 0, controlAfterTick: 0, excludedId: null };
}

export function placeSimulationBall(simulation, input) {
  validateSimBall(input, simulation.teams);
  validateBallPhysics(input);
  validateBallOwner(simulation, input);
  settleSimulationPass(simulation, { position: simulation.ball.position, controlled: false });
  endSimulationCarry(simulation);
  emitSimulationEvent(simulation, { type: 'referee', fromId: simulation.ball.ownerId ?? null, toId: input.ownerId ?? null,
    fromPos: { ...simulation.ball.position }, toPos: { ...input.position }, success: true });
  if (simulation.ball.teamId !== input.teamId) beginSimTransition(simulation, input.teamId);
  simulation.ball = createSimulationBall(input);
  simulation.ownerDecision = { selected: null, forcedPlayerId: simulation.ownerDecision.forcedPlayerId };
  simulation.referee = { advantage: null, stoppage: null };
  simulation.ball.ownerSinceTick = simulation.tick;
  if (input.ownerId != null) simulation.statistics.teams[input.teamId].controls++;
  simulation.passing = { options: [], selected: null, requested: null, nextEvaluationTick: simulation.tick };
}

export function validateBallPhysics(ball) {
  const velocity = ball.velocity ?? { x: 0, y: 0 };
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) throw new TypeError('Ball velocity must be finite.');
  if (!Number.isFinite(ball.height ?? 0) || (ball.height ?? 0) < 0 || !Number.isFinite(ball.verticalVelocity ?? 0)) throw new RangeError('Invalid ball height or vertical velocity.');
}

export function validateBallOwner(simulation, ball) {
  if (ball.ownerId == null) return;
  const owner = simulationRuntime(simulation).byId.get(ball.ownerId);
  if (!owner || owner.teamId !== ball.teamId) throw new TypeError('Ball owner must belong to the identified team.');
  if (pointDistance(owner.position, ball.position) > MATCH_SIM_DATA.ball.controlRadius || (ball.height ?? 0) > MATCH_SIM_DATA.ball.reachableHeight) throw new RangeError('Ball owner must be within control reach.');
}
