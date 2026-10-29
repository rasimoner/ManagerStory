import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { evaluateSimulationShot } from '../sim/shot-evaluation.js';

export function collectHighlightWindows(playback, simulation) {
  while (playback.eventCursor < simulation.events.length) addEventWindow(playback, simulation.events[playback.eventCursor++]);
  addDangerousAttackWindow(playback, simulation);
}

function addEventWindow(playback, event) {
  const settings = CAREER_SIM_DATA.playback;
  if (event.type === 'half' || event.type === 'end') { addHighlightWindow(playback, { start: event.time - settings.boundaryPreSeconds, end: event.time, type: event.type }); return; }
  if (!settings.importantTypes.includes(event.type) && !event.penaltyPending) return;
  addHighlightWindow(playback, { start: Math.max(0, event.time - settings.preSeconds), end: event.time + settings.postSeconds, type: event.type });
}

export function addHighlightWindow(playback, interval) {
  const previous = playback.windows.at(-1);
  if (previous && previous.end >= interval.start) { previous.end = Math.max(previous.end, interval.end); return; }
  playback.windows.push(interval);
  playback.metrics.windows++;
}

function addDangerousAttackWindow(playback, simulation) {
  const settings = CAREER_SIM_DATA.playback, ball = simulation.ball;
  const team = simulation.teams.find(candidate => candidate.id === ball.teamId);
  const depth = MATCH_SIM_DATA.pitch.length / 2 - ball.position.x * team.direction;
  const inside = depth < settings.dangerDepth && Math.abs(ball.position.y) < settings.dangerWidth / 2 && !!(ball.ownerId != null || ball.carry);
  const entered = inside && (!playback.danger.inside || playback.danger.teamId !== team.id);
  if (entered && simulation.time >= playback.danger.nextTime && dangerousSimulationChance(simulation)) {
    addHighlightWindow(playback, { start: Math.max(0, simulation.time - settings.preSeconds), end: simulation.time + settings.postSeconds, type: 'dangerousAttack' });
    playback.danger.nextTime = simulation.time + settings.dangerCooldownSeconds;
  }
  Object.assign(playback.danger, { inside, teamId: team.id });
}

function dangerousSimulationChance(simulation) {
  const id = simulation.ball.ownerId ?? simulation.ball.carry?.playerId;
  const player = simulation.teams.flatMap(team => team.players).find(candidate => candidate.id === id);
  return player && evaluateSimulationShot(simulation, player).xg >= CAREER_SIM_DATA.playback.dangerMinimumXg;
}

export function advanceHighlightClock(playback, input) {
  let remaining = input.seconds;
  while (remaining > CAREER_SIM_DATA.epsilon && playback.displaySeconds < input.limit) {
    const interval = playback.windows.find(candidate => candidate.end > playback.displaySeconds + CAREER_SIM_DATA.epsilon);
    const highlighted = interval && interval.start <= playback.displaySeconds + CAREER_SIM_DATA.epsilon;
    const rate = highlighted ? input.speed : CAREER_SIM_DATA.playback.quietRate;
    const boundary = Math.min(input.limit, interval ? highlighted ? interval.end : interval.start : input.limit);
    const seconds = Math.min(remaining, (boundary - playback.displaySeconds) / rate);
    playback.displaySeconds = Math.min(boundary, playback.displaySeconds + seconds * rate);
    remaining -= seconds;
    if (playback.metrics) playback.metrics[highlighted ? 'highlightSeconds' : 'fastSeconds'] += seconds;
  }
  playback.mode = playback.windows.some(interval => interval.start <= playback.displaySeconds && interval.end > playback.displaySeconds) ? 'highlight' : 'fast';
  return playback.displaySeconds;
}
