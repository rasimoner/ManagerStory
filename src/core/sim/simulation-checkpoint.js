import { simulationRuntime } from './simulation-runtime.js';
import { emitSimulationEvent } from './ball-events.js';
import { encodeSimulationCheckpoint, decodeSimulationCheckpoint } from './checkpoint-values.js';

export function snapshotSimulation(simulation) {
  const runtime = simulationRuntime(simulation);
  return encodeSimulationCheckpoint({ format: 1, state: simulation,
    runtime: { chaseTicks: [...runtime.chaseTicks], ownerPassScan: runtime.ownerPassScan ?? null } });
}

export function restoreSimulation(snapshot) {
  if (snapshot?.format !== 1 || !Number.isSafeInteger(snapshot.state?.tick) || !Array.isArray(snapshot.state?.teams)) {
    throw new TypeError('Unsupported simulation checkpoint.');
  }
  const decoded = decodeSimulationCheckpoint(snapshot);
  const simulation = decoded.state;
  const runtime = simulationRuntime(simulation);
  runtime.chaseTicks = new Map(decoded.runtime.chaseTicks);
  runtime.ownerPassScan = decoded.runtime.ownerPassScan;
  return simulation;
}

export function pauseSimulation(simulation) {
  if (simulation.paused) return;
  simulation.paused = true;
  emitSimulationEvent(simulation, { type: 'pause', tick: simulation.tick, success: true });
}

export function resumeSimulation(simulation) {
  if (!simulation.paused) return;
  simulation.paused = false;
  emitSimulationEvent(simulation, { type: 'resume', tick: simulation.tick, success: true });
}
