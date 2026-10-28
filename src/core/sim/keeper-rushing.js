import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { pointDistance } from './geometry.js';
import { simulationPenaltyAreaContains } from './keeper-positioning.js';
import { claimSimulationKeeperBall } from './keeper-possession.js';

export function finishSimulationKeeperRush(simulation) {
  const ball = simulation.ball;
  if (ball.ownerId == null || ball.heldBy != null || ball.shot || simulation.referee.stoppage) return;
  const owner = simulationRuntime(simulation).byId.get(ball.ownerId);
  const defending = simulation.teams.find(team => team.id !== owner.teamId);
  const keeper = defending.players.find(player => player.slot === 'GK' && !player.sentOff);
  if (!keeper || keeper.keeper.mode !== 'rush' || !simulationPenaltyAreaContains(defending, ball.position)) return;
  const skill = keeper.attributes.gk.oneOnOne / MATCH_SIM_DATA.attributes.maximum;
  const reach = MATCH_SIM_DATA.goalkeeper.bodyReach + skill * MATCH_SIM_DATA.goalkeeper.handRadius;
  if (pointDistance(keeper.position, ball.position) <= reach) claimSimulationKeeperBall(simulation, keeper, { kind: 'oneOnOne' });
}

export function keeperCoversClearChance(simulation, victim, defending) {
  const keeper = defending.players.find(player => player.slot === 'GK' && !player.sentOff);
  if (!keeper) return false;
  const direction = -defending.direction;
  const goalX = direction * MATCH_SIM_DATA.pitch.length / 2;
  const goalDistance = (goalX - victim.position.x) * direction;
  const keeperDistance = (keeper.position.x - victim.position.x) * direction;
  if (keeperDistance < 0 || keeperDistance > goalDistance) return false;
  const settings = MATCH_SIM_DATA.goalkeeper;
  const reaction = settings.reactionMinimum + (1 - keeper.attributes.gk.reflexes / MATCH_SIM_DATA.attributes.maximum) * settings.reactionSkillSeconds;
  const active = Math.max(0, keeperDistance / MATCH_SIM_DATA.shooting.minimumPower - reaction);
  const reach = settings.bodyReach + Math.min(settings.maximumDiveReach, active * settings.diveSpeed);
  const fraction = keeperDistance / goalDistance;
  const projectedCentre = victim.position.y * (1 - fraction);
  const halfOpening = MATCH_SIM_DATA.pitch.goalWidth / 2 * fraction;
  return Math.abs(projectedCentre - keeper.position.y) + halfOpening + settings.dogsoMinimumOpenReach * fraction <= reach;
}
