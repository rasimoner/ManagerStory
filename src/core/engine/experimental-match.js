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
  synchronizeExperimentalMatch();
  return simulation.tick - before;
}

function experimentalCanAdvance() { return M?.experimental && !M.pause && !M.finished; }

export function advanceExperimentalFrame(seconds) {
  return advanceExperimentalSeconds(seconds * CAREER_SIM_DATA.basicFastRate * M.speed);
}

export function synchronizeExperimentalMatch() {
  consumeExperimentalEvents();
  M.matchElapsedSeconds = M.simulation.time;
  M.min = Math.floor(M.simulation.time / CAREER_SIM_DATA.secondsPerMinute);
  synchronizeExperimentalTeamStats();
  synchronizeExperimentalPlayers();
  synchronizeExperimentalPositions();
  if (M.simulation.match.phase === 'ended') finalizeMatch();
}

function synchronizeExperimentalPositions() {
  const simulation = M.simulation;
  M.dynamicPositions = Object.fromEntries(simulation.teams.flatMap(team => team.players.filter(player => !player.sentOff).map(player => [player.id, simulationPitchPercent(player.position)])));
  [M.ballX, M.ballY] = simulationPitchPercent(simulation.ball.position);
  M.ballOwner = simulation.ball.ownerId ?? simulation.ball.carry?.playerId ?? null;
  M.ballSide = simulation.ball.teamId === 'user' ? 'user' : 'opp';
}

export function pauseExperimentalMatch() { if (M?.experimental) pauseSimulation(M.simulation); }
export function resumeExperimentalMatch() { if (M?.experimental) resumeSimulation(M.simulation); }

export function queueExperimentalSubstitution(command) {
  const source = userSquad().find(player => player.id === command.inId);
  const player = prepareExperimentalSubstitute(source, 'user');
  requestSimulationSubstitution(M.simulation, { teamId: 'user', outId: command.outId, player });
  applySimulationCommands(M.simulation);
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
