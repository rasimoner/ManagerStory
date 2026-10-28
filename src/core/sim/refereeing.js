import MATCH_SIM_DATA from '../../data/match-sim.json';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { evaluateSimulationFoul } from './foul-severity.js';
import { simulationFoulRestartPosition, stopSimulationForFoul } from './foul-restart.js';
import { simulationDurationTicks } from './duel-state.js';
import { simulationRuntime } from './simulation-runtime.js';

export function recordSimulationFoul(simulation, defender, incident) {
  const { victim } = incident;
  const defending = simulation.teams.find(team => team.id === defender.teamId);
  const restart = simulationFoulRestartPosition(victim.position, defending.direction);
  const assessment = evaluateSimulationFoul(simulation, defender, incident);
  const foul = { type: 'foul', fromId: defender.id, toId: victim.id, fromPos: { ...defender.position }, toPos: { ...victim.position },
    teamId: victim.teamId, contact: 'player', kind: incident.kind, speed: incident.speed, ...assessment,
    penaltyPending: restart.penaltyPending, restartPosition: restart.position, success: true };
  const eventIndex = emitSimulationEvent(simulation, foul);
  simulation.statistics.teams[defender.teamId].fouls++;
  applySimulationCard(simulation, defender, foul);
  if (!foul.redCandidate && defender.yellowCards < 2 && canPlayAdvantage(simulation, victim)) beginAdvantage(simulation, { ...foul, eventIndex });
  else { settleSimulationPass(simulation, { position: simulation.ball.position, controlled: false }); stopSimulationForFoul(simulation, foul); }
}

function applySimulationCard(simulation, defender, foul) {
  const settings = MATCH_SIM_DATA.refereeing;
  const stats = simulation.statistics.teams[defender.teamId];
  if (foul.redCandidate) { sendOffSimulationPlayer(simulation, defender, foul); return; }
  if (foul.severity < settings.yellowThreshold) return;
  defender.yellowCards++;
  stats.yellow++;
  emitSimulationEvent(simulation, { ...foul, type: 'yellow', secondYellow: defender.yellowCards === 2 });
  if (defender.yellowCards === 2) sendOffSimulationPlayer(simulation, defender, { ...foul, secondYellow: true });
}

function sendOffSimulationPlayer(simulation, defender, foul) {
  defender.sentOff = true;
  defender.duel.state = 'sentOff';
  defender.duel.tackle = null;
  simulation.statistics.teams[defender.teamId].red++;
  emitSimulationEvent(simulation, { ...foul, type: 'red' });
}

function canPlayAdvantage(simulation, victim) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId ?? simulation.ball.carry?.playerId);
  const team = simulation.teams.find(candidate => candidate.id === victim.teamId);
  return owner?.teamId === victim.teamId && owner.velocity.x * team.direction >= MATCH_SIM_DATA.refereeing.advantageForwardSpeed;
}

function beginAdvantage(simulation, foul) {
  simulation.referee.advantage ??= { foul, expiresTick: simulation.tick + simulationDurationTicks(MATCH_SIM_DATA.refereeing.advantageSeconds), startX: foul.toPos.x };
  simulation.statistics.teams[foul.teamId].advantages++;
  emitSimulationEvent(simulation, { ...foul, type: 'advantage', status: 'played' });
}

export function updateSimulationReferee(simulation) {
  const advantage = simulation.referee.advantage;
  if (!advantage) return;
  const { foul } = advantage;
  const team = simulation.teams.find(candidate => candidate.id === foul.teamId);
  const controlled = simulation.ball.teamId === foul.teamId && !simulation.ball.restart;
  const progress = (simulation.ball.position.x - advantage.startX) * team.direction;
  if (controlled && simulation.tick < advantage.expiresTick) return;
  simulation.referee.advantage = null;
  if (controlled && progress >= MATCH_SIM_DATA.refereeing.advantageProgress) return;
  emitSimulationEvent(simulation, { ...foul, type: 'advantage', status: 'recalled' });
  settleSimulationPass(simulation, { position: simulation.ball.position, controlled: false });
  stopSimulationForFoul(simulation, foul);
}
