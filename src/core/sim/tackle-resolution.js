import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { planningDistance } from './geometry.js';
import { simulationTackleContact } from './tackle-contact.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { acquireSimulationBall } from './ball-possession.js';
import { recordSimulationFoul } from './refereeing.js';
import { endSimulationCarry } from './dribbling.js';
import { simulationDurationTicks } from './duel-state.js';

export function resolveSimulationTackle(simulation, attempt) {
  if (simulation.ball.heldBy != null) return null;
  const players = simulationRuntime(simulation).byId;
  const defender = players.get(attempt.defenderId), victim = players.get(attempt.victimId);
  const contact = simulationTackleContact({ ...attempt, ball: simulation.ball, victim });
  const canControl = attempt.kind !== 'sliding' && planningDistance(defender.position, simulation.ball.position) <= MATCH_SIM_DATA.ball.controlRadius;
  const result = contact.contact === 'ball' ? canControl ? 'won' : 'loose' : 'missed';
  emitSimulationEvent(simulation, { type: 'tackle', fromId: defender.id, toId: victim.id, fromPos: { ...attempt.from }, toPos: { ...contact.position },
    kind: attempt.kind, result, contact: contact.contact, speed: attempt.speed, success: contact.contact === 'ball',
    ballPosition: { ...simulation.ball.position }, victimPosition: { ...victim.position }, victimSpeed: attempt.victimSpeed, preparationSeconds: attempt.preparationSeconds, distance: attempt.distance });
  recordTackleStatistics(simulation, defender, result);
  simulation.defending.lastContact = { ...contact, time: simulation.time, defenderId: defender.id, victimId: victim.id };
  finishTackleRecovery(simulation, defender, attempt.kind);
  if (contact.contact === 'player') recordSimulationFoul(simulation, defender, { victim, kind: attempt.kind, speed: attempt.speed });
  if (contact.contact === 'ball') takeTackledBall(simulation, defender, { result, attempt });
  return contact;
}

function recordTackleStatistics(simulation, defender, result) {
  const stats = simulation.statistics.teams[defender.teamId];
  stats.tackles++;
  if (result === 'won') stats.tacklesWon++;
  if (result === 'missed') stats.tacklesMissed++;
  if (result === 'loose') stats.tacklesLoose++;
}

function finishTackleRecovery(simulation, defender, kind) {
  const settings = MATCH_SIM_DATA.duels;
  defender.duel.tackle = null;
  defender.duel.nextTackleTick = simulation.tick + simulationDurationTicks(settings.cooldownSeconds);
  if (kind !== 'sliding') { defender.duel.state = 'jockey'; return; }
  const skill = (defender.attributes.acceleration + defender.attributes.fitness) / (2 * MATCH_SIM_DATA.attributes.maximum);
  defender.duel.state = 'grounded';
  defender.duel.untilTick = simulation.tick + simulationDurationTicks(settings.recoveryMinimumSeconds + (1 - skill) * settings.recoverySkillSeconds);
}

function takeTackledBall(simulation, defender, { result, attempt }) {
  settleSimulationPass(simulation, { position: simulation.ball.position, controlled: result === 'won', playerId: defender.id, teamId: defender.teamId });
  endSimulationCarry(simulation);
  simulation.ball.flight = null;
  if (result === 'won') { acquireSimulationBall(simulation, defender); return; }
  const direction = Math.atan2(attempt.to.y - attempt.from.y, attempt.to.x - attempt.from.x);
  const speed = Math.max(MATCH_SIM_DATA.ball.firstTouch.minimumDeflectionSpeed, attempt.speed * MATCH_SIM_DATA.duels.looseSpeedFactor);
  Object.assign(simulation.ball, { ownerId: null, velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    lastTouchId: defender.id, lastTouchTeamId: defender.teamId, excludedId: defender.id, controlAfterTick: defender.duel.untilTick });
}
