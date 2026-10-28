import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { evaluateSimulationShot } from './shot-evaluation.js';

export function simulationPassChanceValue(simulation, pass, current) {
  if (!pass) return 0;
  const receiver = simulationRuntime(simulation).byId.get(pass.toId);
  const projected = evaluateSimulationShot(simulation, { ...receiver, position: pass.target });
  const improvement = Math.max(0, projected.xg - current.xg);
  return improvement * MATCH_SIM_DATA.shooting.passChanceWeight;
}
