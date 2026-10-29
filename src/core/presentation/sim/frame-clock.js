import { M } from '../../state.js';
import CAREER_SIM_DATA from '../../../data/match-sim-career.json';

const budgets = new WeakMap();

export function prepareExperimentalFrame(seconds) {
  const settings = CAREER_SIM_DATA.playback;
  const budget = experimentalFrameBudget();
  const maxSteps = Math.max(1, Math.min(settings.maximumFrameSteps, Math.floor(settings.frameBudgetMs / budget.msPerStep)));
  return { seconds: Math.min(seconds, settings.maximumFrameSeconds), maxSteps, started: performance.now(), budget };
}

export function recordExperimentalFrame(frame, steps) {
  const settings = CAREER_SIM_DATA.playback, budget = frame.budget;
  const milliseconds = performance.now() - frame.started;
  budget.frames++;
  budget.totalMs += milliseconds;
  budget.maximumMs = Math.max(budget.maximumMs, milliseconds);
  if (steps) budget.msPerStep += (milliseconds / steps - budget.msPerStep) * settings.budgetSmoothing;
}

function experimentalFrameBudget() {
  if (!budgets.has(M)) budgets.set(M, { msPerStep: CAREER_SIM_DATA.playback.initialMsPerStep, frames: 0, totalMs: 0, maximumMs: 0 });
  return budgets.get(M);
}

export function readExperimentalFrameMetrics() {
  if (!M) return null;
  return { ...experimentalFrameBudget() };
}
