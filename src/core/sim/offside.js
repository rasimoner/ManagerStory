import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { beginSimulationRestart } from './restart-state.js';

export function captureSimulationOffside(simulation, kicker, restartKind) {
  if (!simulation.clock.pauseHalfPreparation) return;
  if (['throwIn', 'goalKick', 'corner'].includes(restartKind)) { simulation.offside = null; return; }
  const team = simulation.teams.find(team => team.id === kicker.teamId), direction = team.direction;
  const defenders = simulation.teams.find(candidate => candidate.id !== team.id).players.filter(player => !player.sentOff);
  const line = defenders.map(player => player.position.x * direction).sort((left, right) => right - left)[1] ?? MATCH_SIM_DATA.pitch.length / 2;
  const threshold = Math.max(0, line, simulation.ball.position.x * direction);
  const candidates = team.players.filter(player => player.id !== kicker.id && !player.sentOff
    && player.position.x * direction > threshold + MATCH_SIM_DATA.clock.epsilon).map(player => player.id);
  simulation.offside = { teamId: team.id, fromId: kicker.id, tick: simulation.tick, lineX: line * direction, candidates };
}

export function penalizeSimulationOffsideTouch(simulation, player, { position, time }) {
  const pending = simulation.offside;
  if (!pending?.candidates.includes(player.id)) return false;
  whistleSimulationOffside(simulation, player, { position, time, reason: 'touch' });
  return true;
}

export function whistleSimulationOffside(simulation, offender, { position, time, reason }) {
  const pending = simulation.offside, team = simulation.teams.find(team => team.id !== offender.teamId);
  settleSimulationPass(simulation, { position, controlled: false, time });
  emitSimulationEvent(simulation, { type: 'offside', time, fromId: offender.id, teamId: offender.teamId,
    fromPos: { ...offender.position }, toPos: { ...position }, lineX: pending.lineX, kickTick: pending.tick, reason, success: false });
  beginSimulationRestart(simulation, { kind: 'freeKick', indirect: true, teamId: team.id, position });
  simulation.offside = null;
}

export function clearSimulationOffsideOnControl(simulation, player) {
  if (simulation.offside && simulation.offside.teamId !== player.teamId) simulation.offside = null;
}

export function simulationOffsideInterference(simulation) {
  const pending = simulation.offside;
  if (!pending || simulation.ball.restart) return false;
  const attack = simulation.teams.find(team => team.id === pending.teamId), defense = simulation.teams.find(team => team.id !== pending.teamId);
  for (const player of attack.players) {
    if (!pending.candidates.includes(player.id)) continue;
    const reason = challengesForBall(simulation, player, defense) ? 'challenge' : screensKeeper(simulation, player, defense) ? 'screen' : null;
    if (!reason) continue;
    whistleSimulationOffside(simulation, player, { position: player.position, time: simulation.time, reason });
    return true;
  }
  return false;
}

function screensKeeper(simulation, player, defense) {
  if (!simulation.ball.shot) return false;
  const keeper = defense.players.find(opponent => opponent.slot === 'GK' && !opponent.sentOff);
  if (!keeper) return false;
  const settings = RESTART_DATA.offside, ball = simulation.ball.position;
  const dx = ball.x - keeper.position.x, dy = ball.y - keeper.position.y, length = Math.hypot(dx, dy);
  if (!length) return false;
  const px = player.position.x - keeper.position.x, py = player.position.y - keeper.position.y;
  const along = (px * dx + py * dy) / length, across = Math.abs(px * dy - py * dx) / length;
  return along > 0 && along < Math.min(length, settings.screenDistance) && across < settings.screenWidth;
}

export function simulationDeliberateOpponentPlay(simulation, player, { touching, time }) {
  const pending = simulation.offside, flight = simulation.ball.flight;
  if (!pending || pending.teamId === player.teamId || !flight) return false;
  const prepared = time - flight.launchTick * MATCH_SIM_DATA.clock.stepSeconds >= player.limits.reactionSeconds;
  return prepared && touching.height <= RESTART_DATA.offside.deliberateHeight
    && Math.hypot(touching.velocity.x, touching.velocity.y) <= RESTART_DATA.offside.deliberateSpeed;
}

function challengesForBall(simulation, player, defense) {
  const ball = simulation.ball, settings = RESTART_DATA.offside;
  if (ball.height > MATCH_SIM_DATA.ball.reachableHeight) return false;
  const dx = ball.position.x - player.position.x, dy = ball.position.y - player.position.y, distance = Math.hypot(dx, dy);
  if (distance > settings.challengeDistance || player.velocity.x * dx + player.velocity.y * dy <= 0) return false;
  return defense.players.some(opponent => !opponent.sentOff && Math.hypot(opponent.position.x - ball.position.x, opponent.position.y - ball.position.y) < settings.challengeDistance);
}
