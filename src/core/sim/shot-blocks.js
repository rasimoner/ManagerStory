import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall } from './ball-physics.js';
import { emitSimulationEvent } from './ball-events.js';

export function blockSimulationShot(simulation, contact, motion) {
  const ball = simulation.ball, shot = ball.shot, player = contact.player;
  const touching = predictSimulationBall(motion.before, contact.fraction * motion.seconds);
  const time = motion.startTime + contact.fraction * motion.seconds;
  const previous = contact.previous;
  const position = { x: previous.x + (player.position.x - previous.x) * contact.fraction,
    y: previous.y + (player.position.y - previous.y) * contact.fraction };
  const offset = { x: touching.position.x - position.x, y: touching.position.y - position.y };
  const length = Math.hypot(offset.x, offset.y) || 1;
  const normal = { x: offset.x / length, y: offset.y / length };
  const dot = touching.velocity.x * normal.x + touching.velocity.y * normal.y;
  const restitution = MATCH_SIM_DATA.shooting.blockRestitution;
  const reflected = { ...touching, velocity: { x: (touching.velocity.x - 2 * dot * normal.x) * restitution,
    y: (touching.velocity.y - 2 * dot * normal.y) * restitution }, verticalVelocity: MATCH_SIM_DATA.shooting.blockLift };
  const remaining = (1 - contact.fraction) * motion.seconds;
  emitSimulationEvent(simulation, { type: 'block', time, fromId: player.id, toId: shot.fromId, fromPos: position, toPos: { ...touching.position }, height: touching.height, success: true });
  simulation.statistics.teams[player.teamId].blocks++;
  shot.assistId = null;
  shot.rebound = true;
  Object.assign(ball, predictSimulationBall(reflected, remaining), { ownerId: null, lastTouchId: player.id, lastTouchTeamId: player.teamId,
    excludedId: player.id, controlAfterTick: simulation.tick + player.limits.reactionTicks, assist: null, backpassTeamId: null });
  return { before: reflected, startTime: time, seconds: remaining };
}
