import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { R } from '../../random.js';
import { pointDistance } from '../../sim/geometry.js';

export function createLabBallDriver(seed) {
  return { random: R(seed), position: null, teamId: null, targetId: null, holdingTicks: 0, arrived: false };
}

export function advanceLabBall(driver, simulation) {
  driver.position ??= { ...simulation.ball.position };
  driver.teamId ??= simulation.ball.teamId;
  if (!driver.targetId || (driver.arrived && driver.holdingTicks <= 0)) selectLabBallTarget(driver, simulation);
  const target = simulation.teams.flatMap(team => team.players).find(player => player.id === driver.targetId);
  moveLabBallTowards(driver, target.position);
  if (driver.arrived) driver.holdingTicks--;
  return { teamId: driver.teamId, position: { ...driver.position } };
}

function selectLabBallTarget(driver, simulation) {
  if (driver.targetId && driver.random() < MATCH_SIM_DATA.lab.turnoverProbability) driver.teamId = simulation.teams.find(team => team.id !== driver.teamId).id;
  const team = simulation.teams.find(candidate => candidate.id === driver.teamId);
  const candidates = team.players.filter(player => player.id !== driver.targetId);
  driver.targetId = candidates[Math.floor(driver.random() * candidates.length)].id;
  driver.arrived = false;
  const settings = MATCH_SIM_DATA.lab;
  driver.holdingTicks = Math.ceil((settings.holdMinimumSeconds + driver.random() * settings.holdRangeSeconds) / MATCH_SIM_DATA.clock.stepSeconds);
}

function moveLabBallTowards(driver, target) {
  const distance = pointDistance(driver.position, target);
  const step = MATCH_SIM_DATA.lab.ballSpeed * MATCH_SIM_DATA.clock.stepSeconds;
  const fraction = distance ? Math.min(1, step / distance) : 1;
  driver.position.x += (target.x - driver.position.x) * fraction;
  driver.position.y += (target.y - driver.position.y) * fraction;
  if (distance <= step) driver.arrived = true;
}
