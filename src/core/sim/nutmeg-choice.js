import SKILL_DATA from '../../data/match-sim-skills.json';
import { simulationNutmegFeet } from './nutmeg-geometry.js';

export function chooseSimulationNutmeg(owner, defender, { rating, turn }) {
  if (!simulationNutmegFeet(defender)) return null;
  const x = defender.position.x - owner.position.x, y = defender.position.y - owner.position.y;
  const ahead = x * Math.cos(owner.heading) + y * Math.sin(owner.heading);
  const lateral = Math.abs(-x * Math.sin(owner.heading) + y * Math.cos(owner.heading));
  if (ahead < SKILL_DATA.nutmeg.minimumAhead || lateral > SKILL_DATA.nutmeg.maximumLateral) return null;
  if (Math.abs(turn) > SKILL_DATA.nutmeg.maximumCarryTurn) return null;
  const kind = 'nutmeg';
  return rating.moves.includes(kind) ? { kind, defenderId: defender.id } : null;
}
