import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue } from './geometry.js';

export function simulationControlKind(height) {
  const settings = MATCH_SIM_DATA.ball.firstTouch;
  return height >= settings.headHeight ? 'head' : height >= settings.chestHeight ? 'chest' : 'foot';
}

export function beginSimulationControl(simulation, contact, result) {
  const { player, fraction, previous } = contact, ball = simulation.ball;
  const position = { x: previous.x + (player.position.x - previous.x) * fraction,
    y: previous.y + (player.position.y - previous.y) * fraction };
  ball.control = { time: result.time, offset: { x: result.touching.position.x - position.x, y: result.touching.position.y - position.y },
    height: result.touching.height, verticalVelocity: -Math.abs(result.touching.verticalVelocity) * MATCH_SIM_DATA.ball.firstTouch.controlVerticalRetention };
}

export function followSimulationControl(simulation, owner, target) {
  const ball = simulation.ball, control = ball.control;
  if (!control) return false;
  const settings = MATCH_SIM_DATA.ball.firstTouch, elapsed = Math.max(0, simulation.time - control.time);
  const remaining = Math.exp(-elapsed * settings.controlFollowRate);
  const x = target.x - owner.position.x, y = target.y - owner.position.y;
  ball.position = { x: clampSimValue(owner.position.x + x + (control.offset.x - x) * remaining, -MATCH_SIM_DATA.pitch.length / 2, MATCH_SIM_DATA.pitch.length / 2),
    y: clampSimValue(owner.position.y + y + (control.offset.y - y) * remaining, -MATCH_SIM_DATA.pitch.width / 2, MATCH_SIM_DATA.pitch.width / 2) };
  ball.height = Math.max(0, control.height + control.verticalVelocity * elapsed - MATCH_SIM_DATA.ball.gravity * elapsed ** 2 / 2);
  ball.verticalVelocity = ball.height > 0 ? control.verticalVelocity - MATCH_SIM_DATA.ball.gravity * elapsed : 0;
  ball.velocity = { x: owner.velocity.x + (x - control.offset.x) * remaining * settings.controlFollowRate,
    y: owner.velocity.y + (y - control.offset.y) * remaining * settings.controlFollowRate };
  if (!ball.height && Math.hypot(ball.position.x - target.x, ball.position.y - target.y) <= settings.controlSettleMetres) ball.control = null;
  return true;
}

export function usesContinuousSimulationControl(simulation) {
  // Old reference checkpoints promise their recorded physical outcome, including the former control rule.
  return simulation.clock.pauseHalfPreparation;
}
