import { recoverSimulationDefender } from './duel-state.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { endSimulationCarry } from './dribbling.js';
import { acquireSimulationBall } from './ball-possession.js';
import { releaseSimulationPass } from './pass-execution.js';
import { integrateSimPlayer } from './player-movement.js';
import { pointDistance } from './geometry.js';

export function createSimulationMatch(input) {
  return { enabled: input.match === true, phase: input.match === true && input.ball.ownerId == null ? 'kickoff' : 'playing', half: 1,
    score: Object.fromEntries(input.teams.map(team => [team.id, 0])), kickoffTeamId: input.teams[0].id, phaseSinceTick: 0,
    firstKickoffTeamId: input.teams[0].id, restart: null };
}

export function prepareSimulationMatch(simulation) {
  const match = simulation.match;
  if (matchClockStopped(simulation)) return true;
  if (!match.enabled && match.phase !== 'goal') return false;
  if (match.phase === 'playing') return false;
  prepareKickoffPlayers(simulation);
  for (const team of simulation.teams) for (const player of team.players) { recoverSimulationDefender(simulation, player); integrateSimPlayer(player); }
  if (kickoffReady(simulation)) releaseSimulationKickoff(simulation);
  return true;
}

export function recordSimulationGoal(simulation, crossing) {
  const ball = simulation.ball, shot = ball.shot, match = simulation.match;
  if (!shot) return;
  undoUnsuccessfulSave(simulation, shot);
  match.score[shot.teamId]++;
  simulation.statistics.teams[shot.teamId].goals++;
  emitSimulationEvent(simulation, { type: 'goal', time: crossing.time, fromId: shot.fromId, toId: shot.assistId,
    fromPos: { ...simulation.events[shot.eventIndex].fromPos }, toPos: { ...crossing.position }, height: crossing.height,
    teamId: shot.teamId, assistId: shot.assistId, shotId: shot.eventIndex, success: true, score: { ...match.score } });
  const conceding = simulation.teams.find(team => team.id !== shot.teamId);
  stopSimulationAttack(simulation);
  match.kickoffTeamId = conceding.id;
  match.phaseSinceTick = simulation.tick;
  match.phase = 'goal';
  match.restart = null;
}

function beginSimulationHalf(simulation) {
  stopSimulationAttack(simulation);
  for (const team of simulation.teams) team.direction *= -1;
  Object.assign(simulation.match, { half: 2, phase: 'half', phaseSinceTick: simulation.tick, restart: null,
    kickoffTeamId: simulation.teams.find(team => team.id !== simulation.match.firstKickoffTeamId).id });
  emitSimulationEvent(simulation, { type: 'half', fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 }, success: true, half: 2 });
}

function endSimulationMatch(simulation) {
  stopSimulationAttack(simulation);
  simulation.match.phase = 'ended';
  emitSimulationEvent(simulation, { type: 'end', fromPos: { ...simulation.ball.position }, toPos: { ...simulation.ball.position }, success: true, score: { ...simulation.match.score } });
}

function stopSimulationAttack(simulation) {
  settleSimulationPass(simulation, { position: simulation.ball.position, controlled: false });
  endSimulationCarry(simulation);
  Object.assign(simulation.ball, { ownerId: null, heldBy: null, flight: null, shot: null, assist: null, carry: null, restart: null, velocity: { x: 0, y: 0 }, height: 0, verticalVelocity: 0 });
  simulation.referee.advantage = null;
  simulation.referee.stoppage = null;
  simulation.ownerDecision.selected = null;
  simulation.passing = { options: [], selected: null, requested: null, nextEvaluationTick: simulation.tick };
  for (const team of simulation.teams) for (const player of team.players) { player.duel.tackle = null; player.motionMode = null; }
}

function prepareKickoffPlayers(simulation) {
  const match = simulation.match;
  if (!match.restart) match.restart = kickoffParticipants(simulation);
  for (const team of simulation.teams) for (const player of team.players) {
    player.target = kickoffTarget(simulation, team, player);
    player.gait = 'sprint';
    player.motionMode = null;
  }
  simulation.ball.position = { x: 0, y: 0 };
  simulation.ball.teamId = match.kickoffTeamId;
}

function kickoffParticipants(simulation) {
  const team = simulation.teams.find(candidate => candidate.id === simulation.match.kickoffTeamId);
  const players = team.players.filter(player => player.slot !== 'GK' && !player.sentOff);
  const taker = players.reduce((best, player) => player.anchor.x > best.anchor.x ? player : best);
  const target = { x: -MATCH_SIM_DATA.match.kickoffReceiverBack * team.direction, y: MATCH_SIM_DATA.match.kickoffReceiverSide };
  const receiver = players.filter(player => player.id !== taker.id).reduce((best, player) => pointDistance(player.position, target) < pointDistance(best.position, target) ? player : best);
  return { takerId: taker.id, receiverId: receiver.id };
}

