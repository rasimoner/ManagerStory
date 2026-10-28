import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { evaluateSimulationPass, evaluateSimulationPassOptions } from './pass-evaluation.js';

// Perception retains an outlet between scans; the current line is still rechecked every reaction and at release.
export function scanSimulationOwnerPasses(simulation, owner) {
  const runtime = simulationRuntime(simulation);
  const scan = runtime.ownerPassScan;
  if (canReuseOwnerScan(simulation, owner, scan)) {
    const current = evaluateSimulationPass(simulation, scan.best);
    if (current.safe && current.reachable) return { options: [current], visibleOptions: scan.options };
  }
  const options = evaluateSimulationPassOptions(simulation);
  runtime.ownerPassScan = { ownerId: owner.id, ownerSinceTick: simulation.ball.ownerSinceTick, best: null, options,
    nextTick: simulation.tick + owner.limits.reactionTicks * MATCH_SIM_DATA.ownerDecision.passScanReactions };
  return { options, visibleOptions: options };
}

function canReuseOwnerScan(simulation, owner, scan) {
  return scan?.ownerId === owner.id && scan.ownerSinceTick === simulation.ball.ownerSinceTick && scan.best != null && simulation.tick < scan.nextTick;
}

export function retainSimulationOwnerOutlet(simulation, pass) {
  const scan = simulationRuntime(simulation).ownerPassScan;
  if (scan) scan.best = pass;
}
