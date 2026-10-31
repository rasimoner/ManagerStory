import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { stepSimulation } from '../sim/simulation-step.js';
import { captureSimulationFrame } from './playback-frames.js';
import { simulationViewTempo, integrateSimulationViewRate, collectContinuousViewEvents } from './view-tempo.js';
import { usesNaturalMatchClock, simulationDurationSeconds } from '../sim/simulation-clock.js';
import MATCH_DURATION_DATA from '../../data/match-duration.json';

export function createSimulationPlayback(simulation) {
  const natural = usesNaturalMatchClock(simulation);
  return { displaySeconds: simulation.time, displayMatchSeconds: simulation.matchTime,
    currentRate: natural ? MATCH_DURATION_DATA.normalPlaybackRate : CAREER_SIM_DATA.continuous.quietRate,
    accumulatorSeconds: 0, criticalUntil: simulation.time, eventCursor: simulation.events.length, mode: natural ? 'natural' : 'quiet',
    frame: captureSimulationFrame(simulation), previousFrame: null,
    metrics: { realSeconds: 0, frames: 0, steps: 0, budgetLimitedFrames: 0, phaseSeconds: {} } };
}

export function advanceSimulationPlayback(playback, simulation, input) {
  if (!Number.isFinite(input.seconds) || input.seconds < 0) throw new RangeError('Invalid playback elapsed time.');
  const tempo = usesNaturalMatchClock(simulation) ? { phase: 'natural', rate: MATCH_DURATION_DATA.normalPlaybackRate } : simulationViewTempo(simulation, playback);
  const gameSeconds = simulationPlaybackSeconds(playback, simulation, { ...input, tempo });
  playback.accumulatorSeconds += gameSeconds;
  const steps = advanceVisibleSimulation(playback, simulation, input.maxSteps);
  updateContinuousFrame(playback, simulation);
  recordContinuousMetrics(playback, { seconds: input.seconds, phase: tempo.phase, steps });
  playback.mode = input.skip ? 'skip' : tempo.phase;
  return { steps, ...readSimulationPlayback(playback) };
}

function simulationPlaybackSeconds(playback, simulation, input) {
  if (input.skip) return Math.max(MATCH_SIM_DATA.clock.stepSeconds,
    simulationDurationSeconds(simulation) + simulation.clock.stoppedTicks * MATCH_SIM_DATA.clock.stepSeconds - simulation.time);
  if (usesNaturalMatchClock(simulation)) {
    playback.currentRate = input.speed;
    return input.seconds * input.speed;
  }
  return integrateSimulationViewRate(playback, { seconds: input.seconds, targetRate: input.tempo.rate * input.speed });
}

function advanceVisibleSimulation(playback, simulation, maxSteps) {
  const stepSeconds = MATCH_SIM_DATA.clock.stepSeconds, half = simulation.match.half;
  let steps = 0;
  while (playback.accumulatorSeconds + CAREER_SIM_DATA.epsilon >= stepSeconds && steps < maxSteps && !simulation.paused && simulation.match.phase !== 'ended') {
    stepSimulation(simulation);
    playback.accumulatorSeconds = Math.max(0, playback.accumulatorSeconds - stepSeconds);
    collectContinuousViewEvents(playback, simulation);
    steps++;
    if (simulation.match.half !== half) break;
  }
  settleContinuousBacklog(playback, simulation, simulation.match.half !== half);
  return steps;
}

function settleContinuousBacklog(playback, simulation, halfChanged) {
  const step = MATCH_SIM_DATA.clock.stepSeconds;
  if (simulation.paused || halfChanged || simulation.match.phase === 'ended') playback.accumulatorSeconds = 0;
  else if (playback.accumulatorSeconds > step) { playback.accumulatorSeconds = step; playback.metrics.budgetLimitedFrames++; }
}

function updateContinuousFrame(playback, simulation) {
  if (playback.frame.tick !== simulation.tick) {
    playback.previousFrame = playback.frame;
    playback.frame = captureSimulationFrame(simulation);
  }
  playback.displaySeconds = simulation.time;
  playback.displayMatchSeconds = simulation.matchTime;
}

function recordContinuousMetrics(playback, { seconds, phase, steps }) {
  playback.metrics.realSeconds += seconds;
  playback.metrics.frames++;
  playback.metrics.steps += steps;
  playback.metrics.phaseSeconds[phase] = (playback.metrics.phaseSeconds[phase] ?? 0) + seconds;
}

export function readSimulationPlayback(playback) {
  return { time: playback.displaySeconds, matchTime: playback.displayMatchSeconds, frame: playback.frame, previous: playback.previousFrame,
    alpha: 1, mode: playback.mode, rate: playback.currentRate };
}
