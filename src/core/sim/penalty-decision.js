import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { evaluateSimulationShot, simulationShotBody } from './shot-evaluation.js';
import { simulationRuntime } from './simulation-runtime.js';

export function simulationPenaltyKeeperTarget(simulation, restart, keeper) {
  if (restart.kind !== 'penalty' || restart.stage !== 'runup' || keeper.slot !== 'GK' || keeper.teamId === restart.teamId) return null;
  const settings = RESTART_DATA.penalty;
  if (keeper.attributes.gk.oneOnOne < settings.anticipationSkill || simulation.time - restart.readyTime < keeper.limits.reactionSeconds) return null;
  const taker = simulationRuntime(simulation).byId.get(restart.takerId), line = Math.sign(restart.position.x) * MATCH_SIM_DATA.pitch.length / 2;
  const read = taker.position.y + Math.tan(taker.heading) * (line - taker.position.x);
  const limit = MATCH_SIM_DATA.pitch.goalWidth / 2 - MATCH_SIM_DATA.ball.radius;
  return { x: line, y: Math.max(-limit, Math.min(limit, read)) };
}

export function evaluateSimulationPenalty(simulation, taker) {
  const option = evaluateSimulationShot(simulation, taker), settings = RESTART_DATA.penalty;
  const keeper = simulation.teams.find(team => team.id !== taker.teamId).players.find(player => player.slot === 'GK' && !player.sentOff);
  const skilled = taker.attributes.technique >= settings.panenkaSkill && taker.attributes.composure >= settings.panenkaSkill;
  const committed = keeper && keeperCannotBrakeCentrally(keeper, settings);
  if (!skilled || !committed) return option;
  const target = { x: option.target.x, y: 0, height: settings.targetHeight };
  return { ...option, target, style: 'panenka', power: settings.speed, body: simulationShotBody(taker, target) };
}

function keeperCannotBrakeCentrally(keeper, settings) {
  const speed = keeper.velocity.y;
  const stoppingPosition = keeper.position.y + Math.sign(speed) * speed ** 2 / (2 * keeper.limits.acceleration);
  return Math.abs(speed) >= settings.commitSpeed && Math.abs(stoppingPosition) >= settings.commitDistance;
}
