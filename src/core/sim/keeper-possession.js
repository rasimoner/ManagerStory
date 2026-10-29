import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationPenaltyAreaContains } from './keeper-positioning.js';
import { acquireSimulationBall } from './ball-possession.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { simulationRuntime } from './simulation-runtime.js';
import { releaseSimulationPass } from './pass-execution.js';
import { simulationPassFlight } from './ball-physics.js';
import { pointDistance } from './geometry.js';

export function keeperCanHandleSimulationBall(simulation, keeper, touching) {
  const team = simulation.teams.find(candidate => candidate.id === keeper.teamId);
  return keeper.slot === 'GK' && simulation.ball.backpassTeamId !== team.id && simulationPenaltyAreaContains(team, touching.position)
    && Math.hypot(touching.velocity.x, touching.velocity.y, touching.verticalVelocity) <= MATCH_SIM_DATA.goalkeeper.claimSpeed;
}

export function claimSimulationKeeperBall(simulation, keeper, result = {}) {
  settleSimulationPass(simulation, { position: simulation.ball.position, controlled: true, playerId: keeper.id, teamId: keeper.teamId, time: result.time });
  acquireSimulationBall(simulation, keeper);
  Object.assign(simulation.ball, { heldBy: keeper.id, heldSinceTick: simulation.tick, shot: null, assist: null, backpassTeamId: null,
    flight: null, carry: null, height: MATCH_SIM_DATA.goalkeeper.carryHeight });
  keeper.keeper.mode = 'holding';
  emitSimulationEvent(simulation, { type: 'keeperClaim', time: result.time ?? simulation.time, fromId: keeper.id, fromPos: { ...simulation.ball.position },
    toPos: { ...simulation.ball.position }, success: true, kind: result.kind ?? 'loose' });
}

export function advanceSimulationKeeperPossession(simulation) {
  const ball = simulation.ball;
  const keeper = simulationRuntime(simulation).byId.get(ball.heldBy);
  if (!keeper) return;
  ball.position = { ...keeper.position };
  ball.velocity = { ...keeper.velocity };
  ball.height = MATCH_SIM_DATA.goalkeeper.carryHeight;
  const waiting = (simulation.tick - ball.heldSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  if (waiting >= MATCH_SIM_DATA.goalkeeper.holdSeconds) distributeKeeperBall(simulation, keeper);
}

function distributeKeeperBall(simulation, keeper) {
  const team = simulation.teams.find(candidate => candidate.id === keeper.teamId), settings = MATCH_SIM_DATA.goalkeeper;
  const receiver = keeperOutlet(team, keeper);
  const distance = pointDistance(keeper.position, receiver.position);
  const kind = keeper.instruction === 'longGK' ? 'punt' : distance <= settings.distributionDistance ? 'throw' : 'punt';
  const target = { ...receiver.position };
  simulation.ball.heldBy = null;
  releaseSimulationPass(simulation, keeper, { toId: receiver.id, target, lofted: kind === 'punt' });
  const flight = simulationPassFlight(keeper.position, target, kind === 'punt');
  const speed = kind === 'throw' ? settings.throwSpeed : settings.puntSpeed;
  const factor = speed / Math.hypot(flight.velocity.x, flight.velocity.y);
  simulation.ball.velocity = { x: flight.velocity.x * factor, y: flight.velocity.y * factor };
  simulation.ball.height = settings.carryHeight;
  simulation.ball.verticalVelocity = kind === 'punt' ? settings.puntVerticalSpeed : 0;
  simulation.ball.backpassTeamId = null;
  keeper.keeper.mode = 'distribution';
  emitSimulationEvent(simulation, { type: 'keeperDistribution', fromId: keeper.id, toId: receiver.id, fromPos: { ...keeper.position }, toPos: target, kind, success: true });
}

function keeperOutlet(team, keeper) {
  const candidates = team.players.filter(player => player.slot !== 'GK' && !player.sentOff);
  const preferred = MATCH_SIM_DATA.instructions[keeper.instruction]?.distributionDistance ?? MATCH_SIM_DATA.goalkeeper.distributionDistance;
  return candidates.reduce((best, player) => Math.abs(pointDistance(player.position, keeper.position) - preferred) < Math.abs(pointDistance(best.position, keeper.position) - preferred) ? player : best);
}
