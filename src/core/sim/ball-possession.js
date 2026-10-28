import { prepareTemporaryCornerPass } from './goal-line-restart.js';
import { keeperCanHandleSimulationBall, claimSimulationKeeperBall } from './keeper-possession.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue } from './geometry.js';
import { drawSimulationRandom, simulationRuntime } from './simulation-runtime.js';
import { beginSimTransition } from './simulation-phases.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { endSimulationCarry } from './dribbling.js';
import { predictSimulationBall } from './ball-physics.js';

const { hypot, max, sin, cos, atan2, ceil, abs } = Math;

export function controlSimulationBall(simulation, contact, motion) {
  const seconds = motion.seconds ?? MATCH_SIM_DATA.clock.stepSeconds;
  const touching = predictSimulationBall(motion.before, contact.fraction * seconds);
  const time = (motion.startTime ?? simulation.time - seconds) + contact.fraction * seconds;
  if (keeperCanHandleSimulationBall(simulation, contact.player, touching)) {
    Object.assign(simulation.ball, touching);
    claimSimulationKeeperBall(simulation, contact.player, { time });
    return null;
  }
  const returning = simulation.ball.carry?.playerId === contact.player.id;
  const success = returning || drawSimulationRandom(simulation) >= firstTouchRisk(contact.player, touching);
  recordSimulationTouch(simulation, contact, { touching, time, success });
  if (success) { acquireSimulationBall(simulation, contact.player); return null; }
  const remaining = (1 - contact.fraction) * seconds;
  const deflected = deflectSimulationBall(simulation, contact.player, { touching, remaining, time });
  return { before: deflected, seconds: remaining, startTime: time };
}

function firstTouchRisk(player, ball) {
  const settings = MATCH_SIM_DATA.ball.firstTouch, scale = MATCH_SIM_DATA.attributes.maximum;
  const speed = hypot(ball.velocity.x, ball.velocity.y, ball.verticalVelocity);
  const touchError = 1 - player.attributes.firstTouch / scale, techniqueError = 1 - player.attributes.technique / scale;
  return clampSimValue(touchError * (settings.baseRisk + settings.speedRisk * speed / settings.referenceSpeed) + techniqueError * settings.techniqueRisk, 0, settings.maximumRisk);
}

function recordSimulationTouch(simulation, contact, result) {
  const { player, fraction, previous } = contact;
  const flight = simulation.ball.flight;
  if (simulation.ball.backpassTeamId !== player.teamId) simulation.ball.backpassTeamId = null;
  const fromId = flight?.fromId ?? simulation.ball.lastTouchId;
  const toPos = { x: previous.x + (player.position.x - previous.x) * fraction, y: previous.y + (player.position.y - previous.y) * fraction };
  const event = { time: result.time, fromId, toId: player.id, fromPos: { ...result.touching.position }, toPos,
    success: result.success, height: result.touching.height, speed: hypot(result.touching.velocity.x, result.touching.velocity.y), passId: flight?.eventIndex ?? null };
  emitSimulationEvent(simulation, { type: 'firstTouch', ...event });
  if (flight && player.teamId !== flight.teamId) {
    emitSimulationEvent(simulation, { type: 'interception', ...event });
    if (result.success) simulation.statistics.teams[player.teamId].interceptions++;
  }
  settleSimulationPass(simulation, { position: result.touching.position, controlled: result.success, playerId: player.id, teamId: player.teamId, time: result.time });
  simulation.ball.flight = null;
}

export function acquireSimulationBall(simulation, player) {
  const ball = simulation.ball;
  const restart = ball.restart;
  const returning = ball.carry?.playerId === player.id;
  if (ball.teamId !== player.teamId) simulation.statistics.teams[player.teamId].ballWins++;
  if (ball.carry && !returning) endSimulationCarry(simulation);
  const ownerSinceTick = returning ? ball.carry.ownerSinceTick : simulation.tick;
  if (ball.teamId !== player.teamId) { ball.assist = null; ball.backpassTeamId = null; }
  ball.shot = null;
  if (ball.teamId !== player.teamId) beginSimTransition(simulation, player.teamId);
  Object.assign(ball, { ownerId: player.id, teamId: player.teamId, lastTouchId: player.id, lastTouchTeamId: player.teamId,
    ownerSinceTick, restart: null, excludedId: null, height: 0, verticalVelocity: 0 });
  if (!returning) {
    simulation.passing = { options: [], selected: null, requested: null, nextEvaluationTick: simulation.tick + player.limits.reactionTicks };
    simulation.ownerDecision.selected = null;
    simulation.statistics.teams[player.teamId].controls++;
  }
  followSimulationBallOwner(simulation);
  prepareTemporaryCornerPass(simulation, player, restart);
}

function deflectSimulationBall(simulation, player, { touching, remaining, time }) {
  const settings = MATCH_SIM_DATA.ball.firstTouch;
  const angle = atan2(touching.velocity.y, touching.velocity.x) + (drawSimulationRandom(simulation) * 2 - 1) * settings.deflectionAngle;
  const speed = max(settings.minimumDeflectionSpeed, hypot(touching.velocity.x, touching.velocity.y) * settings.deflectionSpeedFactor);
  const deflected = { ...touching, velocity: { x: cos(angle) * speed, y: sin(angle) * speed }, verticalVelocity: abs(touching.verticalVelocity) * settings.verticalDeflectionFactor };
  Object.assign(simulation.ball, predictSimulationBall(deflected, remaining), { ownerId: null, lastTouchId: player.id, lastTouchTeamId: player.teamId,
    excludedId: player.id, assist: null, controlAfterTick: simulation.tick + ceil(MATCH_SIM_DATA.ball.contactCooldownSeconds / MATCH_SIM_DATA.clock.stepSeconds) });
  emitSimulationEvent(simulation, { type: 'looseBall', time, fromId: player.id, fromPos: { ...touching.position }, toPos: { ...touching.position }, success: false });
  simulation.passing.options = [];
  return deflected;
}

export function followSimulationBallOwner(simulation) {
  const ball = simulation.ball, owner = simulationRuntime(simulation).byId.get(ball.ownerId);
  if (!owner) return;
  const offset = MATCH_SIM_DATA.ball.footOffset, pitch = MATCH_SIM_DATA.pitch;
  ball.position = { x: clampSimValue(owner.position.x + cos(owner.heading) * offset, -pitch.length / 2, pitch.length / 2),
    y: clampSimValue(owner.position.y + sin(owner.heading) * offset, -pitch.width / 2, pitch.width / 2) };
  ball.velocity = { ...owner.velocity };
  ball.height = ball.heldBy != null ? MATCH_SIM_DATA.goalkeeper.carryHeight : 0;
  ball.verticalVelocity = 0;
}
