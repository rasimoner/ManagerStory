import MATCH_SIM_DATA from '../../data/match-sim.json';
import MATCH_DURATION_DATA from '../../data/match-duration.json';

export function createSimulationClock(durationSeconds) {
  const { fullSeconds } = MATCH_SIM_DATA.match, { stepSeconds, epsilon } = MATCH_SIM_DATA.clock;
  const duration = durationSeconds === undefined ? fullSeconds : durationSeconds;
  const ticks = duration / stepSeconds;
  if (!Number.isFinite(duration) || Math.round(ticks) <= 0 || !Number.isSafeInteger(Math.round(ticks)) ||
      Math.abs(ticks - Math.round(ticks)) > epsilon || Math.round(ticks) % 2 !== 0) {
    throw new RangeError('Match duration must contain a positive, even number of physical steps.');
  }
  return { model: durationSeconds === undefined ? MATCH_DURATION_DATA.models.reference : MATCH_DURATION_DATA.models.natural,
    durationSeconds: duration, totalTicks: Math.round(ticks), activityTicks: { playing: 0, kickoff: 0, restart: 0 } };
}

export function usesNaturalMatchClock(simulation) {
  return simulation.clock?.model === MATCH_DURATION_DATA.models.natural;
}

export function simulationMatchSeconds(simulation, physicsSeconds = simulation.time) {
  const duration = simulation.clock?.durationSeconds ?? MATCH_SIM_DATA.match.fullSeconds;
  return Math.min(MATCH_SIM_DATA.match.fullSeconds, physicsSeconds * MATCH_SIM_DATA.match.fullSeconds / duration);
}

export function simulationDurationSeconds(simulation) {
  return simulation.clock?.durationSeconds ?? MATCH_SIM_DATA.match.fullSeconds;
}

export function simulationExposureRate(simulation) {
  return MATCH_SIM_DATA.match.fullSeconds / simulationDurationSeconds(simulation);
}

export function advanceSimulationClock(simulation) {
  simulation.tick++;
  simulation.time = simulation.tick * MATCH_SIM_DATA.clock.stepSeconds;
  simulation.physicsTime = simulation.time;
  // Integer ticks are the source of both clocks; the repeating 7-minute ratio never accumulates.
  simulation.matchTime = Math.min(MATCH_SIM_DATA.match.fullSeconds,
    simulation.tick * MATCH_SIM_DATA.match.fullSeconds / simulation.clock.totalTicks);
  const activity = simulation.match.phase !== 'playing' ? 'kickoff'
    : simulation.ball.restart || simulation.referee.stoppage ? 'restart' : 'playing';
  simulation.clock.activityTicks[activity]++;
}

export function restoreSimulationClock(simulation) {
  simulation.clock ??= createSimulationClock();
  simulation.physicsTime ??= simulation.time;
  simulation.matchTime ??= simulationMatchSeconds(simulation);
}
