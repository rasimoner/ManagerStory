import { simulationRuntime } from './simulation-runtime.js';
import { simulationShotGoalProjection } from './shot-trajectory.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall } from './ball-physics.js';
import { clampSimValue } from './geometry.js';

export function armSimulationKeepers(simulation) {
  const shot = simulation.ball.shot;
  for (const team of simulation.teams) {
    if (team.id === shot.teamId) continue;
    const keeper = team.players.find(player => player.slot === 'GK' && !player.sentOff);
    if (keeper) armKeeper(simulation, keeper);
  }
}

function armKeeper(simulation, keeper) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  const reflexes = keeper.attributes.gk.reflexes / MATCH_SIM_DATA.attributes.maximum;
  const delay = settings.reactionMinimum + (1 - reflexes) * settings.reactionSkillSeconds
    + (keeper.keeper.setSeconds >= settings.setSeconds ? 0 : settings.unsetDelay);
  const ball = simulation.ball;
  const arrival = simulationShotGoalProjection(simulation) ?? ball;
  keeper.keeper = { ...keeper.keeper, shotIndex: ball.shot.eventIndex, reactionAt: simulation.time + delay,
    launchPosition: { ...keeper.position }, launchMode: keeper.keeper.mode, target: { ...arrival.position, height: arrival.height }, mode: 'reacting' };
  simulation.events[ball.shot.eventIndex].keeper = { set: keeper.keeper.setSeconds >= settings.setSeconds, reactionSeconds: delay,
    distance: Math.hypot(ball.position.x - keeper.position.x, ball.position.y - keeper.position.y),
    lateralDistance: Math.abs(arrival.position.y - keeper.position.y), contact: false, saved: false };
}

export function simulationKeeperReach(keeper, time) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  const reflexes = keeper.attributes.gk.reflexes / MATCH_SIM_DATA.attributes.maximum;
  const acceleration = keeper.attributes.acceleration / MATCH_SIM_DATA.attributes.maximum;
  const active = keeper.keeper.shotIndex == null ? 0 : Math.max(0, time - keeper.keeper.reactionAt);
  const extension = Math.min(settings.maximumDiveReach, active * (settings.diveSpeed + reflexes * settings.reflexDiveSpeed + acceleration * settings.accelerationDiveSpeed));
  return { horizontal: keeperBodyReach(keeper) + extension,
    vertical: Math.min(settings.maximumHeight, settings.standingHeight + active * settings.jumpSpeed), active };
}

export function keeperShotContact(simulation, motion) {
  const shot = simulation.ball.shot;
  if (!shot || shot.saved) return null;
  const team = simulation.teams.find(candidate => candidate.id !== shot.teamId);
  const keeper = team.players.find(player => player.slot === 'GK' && !player.sentOff);
  if (!keeper || keeper.keeper.shotIndex !== shot.eventIndex) return null;
  const previous = keeperSegmentStart(simulation, keeper, motion);
  const dx = motion.after.position.x - motion.before.position.x - keeper.position.x + previous.x;
  if (!dx) return null;
  const fraction = (previous.x - motion.before.position.x) / dx;
  if (fraction < 0 || fraction > 1) return null;
  const time = motion.startTime + fraction * motion.seconds;
  const touching = predictSimulationBall(motion.before, fraction * motion.seconds);
  const position = { x: previous.x + (keeper.position.x - previous.x) * fraction, y: previous.y + (keeper.position.y - previous.y) * fraction };
  const contact = evaluateKeeperReach(keeper, { touching, time, fraction, position });
  const telemetry = simulation.events[shot.eventIndex].keeper;
  Object.assign(telemetry, { arrival: true, extension: Math.max(0, Math.abs(touching.position.y - position.y) - keeperBodyReach(keeper)),
    availableReach: simulationKeeperReach(keeper, time).horizontal, timeToKeeper: time - simulation.events[shot.eventIndex].time });
  return contact;
}

function evaluateKeeperReach(keeper, { touching, time, fraction, position }) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  const reach = time < keeper.keeper.reactionAt ? { horizontal: keeperBodyReach(keeper), vertical: MATCH_SIM_DATA.ball.reachableHeight } : simulationKeeperReach(keeper, time);
  const horizontal = Math.abs(touching.position.y - position.y) / reach.horizontal;
  const vertical = Math.max(0, touching.height - settings.standingHeight) / Math.max(settings.handRadius, reach.vertical - settings.standingHeight);
  const difficulty = Math.hypot(horizontal, vertical);
  if (difficulty > 1 || touching.height > reach.vertical) return null;
  return { kind: 'keeper', player: keeper, fraction: clampSimValue(fraction, 0, 1), touching, time, difficulty, keeperPosition: position };
}

function keeperBodyReach(keeper) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  if (keeper.keeper.launchMode === 'rush') return settings.rushBodyReach + keeper.attributes.gk.oneOnOne / MATCH_SIM_DATA.attributes.maximum * settings.oneOnOneReach;
  return keeper.keeper.setSeconds >= settings.setSeconds ? settings.readyBodyReach : settings.bodyReach;
}

function keeperSegmentStart(simulation, keeper, motion) {
  const runtime = simulationRuntime(simulation), index = runtime.players.indexOf(keeper);
  const elapsed = 1 - motion.seconds / MATCH_SIM_DATA.clock.stepSeconds;
  const x = runtime.previousPositions[index * 2], y = runtime.previousPositions[index * 2 + 1];
  return { x: x + (keeper.position.x - x) * elapsed, y: y + (keeper.position.y - y) * elapsed };
}
