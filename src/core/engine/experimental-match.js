import { M } from '../state.js';
import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { stepSimulation } from '../sim/simulation-step.js';
import { commandSimulationTactics, commandSimulationInstruction, commandSimulationMotivation } from '../sim/team-commands.js';
import { mapCareerSimulationTactics } from '../match/career-input.js';
import { simulationPitchPercent } from '../match/career-events.js';
import { requestSimulationSubstitution, applySimulationCommands } from '../sim/substitutions.js';
import { pauseSimulation, resumeSimulation } from '../sim/simulation-checkpoint.js';
import { finalizeMatch } from './live-match.js';
import { userSquad } from './user-team.js';
import { prepareExperimentalSubstitute } from './experimental-input.js';
import { consumeExperimentalEvents } from './experimental-events.js';
import { synchronizeExperimentalPlayers, synchronizeExperimentalTeamStats } from './experimental-players.js';
import { createSimulationPlayback, advanceSimulationPlayback, readSimulationPlayback } from '../match/continuous-playback.js';
import { captureSimulationFrame, refreshPlaybackFrame } from '../match/playback-frames.js';

export function advanceExperimentalSeconds(seconds) {
  if (!experimentalCanAdvance()) return 0;
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid simulation elapsed time.');
  const simulation = M.simulation, half = simulation.match.half;
  const target = Math.min(MATCH_SIM_DATA.match.fullSeconds, simulation.time + seconds);
  const before = simulation.tick;
  while (simulation.time + CAREER_SIM_DATA.epsilon < target && !simulation.paused && simulation.match.phase !== 'ended') {
    stepSimulation(simulation);
    if (simulation.match.half !== half) break;
  }
  M.simulationPlayback = createSimulationPlayback(simulation);
  synchronizeExperimentalMatch({ time: simulation.time, frame: captureSimulationFrame(simulation), forcePlayers: true });
  return simulation.tick - before;
}

function experimentalCanAdvance() { return M?.experimental && !M.pause && !M.finished; }

export function advanceExperimentalFrame(seconds) {
  return advanceExperimentalPlayback(seconds);
}

export function advanceExperimentalPlayback(seconds, options = {}) {
  if (!experimentalCanAdvance()) return 0;
  const view = advanceSimulationPlayback(M.simulationPlayback, M.simulation, { seconds, speed: M.speed,
    maxSteps: options.maxSteps ?? CAREER_SIM_DATA.playback.maxSteps, skip: M.skipExperimental === true });
  synchronizeExperimentalMatch(view);
  releaseSkippedHalf();
  return view.steps;
}

export function synchronizeExperimentalMatch(input = {}) {
  let view = input.frame ? input : readSimulationPlayback(M.simulationPlayback);
  const revision = M.simulationImportantRevision, roster = M.simulationRosterRevision;
  consumeExperimentalEvents(view.time);
  if (roster !== M.simulationRosterRevision) {
    refreshPlaybackFrame(M.simulationPlayback, M.simulation);
    view = { ...view, frame: M.simulationPlayback.frame };
  }
  M.matchElapsedSeconds = view.time;
  M.min = Math.floor(view.time / CAREER_SIM_DATA.secondsPerMinute);
  M.simulationDisplayFrame = view.frame;
  M.simulationPlayback.mode = view.mode ?? M.simulationPlayback.mode;
  synchronizeExperimentalTeamStats(view);
  projectVisiblePlayers(view, input.forcePlayers || revision !== M.simulationImportantRevision || M.pause);
  synchronizeExperimentalPositions(view);
  if (M.simulation.match.phase === 'ended' && view.time >= MATCH_SIM_DATA.match.fullSeconds) finalizeMatch();
}

function projectVisiblePlayers(view, force) {
  const stamp = Math.floor(view.time / CAREER_SIM_DATA.playback.projectionSeconds);
  if (!force && M.simulationPlayerProjectionStamp === stamp) return;
  M.simulationPlayerProjectionStamp = stamp;
  synchronizeExperimentalPlayers(view);
}

function synchronizeExperimentalPositions(view) {
  const next = new Map((view.next?.players ?? []).map(player => [player.id, player.position]));
  const point = (position, target) => interpolateExperimentalPoint(position, target ?? position, view.alpha ?? 0);
  M.dynamicPositions = Object.fromEntries(view.frame.players.filter(player => !player.sentOff).map(player => [player.id, simulationPitchPercent(point(player.position, next.get(player.id)))]));
  [M.ballX, M.ballY] = simulationPitchPercent(point(view.frame.ball.position, view.next?.ball.position));
  M.ballOwner = view.frame.ball.ownerId;
  M.ballSide = view.frame.ball.teamId === 'user' ? 'user' : 'opp';
}

function interpolateExperimentalPoint(from, to, fraction) { return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction }; }

function releaseSkippedHalf() {
  if (!M.skipExperimental || M.reason !== 'half' || M.requiredSubstitution) return;
  M.pause = false;
  M.reason = '';
  M.lifecycle = 'RUNNING_SECOND_HALF';
  resumeExperimentalMatch();
}

export function skipExperimentalMatch() {
  if (!M?.experimental || M.finished || M.requiredSubstitution) return false;
  M.skipExperimental = true;
  releaseSkippedHalf();
  return true;
}

export function pauseExperimentalMatch() {
  if (!M?.experimental) return;
  pauseSimulation(M.simulation);
  synchronizeExperimentalPlayers({ time: M.matchElapsedSeconds, frame: M.simulationDisplayFrame });
}
export function resumeExperimentalMatch() {
  if (!M?.experimental) return;
  resumeSimulation(M.simulation);
}

export function queueExperimentalSubstitution(command) {
  const source = userSquad().find(player => player.id === command.inId);
  const player = prepareExperimentalSubstitute(source, 'user');
  requestSimulationSubstitution(M.simulation, { teamId: 'user', outId: command.outId, player });
  applySimulationCommands(M.simulation);
  refreshPlaybackFrame(M.simulationPlayback, M.simulation);
  synchronizeExperimentalMatch();
  return true;
}

export function applyExperimentalDecision(type, _text, data) {
  if (!M?.experimental || data.simulationEvent || M.finished) return;
  const handlers = { tactic: applyExperimentalTactic, order: applyExperimentalOrder, shout: applyExperimentalMotivation, teamTalk: applyExperimentalMotivation };
  handlers[type]?.(data, type);
}

function applyExperimentalTactic() { commandSimulationTactics(M.simulation, { teamId: 'user', tactics: mapCareerSimulationTactics(M) }); }
function applyExperimentalOrder(data) {
  if (data.playerId != null) commandSimulationInstruction(M.simulation, { teamId: 'user', playerId: data.playerId, key: M.orderKeys[data.playerId] ?? 'balanced' });
}
function applyExperimentalMotivation(_data, kind) { commandSimulationMotivation(M.simulation, { teamId: 'user', kind }); }
