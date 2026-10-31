import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { integrateSimPlayer, faceSimulationPlayer } from './player-movement.js';
import { recoverSimulationDefender } from './duel-state.js';
import { simulationRestartLayout } from './restart-layout.js';
import { usesPositionedSimulationRestarts, nearestSimulationRestartPlayer } from './restart-state.js';
import { releasePositionedSimulationRestart } from './restart-release.js';
import { pointDistance } from './geometry.js';

export function preparePositionedSimulationRestart(simulation) {
  const restart = simulation.ball.restart;
  if (!restart || !usesPositionedSimulationRestarts(simulation)) return false;
  prepareRestartParticipants(simulation, restart);
  restart.targets ??= simulationRestartLayout(simulation, restart);
  for (const team of simulation.teams) for (const player of team.players) moveRestartPlayer(simulation, player, restart);
  if (restart.stage === 'ready') advanceRestartWindup(simulation, restart);
  else if (restartPlayersReady(simulation, restart)) beginRestartWindup(simulation, restart);
  return true;
}

function prepareRestartParticipants(simulation, restart) {
  const players = simulationRuntime(simulation).byId, team = simulation.teams.find(team => team.id === restart.teamId);
  const roster = simulation.teams.flatMap(team => team.players.map(player => player.id)).join(':');
  if (restart.roster !== roster) { restart.targets = null; restart.roster = roster; restart.stage = 'positioning'; simulation.ball.heldBy = null; }
  restart.position ??= { ...simulation.ball.position };
  restart.sinceTick ??= simulation.tick;
  restart.stage ??= 'positioning';
  if (!players.has(restart.takerId) || players.get(restart.takerId).sentOff) {
    restart.takerId = nearestSimulationRestartPlayer(team.players, restart.position).id;
    restart.targets = null;
  }
  if (!players.has(restart.receiverId) || players.get(restart.receiverId).sentOff) {
    restart.receiverId = nearestSimulationRestartPlayer(team.players.filter(player => player.id !== restart.takerId), restart.position).id;
    restart.targets = null;
  }
}

function moveRestartPlayer(simulation, player, restart) {
  player.motionMode = null;
  player.target = restart.targets[player.id] ?? { ...player.position };
  player.gait = 'run';
  player.role = 'restart';
  recoverSimulationDefender(simulation, player);
  const settled = pointDistance(player.position, player.target) <= MATCH_SIM_DATA.movement.arrivalRadius;
  integrateSimPlayer(player);
  if (!settled) return;
  faceSimulationPlayer(player, restartFacingTarget(simulation, player, restart));
}

function restartFacingTarget(simulation, player, restart) {
  const receiver = simulationRuntime(simulation).byId.get(restart.receiverId);
  const goal = { x: -simulation.teams.find(team => team.id !== restart.teamId).direction * MATCH_SIM_DATA.pitch.length / 2, y: 0 };
  return player.id === restart.takerId ? restart.kind === 'penalty' ? goal : receiver.position : restart.position;
}

function restartPlayersReady(simulation, restart) {
  if ((simulation.tick - restart.sinceTick) * MATCH_SIM_DATA.clock.stepSeconds < MATCH_SIM_DATA.refereeing.restartMinimumSeconds) return false;
  return simulation.teams.every(team => team.players.filter(player => !player.sentOff).every(player =>
    player.duel.state !== 'grounded' && pointDistance(player.position, player.target) <= MATCH_SIM_DATA.refereeing.restartPositionTolerance
    && Math.hypot(player.velocity.x, player.velocity.y) <= MATCH_SIM_DATA.match.kickoffReadySpeed && facingRestartTarget(simulation, player, restart)));
}

function facingRestartTarget(simulation, player, restart) {
  const target = restartFacingTarget(simulation, player, restart);
  const angle = Math.atan2(target.y - player.position.y, target.x - player.position.x) - player.heading;
  return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) <= MATCH_SIM_DATA.passing.angleTolerance;
}

function beginRestartWindup(simulation, restart) {
  restart.stage = 'ready';
  restart.readyTime = simulation.time;
  if (restart.kind !== 'throwIn') { releasePositionedSimulationRestart(simulation); return; }
  simulation.ball.heldBy = restart.takerId;
  simulation.ball.height = MATCH_SIM_DATA.goalkeeper.carryHeight;
}

function advanceRestartWindup(simulation, restart) {
  const settings = MATCH_SIM_DATA.deadBalls;
  const progress = Math.min(1, (simulation.time - restart.readyTime) / settings.throwWindupSeconds);
  simulation.ball.height = MATCH_SIM_DATA.goalkeeper.carryHeight + (settings.throwHeight - MATCH_SIM_DATA.goalkeeper.carryHeight) * progress;
  if (progress >= 1) releasePositionedSimulationRestart(simulation);
}
