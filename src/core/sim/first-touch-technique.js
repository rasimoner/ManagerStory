import SKILL_DATA from '../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall } from './ball-physics.js';
import { pointDistance } from './geometry.js';

export function simulationTrapContactMotion(simulation, player, motion) {
  if (!simulation.clock.pauseHalfPreparation || simulation.ball.shot || simulation.ball.flight?.cross) return motion;
  if (simulation.ball.flight?.toId !== player.id || !trapPlayerAvailable(player) || motion.before.verticalVelocity >= 0) return motion;
  const settings = SKILL_DATA.footTrap, ball = motion.before;
  const seconds = Math.max(0, (ball.verticalVelocity + Math.sqrt(Math.max(0, ball.verticalVelocity ** 2
    + 2 * MATCH_SIM_DATA.ball.gravity * (ball.height - settings.contactHeight)))) / MATCH_SIM_DATA.ball.gravity);
  if (pointDistance(predictSimulationBall(ball, seconds).position, player.position) > settings.horizontalReach) return motion;
  return { ...motion, radius: settings.horizontalReach, reachableHeight: settings.contactHeight };
}

export function simulationFirstTouchStyle(simulation, player, ball) {
  if (!simulation.clock.pauseHalfPreparation || !trapPlayerAvailable(player)) return null;
  const settings = SKILL_DATA.footTrap;
  if (ball.height < settings.minimumHeight || ball.height > settings.contactHeight || ball.verticalVelocity >= 0) return null;
  if (pointDistance(player.position, ball.position) > settings.horizontalReach) return null;
  return Math.hypot(ball.velocity.x, ball.velocity.y, ball.verticalVelocity) <= settings.maximumBallSpeed ? 'trap' : null;
}

function trapPlayerAvailable(player) {
  const settings = SKILL_DATA.footTrap;
  return player.slot !== 'GK' && Math.min(player.attributes.firstTouch, player.attributes.technique) >= settings.minimumAbility
    && Math.hypot(player.velocity.x, player.velocity.y) <= settings.maximumPlayerSpeed;
}

export function captureSimulationTrapIntent(simulation) {
  const player = simulation.teams.flatMap(team => team.players).find(player => player.id === simulation.ball.flight?.toId);
  if (!player) return null;
  const motion = { before: simulation.ball };
  return simulationTrapContactMotion(simulation, player, motion) !== motion ? { playerId: player.id } : null;
}
