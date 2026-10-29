import MATCH_SIM_DATA from '../../data/match-sim.json';
import { playerMovementLimits } from './player-movement.js';
import { drawSimulationRandom } from './simulation-runtime.js';
import { injureSimulationPlayer } from './player-injuries.js';

export function consumeSimulationFitness(simulation) {
  if (!simulation.workload.enabled) return;
  for (const team of simulation.teams) for (const player of team.players) consumePlayerFitness(player);
  consumeSimulationContacts(simulation);
  checkSimulationFatigueInjuries(simulation);
}

function consumePlayerFitness(player) {
  if (player.sentOff) return;
  const settings = MATCH_SIM_DATA.workload, seconds = MATCH_SIM_DATA.clock.stepSeconds;
  const distance = Math.hypot(player.velocity.x, player.velocity.y) * seconds;
  const sprint = player.gait === 'sprint' ? distance : 0;
  player.workload.playedSeconds += seconds;
  player.workload.distanceMetres += distance;
  player.workload.sprintMetres += sprint;
  const stamina = player.attributes.stamina ?? MATCH_SIM_DATA.ball.defaultAttribute;
  const drain = seconds * settings.perSecond + distance * settings.perMetre + sprint * settings.sprintPerMetre;
  drainPlayerFitness(player, drain * (settings.staminaBase + (1 - stamina / MATCH_SIM_DATA.attributes.maximum) * settings.staminaRange));
}

function drainPlayerFitness(player, drain) {
  player.attributes.fitness = Math.max(MATCH_SIM_DATA.workload.minimumFitness, player.attributes.fitness - drain);
  player.limits = playerMovementLimits(player.attributes);
}

function consumeSimulationContacts(simulation) {
  const events = simulation.events.slice(simulation.workload.eventCursor);
  simulation.workload.eventCursor = simulation.events.length;
  for (const event of events) {
    if (event.type !== 'tackle' && event.type !== 'duel') continue;
    const players = simulation.teams.flatMap(team => team.players).filter(player => player.id === event.fromId || player.id === event.toId);
    for (const player of players) { player.workload.contacts++; drainPlayerFitness(player, MATCH_SIM_DATA.workload.perContact); }
    checkSimulationContactInjury(simulation, event);
  }
}

function checkSimulationContactInjury(simulation, event) {
  const settings = MATCH_SIM_DATA.injuries;
  if (event.type !== 'tackle' || event.speed < settings.hardContactSpeed || (event.contact !== 'player' && !event.bodyContact)) return;
  if (drawSimulationRandom(simulation) >= settings.hardContactRisk) return;
  injureSimulationPlayer(simulation, { playerId: event.toId, cause: 'contact' });
}

function checkSimulationFatigueInjuries(simulation) {
  if (simulation.paused || simulation.tick < simulation.workload.nextInjuryTick) return;
  const settings = MATCH_SIM_DATA.injuries;
  simulation.workload.nextInjuryTick = simulation.tick + Math.ceil(settings.checkSeconds / MATCH_SIM_DATA.clock.stepSeconds);
  const players = simulation.teams.flatMap(team => team.players).filter(player => !player.sentOff);
  for (const player of players) {
    const fatigue = 1 - player.attributes.fitness / MATCH_SIM_DATA.attributes.maximum;
    const risk = settings.perPlayerSecond * settings.checkSeconds * (1 + fatigue * settings.fatigueMultiplier);
    if (drawSimulationRandom(simulation) < risk) { injureSimulationPlayer(simulation, { playerId: player.id, cause: 'fatigue' }); return; }
  }
}
