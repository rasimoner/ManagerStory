import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime, drawSimulationRandom } from './simulation-runtime.js';
import { evaluateSimulationShot } from './shot-evaluation.js';
import { endSimulationCarry } from './dribbling.js';
import { emitSimulationEvent } from './ball-events.js';
import { armSimulationKeepers } from './keeper-reaction.js';

export function requestSimulationShot(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId);
  if (!owner || simulation.ball.heldBy != null || simulation.match.phase === 'ended') throw new TypeError('A controlled foot ball is required for a shot.');
  releaseSimulationShot(simulation, owner, evaluateSimulationShot(simulation, owner));
}

export function releaseSimulationShot(simulation, owner, option) {
  endSimulationCarry(simulation);
  const ball = simulation.ball, fromPos = { ...ball.position };
  const flight = createShotFlight(simulation, owner, option);
  const assistId = ball.assist?.teamId === owner.teamId && ball.assist.toId === owner.id ? ball.assist.fromId : null;
  const eventIndex = emitSimulationEvent(simulation, { type: 'shot', fromId: owner.id, fromPos, toPos: { ...option.target },
    teamId: owner.teamId, xg: option.xg, power: Math.hypot(flight.velocity.x, flight.velocity.y), target: { ...option.target }, style: option.style, onTarget: false });
  Object.assign(ball, flight, { ownerId: null, heldBy: null, flight: null, carry: null, restart: null, excludedId: owner.id,
    controlAfterTick: simulation.tick + owner.limits.reactionTicks, lastTouchId: owner.id, lastTouchTeamId: owner.teamId,
    shot: { eventIndex, fromId: owner.id, teamId: owner.teamId, assistId, launchTick: simulation.tick, saved: false }, assist: null, backpassTeamId: null });
  const stats = simulation.statistics.teams[owner.teamId];
  stats.shots++; stats.xg += option.xg;
  simulation.shooting = { option, path: [fromPos], lastShotTick: simulation.tick };
  simulation.passing.selected = null;
  simulation.passing.requested = null;
  armSimulationKeepers(simulation);
}

function createShotFlight(simulation, owner, option) {
  const errors = shotErrors(simulation, owner, option);
  const dx = option.target.x - simulation.ball.position.x, dy = option.target.y - simulation.ball.position.y;
  const angle = Math.atan2(dy, dx) + errors.angle;
  const speed = option.power * errors.power;
  const seconds = Math.hypot(dx, dy) / speed;
  const height = option.target.height + errors.height;
  return { position: { ...simulation.ball.position }, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, height: 0,
    verticalVelocity: (height + MATCH_SIM_DATA.ball.gravity * seconds * seconds / 2) / seconds };
}

function shotErrors(simulation, owner, option) {
  const settings = MATCH_SIM_DATA.shooting, scale = MATCH_SIM_DATA.attributes.maximum;
  const skill = (owner.attributes.finishing + owner.attributes.technique + owner.attributes.composure) / (3 * scale);
  const angle = settings.minimumAngleError + (1 - skill) * settings.skillAngleError + option.pressure * settings.pressureAngleError
    + option.body.running * settings.runningAngleError + option.body.turn * settings.bodyAngleError;
  const power = settings.minimumPowerError + (1 - skill) * settings.skillPowerError;
  return { angle: (drawSimulationRandom(simulation) * 2 - 1) * angle,
    power: 1 + (drawSimulationRandom(simulation) * 2 - 1) * power,
    height: (drawSimulationRandom(simulation) * 2 - 1) * settings.heightError * (1 - skill + option.pressure + option.body.turn) };
}

export function markSimulationShotOnTarget(simulation) {
  const shot = simulation.ball.shot;
  if (!shot) return;
  const event = simulation.events[shot.eventIndex];
  if (!event.onTarget) { event.onTarget = true; simulation.statistics.teams[shot.teamId].shotsOnTarget++; }
}
