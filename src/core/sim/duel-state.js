import MATCH_SIM_DATA from '../../data/match-sim.json';

export function createSimulationDuelState() {
  return { state: 'idle', untilTick: 0, nextTackleTick: 0, nextPlanTick: 0, tackle: null };
}

export function simulationPlayerAvailable(player) {
  return !player.sentOff && player.duel?.state !== 'grounded';
}

export function simulationDurationTicks(seconds) {
  return Math.ceil(seconds / MATCH_SIM_DATA.clock.stepSeconds);
}

export function recoverSimulationDefender(simulation, player) {
  if (player.duel.state === 'grounded' && simulation.tick >= player.duel.untilTick) player.duel.state = 'idle';
  if (simulationPlayerAvailable(player)) return;
  player.target = { ...player.position };
  player.role = player.sentOff ? 'sentOff' : 'grounded';
  player.gait = 'walk';
}
