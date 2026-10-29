import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import { simulationExposureRate } from '../sim/simulation-clock.js';

export function simulationPlayerRatings(simulation, input = {}) {
  const untilTime = input.time ?? simulation.time;
  const players = [...simulation.teams.flatMap(team => team.players), ...simulation.departed].filter(player => (player.enteredSeconds ?? 0) <= untilTime);
  const frames = new Map((input.frame?.players ?? []).map(player => [player.id, player]));
  const rows = Object.fromEntries(players.map(player => [player.id, createPlayerRow(player, frames.get(player.id), simulationExposureRate(simulation))]));
  for (const event of simulation.events) {
    if (event.time <= untilTime) rateSimulationEvent(rows, event.resolvedAt > untilTime ? { ...event, success: null } : event, players);
  }
  for (const row of Object.values(rows)) row.rating = Math.max(CAREER_SIM_DATA.rating.minimum, Math.min(CAREER_SIM_DATA.rating.maximum, row.rating));
  return rows;
}

function createPlayerRow(player, frame, exposureRate) {
  return { rating: CAREER_SIM_DATA.rating.base, goals: 0, assists: 0, shots: 0, saves: 0,
    minutes: Math.floor(((frame?.playedSeconds ?? player.workload.playedSeconds) * exposureRate + CAREER_SIM_DATA.epsilon) / CAREER_SIM_DATA.secondsPerMinute),
    touches: 0, passesAttempted: 0, passesCompleted: 0, keyPasses: 0, dribblesAttempted: 0, dribbles: 0,
    tacklesAttempted: 0, tackles: 0, runs: 0, distanceKm: (frame?.distanceMetres ?? player.workload.distanceMetres) / 1000 };
}

function rateSimulationEvent(rows, event, players) {
  const row = rows[event.fromId], weights = CAREER_SIM_DATA.rating;
  if (row) rateActor(row, event, weights);
  if (event.type === 'interception' && event.success && rows[event.toId]) rows[event.toId].rating += weights.ballWin;
  if (event.type === 'firstTouch' && rows[event.toId]) rows[event.toId].touches++;
  if (event.type !== 'goal') return;
  rateGoalContributors(rows, event, players);
}

function rateGoalContributors(rows, event, players) {
  const weights = CAREER_SIM_DATA.rating;
  if (rows[event.assistId]) { rows[event.assistId].assists++; rows[event.assistId].keyPasses++; rows[event.assistId].rating += weights.assist; }
  for (const player of players) {
    if (player.slot !== 'GK' || player.teamId === event.teamId || !playerPresentAtGoal(player, event)) continue;
    rows[player.id].rating += weights.concededKeeper;
  }
}

function rateActor(row, event, weights) {
  const actions = {
    goal: () => { row.goals++; row.rating += weights.goal; },
    shot: () => { row.shots++; row.rating += weights.shot + (event.onTarget ? weights.onTarget : 0); },
    save: () => { if (event.success && event.onTarget) { row.saves++; row.rating += weights.save; } },
    pass: () => ratePass(row, event, weights),
    tackle: () => rateTackle(row, event, weights),
    yellow: () => { row.rating += weights.yellow; }, red: () => { row.rating += weights.red; },
    looseBall: () => { row.rating += weights.error; },
    dribble: () => { row.dribblesAttempted++; }, beat: () => { row.dribbles++; },
  };
  actions[event.type]?.();
}

function ratePass(row, event, weights) {
  row.passesAttempted++;
  if (event.success) { row.passesCompleted++; row.rating += weights.completedPass; }
  else if (event.success === false) row.rating += weights.failedPass;
}

function rateTackle(row, event, weights) {
  row.tacklesAttempted++;
  if (event.contact === 'ball' && !event.bodyContact) { row.tackles++; row.rating += weights.tackle; }
}

function playerPresentAtGoal(player, event) {
  return (player.enteredSeconds ?? 0) <= event.time && (player.leftSeconds ?? Infinity) >= event.time;
}
