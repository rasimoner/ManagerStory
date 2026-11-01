import MATCH_SIM_DATA from '../../data/match-sim.json';
import { emitSimulationEvent } from './ball-events.js';
import { acquireSimulationBall } from './ball-possession.js';
import { releaseSimulationPass } from './pass-execution.js';
import { releaseSimulationShot } from './shot-execution.js';
import { evaluateSimulationPenalty } from './penalty-decision.js';
import { simulationRuntime } from './simulation-runtime.js';
import { pointDistance } from './geometry.js';
import { simulationShortRestartTarget } from './restart-layout.js';
import { simulationFreeKickShot } from './restart-decision.js';
import { reactSimulationWall } from './wall-reaction.js';
import RESTART_DATA from '../../data/match-sim-restarts.json';

export function releasePositionedSimulationRestart(simulation) {
  const restart = simulation.ball.restart, players = simulationRuntime(simulation).byId;
  const taker = players.get(restart.takerId), receiver = players.get(restart.receiverId);
  const opponents = simulation.teams.find(team => team.id !== restart.teamId).players.filter(player => !player.sentOff);
  const nearestOpponentDistance = Math.min(...opponents.map(player => pointDistance(player.position, restart.position)));
  acquireSimulationBall(simulation, taker);
  Object.assign(simulation.ball, { position: { ...restart.position }, heldBy: null, height: 0, verticalVelocity: 0 });
  emitSimulationEvent(simulation, { type: restart.kind, kind: restart.delivery?.kind, fromId: taker.id, toId: receiver.id, teamId: restart.teamId,
    fromPos: { ...restart.position }, toPos: { ...receiver.position }, success: true, temporaryRestart: false, nearestOpponentDistance });
  if (restart.kind === 'penalty') releasePenalty(simulation, taker);
  else if (restart.kind === 'freeKick' && restart.delivery.kind === 'direct') releaseFreeKick(simulation, taker);
  else releaseRestartPass(simulation, { taker, receiver, restart });
  simulation.referee.stoppage = null;
  reactSimulationWall(simulation, restart);
}

function releaseFreeKick(simulation, taker) {
  releaseSimulationShot(simulation, taker, simulationFreeKickShot(simulation, taker));
  simulation.ball.shot.freeKick = true;
  Object.assign(simulation.events[simulation.ball.shot.eventIndex], { restartKind: 'freeKick' });
}

function releaseRestartPass(simulation, { taker, receiver, restart }) {
  if (restart.delivery?.kind === 'cross') {
    const lead = RESTART_DATA.delivery.leadSeconds;
    releaseSimulationPass(simulation, taker, { toId: receiver.id, lofted: true, cross: true, restartKind: restart.kind,
      target: { x: receiver.position.x + receiver.velocity.x * lead, y: receiver.position.y + receiver.velocity.y * lead } });
    return;
  }
  const distance = restart.kind === 'goalKick' ? MATCH_SIM_DATA.deadBalls.goalKickDistance : MATCH_SIM_DATA.refereeing.restartPassDistance;
  releaseSimulationPass(simulation, taker, { toId: receiver.id, lofted: false, restartKind: restart.kind,
    target: simulationShortRestartTarget(restart.position, receiver.position, distance) });
  Object.assign(simulation.events.at(-1), { restartKind: restart.kind, temporaryRestart: false });
  if (restart.kind !== 'throwIn') return;
  const ball = simulation.ball, settings = MATCH_SIM_DATA.deadBalls;
  ball.height = settings.throwHeight;
  ball.verticalVelocity = settings.throwVerticalSpeed;
  const factor = settings.throwSpeed / Math.hypot(ball.velocity.x, ball.velocity.y);
  ball.velocity.x *= factor; ball.velocity.y *= factor;
}

function releasePenalty(simulation, taker) {
  releaseSimulationShot(simulation, taker, evaluateSimulationPenalty(simulation, taker));
  simulation.ball.shot.penalty = true;
  Object.assign(simulation.events.at(-1), { penalty: true, restartKind: 'penalty' });
}
