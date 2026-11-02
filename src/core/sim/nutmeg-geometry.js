import SKILL_DATA from '../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { fitCarryTarget } from './dribble-evaluation.js';

export function simulationNutmegFeet(player) {
  if (player.motionMode !== 'jockey' || player.duel.tackle) return null;
  const settings = SKILL_DATA.nutmeg, speed = Math.hypot(player.velocity.x, player.velocity.y);
  if (speed > settings.maximumStanceSpeed) return null;
  const forward = { x: Math.cos(player.heading), y: Math.sin(player.heading) };
  return [-1, 1].map(side => ({ x: forward.x * settings.stanceForward - forward.y * side * settings.stanceSide,
    y: forward.y * settings.stanceForward + forward.x * side * settings.stanceSide }));
}

export function simulationNutmegContactMotion(simulation, player, motion) {
  const skill = simulation.ball.carry?.skill;
  if (!SKILL_DATA.ground[skill?.kind]?.throughLegs || skill.defenderId !== player.id || motion.before.height > SKILL_DATA.nutmeg.maximumHeight) return motion;
  const feet = simulationNutmegFeet(player);
  return feet ? { ...motion, feet, radius: SKILL_DATA.nutmeg.footRadius + MATCH_SIM_DATA.ball.radius } : motion;
}

export function simulationNutmegRoute(defender, skill) {
  const settings = SKILL_DATA.nutmeg, forward = { x: Math.cos(skill.heading), y: Math.sin(skill.heading) };
  return fitCarryTarget({ x: defender.position.x + forward.x * settings.aroundForward - forward.y * skill.side * settings.aroundSide,
    y: defender.position.y + forward.y * settings.aroundForward + forward.x * skill.side * settings.aroundSide });
}

export function simulationNutmegProgress(ball, defender, { skill, before, previous }) {
  const x = ball.position.x - defender.position.x, y = ball.position.y - defender.position.y;
  const forward = x * Math.cos(skill.heading) + y * Math.sin(skill.heading);
  const preceding = (before.position.x - previous.x) * Math.cos(skill.heading) + (before.position.y - previous.y) * Math.sin(skill.heading);
  const lateral = -x * Math.sin(skill.heading) + y * Math.cos(skill.heading);
  return preceding < 0 && forward >= 0 && ball.height <= SKILL_DATA.nutmeg.maximumHeight
    && Math.abs(lateral) + SKILL_DATA.nutmeg.footRadius + MATCH_SIM_DATA.ball.radius < SKILL_DATA.nutmeg.stanceSide;
}
