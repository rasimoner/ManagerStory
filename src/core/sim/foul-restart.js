import MATCH_SIM_DATA from '../../data/match-sim.json';
import { planningDistance } from './geometry.js';
import { simulationRuntime } from './simulation-runtime.js';
import { simulationPlayerAvailable, simulationDurationTicks } from './duel-state.js';
import { acquireSimulationBall } from './ball-possession.js';
import { releaseSimulationPass } from './pass-execution.js';
import { beginSimTransition } from './simulation-phases.js';
import { endSimulationCarry } from './dribbling.js';
import { beginSimulationRestart, usesPositionedSimulationRestarts } from './restart-state.js';

export function simulationFoulRestartPosition(position, defendingDirection, historical = false) {
  const pitch = MATCH_SIM_DATA.pitch;
  const front = pitch.length / 2 - pitch.penaltyDepth;
  const inside = -defendingDirection * position.x > front && Math.abs(position.y) < pitch.penaltyWidth / 2;
  if (!inside) return { position: { ...position }, penaltyPending: false };
  if (!historical) return { position: { x: -defendingDirection * (pitch.length / 2 - MATCH_SIM_DATA.deadBalls.penaltyDistance), y: 0 }, penaltyPending: true };
  // TEMPORARY until task 7: no penalty kick; restart just outside the nearest penalty-area edge.
  const clearance = MATCH_SIM_DATA.refereeing.restartClearance;
  const frontDistance = -defendingDirection * position.x - front;
  const sideDistance = pitch.penaltyWidth / 2 - Math.abs(position.y);
  const target = frontDistance <= sideDistance ? { x: -defendingDirection * (front - clearance), y: position.y }
    : { x: position.x, y: Math.sign(position.y || 1) * (pitch.penaltyWidth / 2 + clearance) };
  return { position: target, penaltyPending: true };
}

export function stopSimulationForFoul(simulation, foul) {
  if (usesPositionedSimulationRestarts(simulation)) { beginPositionedFoulRestart(simulation, foul); return; }
  const team = simulation.teams.find(candidate => candidate.id === foul.teamId);
  const taker = nearestAvailablePlayer(team.players, foul.restartPosition);
  endSimulationCarry(simulation);
  if (simulation.ball.teamId !== team.id) beginSimTransition(simulation, team.id);
  for (const player of simulationRuntime(simulation).players) {
    player.duel.tackle = null;
    if (player.duel.state === 'tackling') player.duel.state = 'idle';
  }
  simulation.referee.stoppage = { position: { ...foul.restartPosition }, foulPosition: { ...foul.toPos }, teamId: team.id,
    takerId: taker.id, readyTick: simulation.tick + simulationDurationTicks(MATCH_SIM_DATA.refereeing.restartMinimumSeconds), penaltyPending: foul.penaltyPending };
  Object.assign(simulation.ball, { position: { ...foul.restartPosition }, ownerId: null, teamId: team.id, velocity: { x: 0, y: 0 }, height: 0, verticalVelocity: 0,
    heldBy: null, shot: null, assist: null, backpassTeamId: null, flight: null, restart: { teamId: team.id, takerId: taker.id }, excludedId: null });
  simulation.passing.selected = null;
  simulation.passing.options = [];
}

function beginPositionedFoulRestart(simulation, foul) {
  beginSimulationRestart(simulation, { teamId: foul.teamId, position: foul.restartPosition, kind: foul.penaltyPending ? 'penalty' : 'freeKick' });
  const restart = simulation.ball.restart;
  simulation.referee.stoppage = { position: { ...restart.position }, foulPosition: { ...foul.toPos }, teamId: foul.teamId,
    takerId: restart.takerId, readyTick: simulation.tick + simulationDurationTicks(MATCH_SIM_DATA.refereeing.restartMinimumSeconds), penaltyPending: foul.penaltyPending };
}

function nearestAvailablePlayer(players, point) {
  return players.filter(simulationPlayerAvailable).reduce((best, player) => !best || planningDistance(player.position, point) < planningDistance(best.position, point) ? player : best, null);
}

export function prepareSimulationFoulRestart(simulation) {
  const stoppage = simulation.referee.stoppage;
  if (!stoppage) return false;
  for (const team of simulation.teams) for (const player of team.players) placeRestartTarget(player, stoppage);
  return true;
}

function placeRestartTarget(player, stoppage) {
  if (!simulationPlayerAvailable(player)) return;
  player.motionMode = null;
  if (player.id === stoppage.takerId) { player.target = { ...stoppage.position }; player.gait = 'run'; return; }
  const settings = MATCH_SIM_DATA.refereeing;
  const distance = planningDistance(player.position, stoppage.position);
  if (player.teamId === stoppage.teamId || distance >= settings.restartDistance + settings.restartClearance) return;
  const offsetX = player.position.x - stoppage.position.x, offsetY = player.position.y - stoppage.position.y;
  const angle = distance ? Math.atan2(offsetY, offsetX) : player.heading;
  player.target = legalRestartRetreat(stoppage.position, angle);
  player.gait = 'run';
}

export function finishSimulationFoulRestart(simulation) {
  if (usesPositionedSimulationRestarts(simulation)) return;
  const stoppage = simulation.referee.stoppage;
  if (!stoppage || simulation.tick < stoppage.readyTick) return;
  const taker = simulationRuntime(simulation).byId.get(stoppage.takerId);
  const settings = MATCH_SIM_DATA.refereeing;
  if (planningDistance(taker.position, stoppage.position) > settings.restartPositionTolerance) return;
  const opponents = simulation.teams.find(team => team.id !== stoppage.teamId).players.filter(player => !player.sentOff);
  const nearestOpponentDistance = Math.min(...opponents.map(player => planningDistance(player.position, stoppage.position)));
  if (nearestOpponentDistance < settings.restartDistance) return;
  const team = simulation.teams.find(candidate => candidate.id === stoppage.teamId);
  const receiver = nearestAvailablePlayer(team.players.filter(player => player.id !== taker.id), stoppage.position);
  acquireSimulationBall(simulation, taker);
  simulation.ball.position = { ...stoppage.position };
  releaseSimulationPass(simulation, taker, { toId: receiver.id, target: shortRestartTarget(stoppage.position, receiver.position), lofted: false });
  Object.assign(simulation.events.at(-1), { temporaryRestart: true, penaltyPending: stoppage.penaltyPending, nearestOpponentDistance });
  simulation.referee.stoppage = null;
}

function shortRestartTarget(from, to) {
  const distance = planningDistance(from, to);
  const fraction = Math.min(1, MATCH_SIM_DATA.refereeing.restartPassDistance / Math.max(1, distance));
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

function legalRestartRetreat(position, preferredAngle) {
  const settings = MATCH_SIM_DATA.refereeing, pitch = MATCH_SIM_DATA.pitch;
  const radius = settings.restartDistance + settings.restartClearance;
  for (let step = 0; step < settings.restartDirectionCount; step++) {
    const offset = Math.ceil(step / 2) * (step % 2 ? 1 : -1) * Math.PI * 2 / settings.restartDirectionCount;
    const target = { x: position.x + Math.cos(preferredAngle + offset) * radius, y: position.y + Math.sin(preferredAngle + offset) * radius };
    if (Math.abs(target.x) <= pitch.length / 2 - settings.restartClearance && Math.abs(target.y) <= pitch.width / 2 - settings.restartClearance) return target;
  }
  throw new RangeError('No legal free-kick retreat on the pitch.');
}
