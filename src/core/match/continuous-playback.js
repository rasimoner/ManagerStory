import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { stepSimulation } from '../sim/simulation-step.js';
import { captureSimulationFrame } from './playback-frames.js';
import { simulationViewTempo, integrateSimulationViewRate, collectContinuousViewEvents } from './view-tempo.js';

export function createSimulationPlayback(simulation) {
  return { displaySeconds: simulation.time, currentRate: CAREER_SIM_DATA.continuous.quietRate,
    accumulatorSeconds: 0, criticalUntil: simulation.time, eventCursor: simulation.events.length, mode: 'quiet',
    frame: captureSimulationFrame(simulation), previousFrame: null,
    metrics: { realSeconds: 0, frames: 0, steps: 0, budgetLimitedFrames: 0, phaseSeconds: {} } };
}

export function advanceSimulationPlayback(playback, simulation, input) {
  if (!Number.isFinite(input.seconds) || input.seconds < 0) throw new RangeError('Invalid playback elapsed time.');
  const tempo = simulationViewTempo(simulation, playback);
  const gameSeconds = input.skip ? MATCH_SIM_DATA.match.fullSeconds - simulation.time
    : integrateSimulationViewRate(playback, { seconds: input.seconds, targetRate: tempo.rate * input.speed });
  playback.accumulatorSeconds += gameSeconds;
  const steps = advanceVisibleSimulation(playback, simulation, input.maxSteps);
  updateContinuousFrame(playback, simulation);
  recordContinuousMetrics(playback, { seconds: input.seconds, phase: tempo.phase, steps });
  playback.mode = input.skip ? 'skip' : tempo.phase;
  return { steps, ...readSimulationPlayback(playback) };
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
  playback.previousFrame = playback.frame;
  playback.frame = captureSimulationFrame(simulation);
  playback.displaySeconds = simulation.time;
}

function recordContinuousMetrics(playback, { seconds, phase, steps }) {
  playback.metrics.realSeconds += seconds;
  playback.metrics.frames++;
  playback.metrics.steps += steps;
  playback.metrics.phaseSeconds[phase] = (playback.metrics.phaseSeconds[phase] ?? 0) + seconds;
}

export function readSimulationPlayback(playback) {
  return { time: playback.displaySeconds, frame: playback.frame, previous: playback.previousFrame,
    alpha: 1, mode: playback.mode, rate: playback.currentRate };
}
