import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { evaluateSimulationShot } from './shot-evaluation.js';
import { simulationRuntime } from './simulation-runtime.js';
import { pointDistance } from './geometry.js';
import { planSimulationCross } from './cross-delivery.js';

export function planSimulationRestart(simulation, restart) {
  const taker = simulationRuntime(simulation).byId.get(restart.takerId);
  const shot = evaluateSimulationShot(simulation, taker);
  if (restart.kind === 'penalty') return { kind: 'direct', target: shot.target };
  if (restart.kind === 'corner') return planSimulationCross(simulation, taker);
  if (restart.kind !== 'freeKick') return { kind: 'short' };
  return freeKickDelivery(simulation, taker, { restart, shot });
}

function freeKickDelivery(simulation, taker, { restart, shot }) {
  const settings = RESTART_DATA.freeKick;
  const skill = (taker.attributes.technique + taker.attributes.finishing) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const direct = !restart.indirect && shot.distance <= settings.maximumDistance && shot.distance >= settings.minimumDistance
    && shot.angle >= settings.minimumGoalAngle && skill >= settings.minimumSkill + shot.blocked * settings.blockedSkillCost
    && shot.blocked <= settings.maximumBlockedFraction;
  if (direct) return { kind: 'direct', target: shot.target };
  return shot.distance <= RESTART_DATA.delivery.maximumFreeKickDistance && Math.abs(restart.position.y) >= RESTART_DATA.delivery.wideFreeKickY
    ? planSimulationCross(simulation, taker) : { kind: 'short' };
}

export function simulationRestartStrikePosition(restart) {
  const target = restart.delivery?.target;
  if (!target) return { ...restart.position };
  const distance = pointDistance(restart.position, target);
  const offset = restart.stage === 'runup' ? MATCH_SIM_DATA.ball.footOffset : RESTART_DATA.runup.distance;
  const pitch = MATCH_SIM_DATA.pitch;
  return { x: Math.max(-pitch.length / 2, Math.min(pitch.length / 2, restart.position.x - (target.x - restart.position.x) / distance * offset)),
    y: Math.max(-pitch.width / 2, Math.min(pitch.width / 2, restart.position.y - (target.y - restart.position.y) / distance * offset)) };
}

export function simulationFreeKickShot(simulation, taker) {
  const option = evaluateSimulationShot(simulation, taker), settings = RESTART_DATA.freeKick;
  return { ...option, style: 'freeKick', power: settings.minimumSpeed + taker.attributes.strength / MATCH_SIM_DATA.attributes.maximum * settings.strengthSpeed };
}
