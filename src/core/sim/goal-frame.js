import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall } from './ball-physics.js';
import { emitSimulationEvent } from './ball-events.js';

export function simulationGoalFrameContact(motion) {
  const pitch = MATCH_SIM_DATA.pitch, radius = MATCH_SIM_DATA.ball.radius + pitch.goalPostRadius;
  let nearest = null;
  for (const direction of [-1, 1]) {
    const goalX = direction * pitch.length / 2;
    if (Math.min(Math.abs(motion.before.position.x - goalX), Math.abs(motion.after.position.x - goalX)) > Math.abs(motion.after.position.x - motion.before.position.x) + radius) continue;
    for (const side of [-1, 1]) {
      const contact = frameCylinderContact(motion, { x: goalX, y: side * pitch.goalWidth / 2, kind: 'post' });
      if (contact && (!nearest || contact.fraction < nearest.fraction)) nearest = contact;
    }
    const bar = frameCylinderContact(motion, { x: goalX, height: pitch.goalHeight, kind: 'crossbar' });
    if (bar && (!nearest || bar.fraction < nearest.fraction)) nearest = bar;
  }
  return nearest;
}

function frameCylinderContact(motion, frame) {
  const radius = MATCH_SIM_DATA.ball.radius + MATCH_SIM_DATA.pitch.goalPostRadius;
  const start = frameOffset(motion.before, frame), end = frameOffset(motion.after, frame);
  const dx = end.x - start.x, dy = end.y - start.y, squared = dx * dx + dy * dy;
  if (!squared) return null;
  const product = start.x * dx + start.y * dy;
  const discriminant = product * product - squared * (start.x * start.x + start.y * start.y - radius * radius);
  if (discriminant < 0) return null;
  const fraction = (-product - Math.sqrt(discriminant)) / squared;
  if (fraction < 0 || fraction > 1) return null;
  const touching = predictSimulationBall(motion.before, fraction * motion.seconds);
  if (frame.kind === 'post' ? touching.height > MATCH_SIM_DATA.pitch.goalHeight + radius : Math.abs(touching.position.y) > MATCH_SIM_DATA.pitch.goalWidth / 2 + radius) return null;
  return { kind: 'frame', frame, touching, fraction };
}

function frameOffset(ball, frame) {
  return { x: ball.position.x - frame.x, y: frame.kind === 'post' ? ball.position.y - frame.y : Math.max(MATCH_SIM_DATA.ball.radius, ball.height) - frame.height };
}

export function reflectSimulationGoalFrame(simulation, contact, timing) {
  const { touching, frame } = contact;
  const offset = frameOffset(touching, frame), length = Math.hypot(offset.x, offset.y) || 1;
  const normal = { x: offset.x / length, y: offset.y / length };
  const secondSpeed = frame.kind === 'post' ? touching.velocity.y : touching.verticalVelocity;
  const product = touching.velocity.x * normal.x + secondSpeed * normal.y;
  const factor = 1 + MATCH_SIM_DATA.shooting.postRestitution;
  const reflected = { ...touching, position: { ...touching.position }, velocity: { ...touching.velocity, x: touching.velocity.x - factor * product * normal.x } };
  if (frame.kind === 'post') reflected.velocity.y -= factor * product * normal.y;
  else reflected.verticalVelocity -= factor * product * normal.y;
  const shot = simulation.ball.shot;
  if (shot) { simulation.statistics.teams[shot.teamId].posts++; shot.assistId = null; shot.rebound = true; }
  emitSimulationEvent(simulation, { type: 'post', time: timing.time, fromId: shot?.fromId ?? simulation.ball.lastTouchId,
    fromPos: { ...touching.position }, toPos: { ...touching.position }, height: touching.height, kind: frame.kind, success: true });
  Object.assign(simulation.ball, predictSimulationBall(reflected, timing.remaining), { assist: null });
  return reflected;
}
