import { prepareTemporaryCornerPass } from './goal-line-restart.js';
import { keeperCanHandleSimulationBall, claimSimulationKeeperBall } from './keeper-possession.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue } from './geometry.js';
import { drawSimulationRandom, simulationRuntime } from './simulation-runtime.js';
import { beginSimTransition } from './simulation-phases.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { endSimulationCarry } from './dribbling.js';
import { predictSimulationBall } from './ball-physics.js';
import { beginSimulationControl, followSimulationControl, simulationControlKind, usesContinuousSimulationControl } from './first-control.js';
import { penalizeSimulationOffsideTouch, clearSimulationOffsideOnControl, simulationDeliberateOpponentPlay, captureSimulationOffside } from './offside.js';
import { redirectSimulationAerial } from './aerial-contact.js';
import { simulationFirstTouchStyle } from './first-touch-technique.js';
import { holdSimulationPassBall } from './pass-technique.js';
import { usesNaturalMatchClock } from './simulation-clock.js';

const { hypot, max, min, sin, cos, atan2, ceil, abs } = Math;

export function controlSimulationBall(simulation, contact, motion) {
  const seconds = motion.seconds ?? MATCH_SIM_DATA.clock.stepSeconds;
  const touching = predictSimulationBall(motion.before, contact.fraction * seconds);
  const time = (motion.startTime ?? simulation.time - seconds) + contact.fraction * seconds;
  if (penalizeSimulationOffsideTouch(simulation, contact.player, { position: contact.player.position, time })) return null;
  if (simulationDeliberateOpponentPlay(simulation, contact.player, { touching, time })) simulation.offside = null;
  if (redirectSimulationAerial(simulation, contact.player, { touching, time })) return null;
  if (keeperCanHandleSimulationBall(simulation, contact.player, touching)) {
    Object.assign(simulation.ball, touching);
    claimSimulationKeeperBall(simulation, contact.player, { time });
    return null;
  }
  const returning = simulation.ball.carry?.playerId === contact.player.id;
  const success = returning || drawSimulationRandom(simulation) >= firstTouchRisk(contact.player, touching);
  recordSimulationTouch(simulation, contact, { touching, time, success });
  if (success) { completeSimulationControl(simulation, contact, { touching, time }); return null; }
  const remaining = (1 - contact.fraction) * seconds;
  const deflected = deflectSimulationBall(simulation, contact.player, { touching, remaining, time });
  return { before: deflected, seconds: remaining, startTime: time };
}

function completeSimulationControl(simulation, contact, result) {
  acquireSimulationBall(simulation, contact.player);
  if (!usesContinuousSimulationControl(simulation)) return;
  beginSimulationControl(simulation, contact, result);
  followSimulationBallOwner(simulation);
  captureSimulationOffside(simulation, contact.player);
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
  emitSimulationEvent(simulation, { type: 'firstTouch', ...event,
    ...(usesContinuousSimulationControl(simulation) ? { kind: simulationControlKind(result.touching.height), ...specialFirstTouch(simulation, player, result.touching) } : {}) });
  if (flight && player.teamId !== flight.teamId) {
    emitSimulationEvent(simulation, { type: 'interception', ...event });
    if (result.success) simulation.statistics.teams[player.teamId].interceptions++;
  }
  settleSimulationPass(simulation, { position: result.touching.position, controlled: result.success, playerId: player.id, teamId: player.teamId, time: result.time });
  simulation.ball.flight = null;
}

function specialFirstTouch(simulation, player, touching) {
  const style = simulationFirstTouchStyle(simulation, player, touching);
  return style ? { style } : {};
}

export function acquireSimulationBall(simulation, player) {
  clearSimulationOffsideOnControl(simulation, player);
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
  if (usesContinuousSimulationControl(simulation)) ball.control = null;
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
  if (holdSimulationPassBall(simulation)) return;
  const offset = usesNaturalMatchClock(simulation) ? carryOffset(owner) : MATCH_SIM_DATA.ball.footOffset, pitch = MATCH_SIM_DATA.pitch;
  const direction = usesNaturalMatchClock(simulation) ? carryDirection(owner, ball.position) : owner.heading;
  const target = { x: clampSimValue(owner.position.x + cos(direction) * offset, -pitch.length / 2, pitch.length / 2),
    y: clampSimValue(owner.position.y + sin(direction) * offset, -pitch.width / 2, pitch.width / 2) };
  if (followSimulationControl(simulation, owner, target)) return;
  ball.position = usesNaturalMatchClock(simulation) && ball.heldBy == null ? carriedBallPosition(ball.position, owner, target) : target;
  ball.velocity = { ...owner.velocity };
  ball.height = ball.heldBy != null ? MATCH_SIM_DATA.goalkeeper.carryHeight : 0;
  ball.verticalVelocity = 0;
}

// The ball stays under a carrier who is turning on the spot, and slides to his stride only once he moves; it never orbits him.
function carriedBallPosition(current, owner, target) {
  const settings = MATCH_SIM_DATA.ball, speed = hypot(owner.velocity.x, owner.velocity.y);
  const planted = speed < settings.carryPlantedSpeed && hypot(current.x - owner.position.x, current.y - owner.position.y) <= settings.carryPlantedRadius;
  if (planted) return current;
  const step = (speed + settings.carryCatchUpSpeed) * MATCH_SIM_DATA.clock.stepSeconds;
  const distance = hypot(target.x - current.x, target.y - current.y);
  if (distance <= step) return target;
  return { x: current.x + (target.x - current.x) * step / distance, y: current.y + (target.y - current.y) * step / distance };
}

// A runner pushes the ball along his path; a carrier turning on the spot keeps it where it lies, so it never orbits him.
function carryDirection(owner, ball) {
  const settings = MATCH_SIM_DATA.ball;
  if (hypot(owner.velocity.x, owner.velocity.y) >= settings.carryPathSpeed) return atan2(owner.velocity.y, owner.velocity.x);
  const x = ball.x - owner.position.x, y = ball.y - owner.position.y, distance = hypot(x, y);
  return distance > settings.carryMinimumRadius && distance <= settings.carryPlantedRadius ? atan2(y, x) : owner.heading;
}

// A running carrier plays the ball a little ahead of his stride instead of under his feet.
function carryOffset(owner) {
  const settings = MATCH_SIM_DATA.ball;
  return settings.footOffset + settings.carryLeadMetres * min(1, hypot(owner.velocity.x, owner.velocity.y) / settings.carryLeadSpeed);
}
