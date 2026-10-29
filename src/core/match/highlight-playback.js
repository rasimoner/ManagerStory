import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { stepSimulation } from '../sim/simulation-step.js';
import { storePlaybackFrame, readPlaybackFrame } from './playback-frames.js';
import { collectHighlightWindows, advanceHighlightClock } from './highlight-windows.js';

export function createSimulationPlayback(simulation) {
  const playback = { displaySeconds: simulation.time, releasedHalf: simulation.match.half, frames: [], writeIndex: 0, count: 0,
    eventCursor: simulation.events.length, windows: [], mode: 'fast', danger: { inside: false, teamId: null, nextTime: 0 },
    metrics: { windows: 0, highlightSeconds: 0, fastSeconds: 0, steps: 0 } };
  storePlaybackFrame(playback, simulation);
  return playback;
}

export function advanceSimulationPlayback(playback, simulation, input) {
  if (!Number.isFinite(input.seconds) || input.seconds < 0) throw new RangeError('Invalid playback elapsed time.');
  const steps = input.skip ? skipPlayback(playback, simulation, input) : advanceBufferedClock(playback, simulation, input);
  playback.windows = playback.windows.filter(interval => interval.end >= playback.displaySeconds);
  return { steps, ...readSimulationPlayback(playback) };
}

function skipPlayback(playback, simulation, input) {
  const steps = fillSimulationLookahead(playback, simulation, { horizon: MATCH_SIM_DATA.match.fullSeconds, maxSteps: input.maxSteps });
  playback.displaySeconds = simulation.time;
  playback.mode = 'skip';
  return steps;
}

function advanceBufferedClock(playback, simulation, input) {
  const settings = CAREER_SIM_DATA.playback;
  const maximumSlice = (settings.maximumLookaheadSeconds - settings.lookaheadSeconds) / settings.quietRate;
  let remaining = input.seconds, steps = 0;
  while (remaining > CAREER_SIM_DATA.epsilon) {
    const seconds = Math.min(remaining, maximumSlice);
    const before = playback.displaySeconds;
    const horizon = before + settings.lookaheadSeconds + seconds * settings.quietRate;
    steps += fillSimulationLookahead(playback, simulation, { horizon, maxSteps: input.maxSteps - steps });
    advanceVisibleSlice(playback, simulation, { ...input, seconds });
    remaining -= seconds;
    if (playback.displaySeconds === before) break;
  }
  return steps;
}

function advanceVisibleSlice(playback, simulation, input) {
  const boundary = simulationPlaybackBlocked(playback, simulation);
  const limit = boundary ? simulation.time : Math.max(playback.displaySeconds, simulation.time - CAREER_SIM_DATA.playback.lookaheadSeconds);
  advanceHighlightClock(playback, { seconds: input.seconds, speed: input.speed, limit });
}

function fillSimulationLookahead(playback, simulation, { horizon, maxSteps }) {
  let steps = 0;
  while (steps < maxSteps && simulation.time + CAREER_SIM_DATA.epsilon < horizon && !simulationPlaybackBlocked(playback, simulation)) {
    stepSimulation(simulation);
    storePlaybackFrame(playback, simulation);
    collectHighlightWindows(playback, simulation);
    steps++;
  }
  playback.metrics.steps += steps;
  return steps;
}

function simulationPlaybackBlocked(playback, simulation) {
  return simulation.paused || simulation.match.phase === 'ended' || simulation.match.half > playback.releasedHalf;
}

export function readSimulationPlayback(playback) {
  const frame = readPlaybackFrame(playback, playback.displaySeconds);
  const next = readPlaybackFrame(playback, playback.displaySeconds + MATCH_SIM_DATA.clock.stepSeconds);
  const alpha = Math.max(0, Math.min(1, (playback.displaySeconds - frame.time) / MATCH_SIM_DATA.clock.stepSeconds));
  return { time: playback.displaySeconds, frame, next, alpha, mode: playback.mode };
}
