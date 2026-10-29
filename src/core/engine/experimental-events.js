import { M } from '../state.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import { careerSimulationEvent } from '../match/career-events.js';
import { matchEvent, userSide } from './match-support.js';
import { pauseSimulation, resumeSimulation } from '../sim/simulation-checkpoint.js';
import { requestSimulationSubstitution, applySimulationCommands } from '../sim/substitutions.js';
import { experimentalSourcePlayer, experimentalOpponentBench, prepareExperimentalSubstitute } from './experimental-input.js';

const narrated = new Set(['goal', 'shot', 'save', 'post', 'wide', 'yellow', 'red', 'injury', 'half', 'kickoff', 'substitution', 'substitutionRequested', 'foul', 'ballOut', 'pass', 'interception', 'tackle']);

export function consumeExperimentalEvents(untilTime = M.simulation.time) {
  while (experimentalEventDue(untilTime)) {
    const event = M.simulation.events[M.simulationCursor++];
    if (event.type === 'yellow' && event.secondYellow) continue;
    M.matchElapsedSeconds = event.matchTime ?? event.time;
    M.min = Math.floor(M.matchElapsedSeconds / CAREER_SIM_DATA.secondsPerMinute);
    applyExperimentalEventState(event);
    if (!narrated.has(event.type)) continue;
    const converted = careerSimulationEvent(event, { names: M.simulationNames, teams: M.simulationTeams, userSide: userSide() });
    const recorded = matchEvent(converted.type, converted.text, converted.data);
    if (event.type === 'pass') {
      M.simulationPendingPasses ??= [];
      M.simulationPendingPasses.push({ sourceIndex: M.simulationCursor - 1, eventId: recorded.eventId });
    }
  }
  settleExperimentalPassEvents(untilTime);
}

function experimentalEventDue(untilTime) {
  return M.simulationCursor < M.simulation.events.length && M.simulation.events[M.simulationCursor].time <= untilTime;
}

function settleExperimentalPassEvents(untilTime) {
  M.simulationPendingPasses = (M.simulationPendingPasses ?? []).filter(pending => {
    const source = M.simulation.events[pending.sourceIndex];
    if (source.resolvedAt == null || source.resolvedAt > untilTime) return true;
    const event = M.events.find(candidate => candidate.eventId === pending.eventId);
    Object.assign(event, { success: source.success, resolvedAt: source.resolvedAt, actualToId: source.actualToId });
    return false;
  });
}

function applyExperimentalEventState(event) {
  recordExperimentalMetrics(event);
  if (['goal', 'shot', 'save', 'red', 'yellow', 'substitution', 'injury', 'half'].includes(event.type)) M.simulationImportantRevision = (M.simulationImportantRevision ?? 0) + 1;
  if (['red', 'substitution', 'injury'].includes(event.type)) M.simulationRosterRevision = (M.simulationRosterRevision ?? 0) + 1;
  const handlers = { yellow: recordExperimentalCard, red: recordExperimentalCard, injury: recordExperimentalInjury,
    substitution: recordExperimentalSubstitution, half: recordExperimentalHalf };
  handlers[event.type]?.(event);
}

function recordExperimentalMetrics(event) {
  if (event.type === 'shot' && event.xg >= CAREER_SIM_DATA.bigChanceXg) incrementExperimentalMetric('bigChances', event.teamId);
  if (event.type === 'ballOut') incrementExperimentalMetric('temporaryStoppages', event.restartTeamId);
}

function incrementExperimentalMetric(key, teamId) {
  if (!['user', 'opponent'].includes(teamId)) return;
  const side = teamId === 'user' ? userSide() : 1 - userSide();
  (M.stats[key] ??= [0, 0])[side]++;
}

function recordExperimentalCard(event) {
  const player = M.simulation.teams.flatMap(team => team.players).find(candidate => candidate.id === event.fromId);
  M.yellowByPlayer[event.fromId] = event.type === 'yellow' ? (M.yellowByPlayer[event.fromId] ?? 0) + 1 : event.secondYellow ? 2 : M.yellowByPlayer[event.fromId] ?? 0;
  if (event.type !== 'red') return;
  player.leftSeconds = event.time;
  if (player.teamId === 'user') { M.active = M.active.filter(id => id !== player.id); M.sentOff.push(player.id); }
  else M.oppIds = M.oppIds.filter(id => id !== player.id);
}

function recordExperimentalHalf() {
  M.secondHalf = true;
  M.pause = true;
  M.reason = 'half';
  M.lifecycle = 'HALF_TIME';
  pauseSimulation(M.simulation);
}

function recordExperimentalInjury(event) {
  const source = experimentalSourcePlayer(event.fromId);
  if (source) source.injury = MATCH_SIM_DATA.injuries.careerWeeks;
  if (event.teamId !== 'user') { replaceInjuredOpponent(event); return; }
  M.requiredSubstitution = { playerId: event.fromId, reason: 'injury', state: 'SUBSTITUTION_REQUIRED' };
  M.pause = true;
  M.reason = 'injury';
  M.lifecycle = 'PAUSED';
}

function replaceInjuredOpponent(event) {
  const bench = experimentalOpponentBench();
  const outgoing = experimentalSourcePlayer(event.fromId);
  const source = bench.find(player => player.position === outgoing?.position) ?? bench[0];
  M.oppIds = M.oppIds.filter(id => id !== event.fromId);
  if (source) {
    const id = 'o' + Object.keys(M.oppLineup).length;
    M.oppLineup[id] = source.id;
    const player = prepareExperimentalSubstitute({ ...source, id }, 'opponent');
    requestSimulationSubstitution(M.simulation, { teamId: 'opponent', outId: event.fromId, player });
    applySimulationCommands(M.simulation);
  }
  resumeSimulation(M.simulation);
}

function recordExperimentalSubstitution(event) {
  if (event.teamId !== 'user') { M.oppIds.push(event.toId); return; }
  const index = M.active.indexOf(event.fromId);
  if (index >= 0) M.active.splice(index, 1, event.toId);
  else M.active.push(event.toId);
  M.out.push(event.fromId);
  M.matchPositions[event.toId] = [...M.matchPositions[event.fromId]];
  M.matchRoles[event.toId] = M.matchRoles[event.fromId];
  M.substitutions.push({ minute: M.min, out: event.fromId, in: event.toId });
  if (M.requiredSubstitution?.playerId === event.fromId) M.requiredSubstitution = null;
}
