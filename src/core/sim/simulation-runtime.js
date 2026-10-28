import { R } from '../random.js';

// Runtime indices and the generator belong to one simulation, never to the career or a snapshot.
const runtimes = new WeakMap();

export function simulationRuntime(simulation) {
  let runtime = runtimes.get(simulation);
  if (!runtime) {
    const players = simulation.teams.flatMap(team => team.players);
    runtime = { random: R(simulation.seed), players, byId: new Map(players.map(player => [player.id, player])),
      previousPositions: new Float64Array(players.length * 2), chaseTicks: new Map() };
    runtimes.set(simulation, runtime);
  }
  return runtime;
}

export function drawSimulationRandom(simulation) {
  const random = simulationRuntime(simulation).random;
  const value = random();
  simulation.rngState = random.state;
  return value;
}
