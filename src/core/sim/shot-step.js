import { controlSimulationBall } from './ball-possession.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall } from './ball-physics.js';
import { earliestSimulationBallContact } from './ball-contact.js';
import { simulationGoalFrameContact, reflectSimulationGoalFrame } from './goal-frame.js';
import { keeperShotContact } from './keeper-reaction.js';
import { saveSimulationShot } from './keeper-saves.js';
import { blockSimulationShot } from './shot-blocks.js';
import { markSimulationShotOnTarget } from './shot-execution.js';
import { recordSimulationGoal } from './match-lifecycle.js';
import { emitSimulationEvent } from './ball-events.js';
import { resolveSimulationBallOut, simulationBallExitFraction } from './ball-restart.js';

export function advanceSimulationShotBall(simulation) {
  let motion = { before: snapshotBall(simulation.ball), startTime: simulation.time - MATCH_SIM_DATA.clock.stepSeconds, seconds: MATCH_SIM_DATA.clock.stepSeconds };
  for (let count = 0; motion && count < MATCH_SIM_DATA.shooting.maxContactsPerStep; count++) motion = advanceShotSegment(simulation, motion);
  if (simulation.shooting) simulation.shooting.path.push({ ...simulation.ball.position });
}

function advanceShotSegment(simulation, motion) {
  const after = predictSimulationBall(motion.before, motion.seconds);
  Object.assign(simulation.ball, after);
  const segment = { ...motion, after };
  const contact = earliestShotContact(simulation, segment);
  const exit = simulationBallExitFraction({ before: motion.before, after, shot: true });
  if (contact && contact.fraction <= exit) return resolveShotContact(simulation, contact, segment);
  resolveShotGoalLine(simulation, segment);
  return null;
}

function earliestShotContact(simulation, motion) {
  const body = earliestSimulationBallContact(simulation, motion);
  const recovery = simulation.ball.shot.rebound || simulation.ball.shot.saved || body?.player.teamId === simulation.ball.shot.teamId;
  const candidates = [body ? { ...body, kind: recovery ? 'control' : 'block' } : null, keeperShotContact(simulation, motion), simulationGoalFrameContact(motion)].filter(Boolean);
  return candidates.sort((left, right) => left.fraction - right.fraction)[0] ?? null;
}

function resolveShotContact(simulation, contact, motion) {
  const time = motion.startTime + contact.fraction * motion.seconds, remaining = (1 - contact.fraction) * motion.seconds;
  if (contact.kind === 'control') return controlSimulationBall(simulation, contact, motion);
  if (contact.kind === 'block') return blockSimulationShot(simulation, contact, motion);
  if (contact.kind === 'frame') {
    const before = reflectSimulationGoalFrame(simulation, contact, { time, remaining });
    return { before, startTime: time, seconds: remaining };
  }
  if (saveSimulationShot(simulation, contact, remaining) && simulation.ball.heldBy == null) {
    // Continue the real parry on the next segment so a fingertip can still enter the goal in this step.
    const before = snapshotBall(simulation.ball);
    resolveShotGoalLine(simulation, { before: contact.touching, after: before, startTime: time, seconds: remaining });
  }
  return null;
}

function resolveShotGoalLine(simulation, motion) {
  const ball = simulation.ball, pitch = MATCH_SIM_DATA.pitch;
  const direction = Math.sign(ball.position.x), boundary = pitch.length / 2 + MATCH_SIM_DATA.ball.radius;
  if (!shotClearedGoalLine(simulation, motion)) { resolveSimulationBallOut(simulation, motion.before, motion); return; }
  const fraction = (direction * boundary - motion.before.position.x) / (ball.position.x - motion.before.position.x);
  const safeFraction = Math.max(0, Math.min(1, fraction));
  const touching = predictSimulationBall(motion.before, safeFraction * motion.seconds);
  const time = motion.startTime + safeFraction * motion.seconds;
  const inside = Math.abs(touching.position.y) + MATCH_SIM_DATA.ball.radius < pitch.goalWidth / 2 && touching.height + MATCH_SIM_DATA.ball.radius < pitch.goalHeight;
  const attacking = simulation.teams.find(team => team.id === ball.shot?.teamId)?.direction === direction;
  if (inside && attacking) { markSimulationShotOnTarget(simulation); recordSimulationGoal(simulation, { time, position: { x: direction * boundary, y: touching.position.y }, height: touching.height }); return; }
  if (ball.shot) emitSimulationEvent(simulation, { type: 'wide', time, fromId: ball.shot.fromId, fromPos: { ...motion.before.position }, toPos: { ...touching.position }, height: touching.height, success: false });
  resolveSimulationBallOut(simulation, motion.before, motion);
}

function snapshotBall(ball) {
  return { position: { ...ball.position }, velocity: { ...ball.velocity }, height: ball.height, verticalVelocity: ball.verticalVelocity };
}

function shotClearedGoalLine(simulation, motion) {
  const ball = simulation.ball;
  const boundary = MATCH_SIM_DATA.pitch.length / 2 + MATCH_SIM_DATA.ball.radius;
  if (Math.abs(ball.position.x) < boundary) return false;
  const fraction = (Math.sign(ball.position.x) * boundary - motion.before.position.x) / (ball.position.x - motion.before.position.x);
  return simulationBallExitFraction({ ...motion, shot: true }) >= fraction - MATCH_SIM_DATA.clock.epsilon;
}
