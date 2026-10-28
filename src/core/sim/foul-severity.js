import { keeperCoversClearChance } from './keeper-rushing.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { planningDistance } from './geometry.js';
import { simulationPlayerAvailable } from './duel-state.js';

export function evaluateSimulationFoul(simulation, defender, incident) {
  const { victim, kind, speed } = incident;
  const settings = MATCH_SIM_DATA.refereeing;
  const team = simulation.teams.find(candidate => candidate.id === victim.teamId);
  const behind = (defender.position.x - victim.position.x) * Math.cos(victim.heading) + (defender.position.y - victim.position.y) * Math.sin(victim.heading) < 0;
  const ballDistance = planningDistance(defender.position, simulation.ball.position);
  const reach = kind === 'sliding' ? MATCH_SIM_DATA.duels.slidingReach : MATCH_SIM_DATA.duels.standingReach;
  const noBallChance = ballDistance > reach || simulation.ball.height > MATCH_SIM_DATA.duels.footRadius;
  const severity = speed * settings.speedSeverityWeight + Number(behind) * settings.behindSeverity
    + Number(kind === 'sliding') * settings.slideSeverity + Number(noBallChance) * settings.noBallSeverity;
  const dogso = hasClearGoalChance(simulation, { defender, victim, team });
  return { severity, behind, noBallChance, dogso, redCandidate: severity >= settings.redThreshold || (behind && dogso) };
}

function hasClearGoalChance(simulation, { defender, victim, team }) {
  const settings = MATCH_SIM_DATA.refereeing;
  if (simulation.ball.ownerId !== victim.id && simulation.ball.carry?.playerId !== victim.id) return false;
  const goalDistance = MATCH_SIM_DATA.pitch.length / 2 - victim.position.x * team.direction;
  const forwardSpeed = victim.velocity.x * team.direction;
  if (goalDistance > settings.dogsoGoalDistance || Math.abs(victim.position.y) > settings.dogsoGoalWidth / 2 || forwardSpeed < settings.dogsoMinimumSpeed) return false;
  const defending = simulation.teams.find(candidate => candidate.id === defender.teamId);
  if (keeperCoversClearChance(simulation, victim, defending)) return false;
  const defenders = defending.players;
  return !defenders.some(player => player.id !== defender.id && player.slot !== 'GK' && simulationPlayerAvailable(player)
    && (player.position.x - victim.position.x) * team.direction > 0 && Math.abs(player.position.y - victim.position.y) < settings.dogsoGoalWidth / 2);
}
