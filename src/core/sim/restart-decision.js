import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { evaluateSimulationShot } from './shot-evaluation.js';
import { simulationRuntime } from './simulation-runtime.js';
import { pointDistance } from './geometry.js';

export function planSimulationRestart(simulation, restart) {
  const taker = simulationRuntime(simulation).byId.get(restart.takerId);
  const shot = evaluateSimulationShot(simulation, taker);
  const settings = RESTART_DATA.freeKick;
  if (restart.kind === 'penalty') return { kind: 'direct', target: shot.target };
  if (restart.kind !== 'freeKick') return { kind: 'short' };
  const skill = (taker.attributes.technique + taker.attributes.finishing) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const direct = shot.distance <= settings.maximumDistance && shot.distance >= settings.minimumDistance
    && shot.angle >= settings.minimumGoalAngle && skill >= settings.minimumSkill
    && shot.blocked <= settings.maximumBlockedFraction;
  return direct ? { kind: 'direct', target: shot.target } : { kind: 'short' };
}

export function simulationRestartStrikePosition(restart) {
  const target = restart.delivery?.target;
  if (!target) return { ...restart.position };
  const distance = pointDistance(restart.position, target);
  const offset = restart.stage === 'runup' ? MATCH_SIM_DATA.ball.footOffset : RESTART_DATA.runup.distance;
  return { x: restart.position.x - (target.x - restart.position.x) / distance * offset,
    y: restart.position.y - (target.y - restart.position.y) / distance * offset };
}

export function simulationFreeKickShot(simulation, taker) {
  const option = evaluateSimulationShot(simulation, taker), settings = RESTART_DATA.freeKick;
  return { ...option, style: 'freeKick', power: settings.minimumSpeed + taker.attributes.strength / MATCH_SIM_DATA.attributes.maximum * settings.strengthSpeed };
}
