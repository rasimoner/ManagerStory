import { simulationShotProjectsInsideGoal } from './shot-trajectory.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { drawSimulationRandom } from './simulation-runtime.js';
import { emitSimulationEvent } from './ball-events.js';
import { claimSimulationKeeperBall } from './keeper-possession.js';
import { simulationPenaltyAreaContains } from './keeper-positioning.js';
import { markSimulationShotOnTarget } from './shot-execution.js';
import { predictSimulationBall } from './ball-physics.js';

export function saveSimulationShot(simulation, contact, remaining) {
  const { player, touching, time, difficulty } = contact;
  const team = simulation.teams.find(candidate => candidate.id === player.teamId);
  if (!simulationPenaltyAreaContains(team, touching.position)) return false;
  const onTarget = simulationShotProjectsInsideGoal(simulation, touching);
  if (onTarget) markSimulationShotOnTarget(simulation);
  const kind = keeperSaveKind(simulation, contact);
  if (onTarget) simulation.statistics.teams[player.teamId].saves++;
  simulation.ball.shot.saved = true;
  simulation.events[simulation.ball.shot.eventIndex].keeper.contact = true;
  simulation.events[simulation.ball.shot.eventIndex].keeper.saved = onTarget;
  simulation.ball.shot.assistId = null;
  const timing = keeperSaveTiming(contact);
  const recordedDifficulty = Math.max(difficulty, timing.lastMoment ? MATCH_SIM_DATA.goalkeeper.lastMomentDifficulty : 0);
  player.keeper.lastSave = { kind, difficulty: recordedDifficulty, time };
  simulation.ball.shot.saveEventIndex = emitSimulationEvent(simulation, { type: 'save', time, fromId: player.id, toId: simulation.ball.shot.fromId,
    fromPos: { ...contact.keeperPosition }, toPos: { ...touching.position }, kind, difficulty: recordedDifficulty, reachDifficulty: difficulty, ...timing, success: true, onTarget,
    reactionAt: player.keeper.reactionAt, height: touching.height });
  if (kind === 'catch') {
    Object.assign(simulation.ball, touching);
    claimSimulationKeeperBall(simulation, player, { time, kind: 'save' });
  } else parryKeeperShot(simulation, contact, { remaining, kind, team });
  return true;
}

function keeperSaveKind(simulation, { player, touching, difficulty }) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  const handling = player.attributes.gk.handling / MATCH_SIM_DATA.attributes.maximum;
  const speed = Math.hypot(touching.velocity.x, touching.velocity.y, touching.verticalVelocity);
  const quality = settings.catchBase + handling * settings.handlingWeight - speed / MATCH_SIM_DATA.shooting.minimumPower * settings.speedHandlingCost - difficulty * settings.reachHandlingCost;
  const roll = drawSimulationRandom(simulation);
  return roll < Math.max(0, quality) ? 'catch' : difficulty > 1 - settings.tipThreshold || roll > 1 - settings.tipThreshold ? 'tip' : 'parry';
}

function parryKeeperShot(simulation, contact, { remaining, kind, team }) {
  const { touching, player, difficulty } = contact, settings = MATCH_SIM_DATA.goalkeeper;
  const side = touching.position.y >= contact.keeperPosition.y ? 1 : -1;
  const speed = Math.hypot(touching.velocity.x, touching.velocity.y);
  const velocity = kind === 'tip' ? { x: touching.velocity.x * settings.tipSpeedFactor * difficulty, y: touching.velocity.y + side * speed * settings.tipSideWeight }
    : { x: team.direction * speed * settings.parrySpeedFactor * settings.parryForwardWeight, y: side * speed * settings.parrySpeedFactor * settings.parrySideWeight };
  const deflected = { ...touching, velocity, verticalVelocity: kind === 'tip' ? touching.verticalVelocity : settings.parryVerticalSpeed };
  Object.assign(simulation.ball, predictSimulationBall(deflected, remaining), { lastTouchId: player.id, lastTouchTeamId: team.id,
    excludedId: player.id, controlAfterTick: simulation.tick + player.limits.reactionTicks, assist: null, backpassTeamId: null });
}

function keeperSaveTiming({ player, touching, keeperPosition, time }) {
  const settings = MATCH_SIM_DATA.goalkeeper;
  const skillSpeed = settings.diveSpeed + player.attributes.gk.reflexes / MATCH_SIM_DATA.attributes.maximum * settings.reflexDiveSpeed
    + player.attributes.acceleration / MATCH_SIM_DATA.attributes.maximum * settings.accelerationDiveSpeed;
  const extension = Math.max(0, Math.abs(touching.position.y - keeperPosition.y) - settings.bodyReach);
  const reactionMarginSeconds = time - player.keeper.reactionAt - extension / skillSpeed;
  return { reactionMarginSeconds, lastMoment: extension > 0 && reactionMarginSeconds <= settings.lastMomentSeconds };
}