function kickoffTarget(simulation, team, player) {
  const settings = MATCH_SIM_DATA.match, restart = simulation.match.restart;
  if (player.id === restart.takerId) return { x: 0, y: 0 };
  if (player.id === restart.receiverId) return { x: -settings.kickoffReceiverBack * team.direction, y: settings.kickoffReceiverSide };
  if (player.slot === 'GK') return { x: (-MATCH_SIM_DATA.pitch.length / 2 + MATCH_SIM_DATA.goalkeeper.threatDepth) * team.direction, y: 0 };
  const localX = Math.min(-settings.kickoffOwnHalfMargin, player.anchor.x * MATCH_SIM_DATA.shape.attacking.length - MATCH_SIM_DATA.shape.attacking.length / 2);
  const y = player.anchor.y * MATCH_SIM_DATA.shape.defending.width;
  const x = team.id !== simulation.match.kickoffTeamId && Math.hypot(localX, y) < MATCH_SIM_DATA.pitch.centerCircleRadius + settings.kickoffPositionTolerance ? -MATCH_SIM_DATA.pitch.centerCircleRadius - settings.kickoffPositionTolerance : localX;
  return { x: x * team.direction, y };
}

function kickoffReady(simulation) {
  const settings = MATCH_SIM_DATA.match, match = simulation.match;
  const pause = match.phase === 'goal' ? settings.goalPauseSeconds : match.phase === 'half' ? settings.halfPauseSeconds : settings.kickoffMinimumSeconds;
  if ((simulation.tick - match.phaseSinceTick) * MATCH_SIM_DATA.clock.stepSeconds < pause || !kickoffPairSettled(simulation)) return false;
  return simulation.teams.every(team => team.players.filter(player => !player.sentOff).every(player => {
    const distance = pointDistance(player.position, player.target);
    const ownHalf = player.id === match.restart.takerId || player.position.x * team.direction <= MATCH_SIM_DATA.clock.epsilon;
    const outsideCircle = team.id === match.kickoffTeamId || Math.hypot(player.position.x, player.position.y) >= MATCH_SIM_DATA.pitch.centerCircleRadius;
    return distance <= Math.min(settings.kickoffPositionTolerance, MATCH_SIM_DATA.ball.controlRadius) && ownHalf && outsideCircle;
  }));
}

function releaseSimulationKickoff(simulation) {
  const team = simulation.teams.find(candidate => candidate.id === simulation.match.kickoffTeamId);
  const restart = simulation.match.restart;
  const taker = team.players.find(player => player.id === restart.takerId), receiver = team.players.find(player => player.id === restart.receiverId);
  acquireSimulationBall(simulation, taker);
  simulation.ball.position = { x: 0, y: 0 };
  emitSimulationEvent(simulation, { type: 'kickoff', fromId: taker.id, toId: receiver.id, teamId: team.id,
    fromPos: { x: 0, y: 0 }, toPos: { ...receiver.position }, success: true, half: simulation.match.half });
  releaseSimulationPass(simulation, taker, { toId: receiver.id, target: { ...receiver.position }, lofted: false });
  simulation.match.phase = 'playing';
  simulation.match.restart = null;
}

function matchClockStopped(simulation) {
  const match = simulation.match;
  if (!match.enabled) return false;
  if (simulation.time >= MATCH_SIM_DATA.match.fullSeconds) { endSimulationMatch(simulation); return true; }
  if (simulation.time >= MATCH_SIM_DATA.match.halfSeconds && match.half === 1) beginSimulationHalf(simulation);
  return false;
}

function undoUnsuccessfulSave(simulation, shot) {
  if (shot.saveEventIndex == null) return;
  const save = simulation.events[shot.saveEventIndex];
  const keeperTeam = simulation.teams.find(team => team.players.some(player => player.id === save.fromId));
  if (save.onTarget) simulation.statistics.teams[keeperTeam.id].saves--;
  save.success = false;
  save.goalAfterTouch = true;
}

function kickoffPairSettled(simulation) {
  const restart = simulation.match.restart;
  return simulation.teams.flatMap(team => team.players).filter(player => player.id === restart.takerId || player.id === restart.receiverId)
    .every(player => Math.hypot(player.velocity.x, player.velocity.y) <= MATCH_SIM_DATA.match.kickoffReadySpeed);
}
