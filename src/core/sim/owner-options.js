import { simulationPassChanceValue } from './shot-pass-value.js';
import { evaluateSimulationShot } from './shot-evaluation.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import BALANCE from '../../data/balance.json';
import { usesNaturalMatchClock } from './simulation-clock.js';
import { simulationGoalProgress } from './attacking-space.js';
import { simulationOwnerPressure } from './pass-evaluation.js';
import { scanSimulationOwnerPasses, retainSimulationOwnerOutlet } from './owner-pass-scan.js';
import { evaluateSimulationDribble } from './dribble-evaluation.js';

export function evaluateSimulationOwnerOptions(simulation, owner) {
  const weights = MATCH_SIM_DATA.ownerDecision;
  const team = simulation.teams.find(candidate => candidate.id === owner.teamId);
  const tempo = weights.tempos[team.tactics.tempo ?? weights.defaultTempo];
  const pressure = simulationOwnerPressure(simulation, owner);
  const scan = scanSimulationOwnerPasses(simulation, owner);
  const options = scan.options, flow = usesNaturalMatchClock(simulation) ? BALANCE.shortMatchFlow : null;
  const waiting = Math.min(weights.passWaitCap, (simulation.tick - simulation.ball.ownerSinceTick) * MATCH_SIM_DATA.clock.stepSeconds);
  const pass = bestOwnerOutlet(options, { pressure, waiting, tempo, team, flow });
  retainSimulationOwnerOutlet(simulation, pass);
  const dribble = evaluateSimulationDribble(simulation, owner);
  dribble.score += weights.styleCarry[team.tactics.passingStyle ?? MATCH_SIM_DATA.passing.defaultStyle] - pressure * weights.dribblePressureCost;
  const skill = (owner.attributes.strength + owner.attributes.composure) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const shield = { score: weights.shieldBase + pressure * weights.shieldPressureWeight + skill * weights.shieldSkillWeight - shieldingWaitCost(simulation) + (MATCH_SIM_DATA.instructions[owner.instruction]?.shieldBonus ?? 0) };
  const perception = (owner.attributes.vision + owner.attributes.composure) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const shot = evaluateSimulationShot(simulation, owner);
  shot.score *= MATCH_SIM_DATA.instructions[owner.instruction]?.shotScoreScale ?? 1;
  const passScore = (pass ? pass.decisionScore - (1 - perception) * weights.perceptionErrorCost : -Infinity) + simulationPassChanceValue(simulation, pass, shot);
  const choice = { pass: passScore, dribble: dribble.score, shield: shield.score, shot: shot.score };
  const selected = Object.keys(choice).reduce((best, key) => choice[key] > choice[best] ? key : best);
  return { selected, shot, pass: { score: passScore, option: pass }, dribble, shield, pressure, passOptions: scan.visibleOptions };
}

function bestOwnerOutlet(options, { pressure, waiting, tempo, team, flow }) {
  const weights = MATCH_SIM_DATA.ownerDecision;
  let best = null;
  for (const option of options) {
    if (!option.visible || !option.reachable || !option.safe) continue;
    const progressValue = flow ? simulationGoalProgress(team, option.fromPos, option.target) * flow.passProgressWeight : 0;
    const decisionScore = weights.passBase + option.score * weights.passScoreWeight + pressure * weights.passPressureWeight
      + waiting * weights.passWaitWeight * tempo - Math.abs(option.distance - weights.preferredDistance) * weights.passDistanceCost + progressValue;
    if (!best || decisionScore > best.decisionScore) best = { ...option, decisionScore };
  }
  return best;
}

function shieldingWaitCost(simulation) {
  const retained = simulation.clock.pauseHalfPreparation && simulation.ownerDecision.shieldSinceTick >= simulation.ball.ownerSinceTick;
  if (simulation.ownerDecision.selected !== 'shield' && !retained) return 0;
  const seconds = (simulation.tick - simulation.ownerDecision.shieldSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  return Math.max(0, seconds - MATCH_SIM_DATA.ownerDecision.shieldSupportSeconds) * MATCH_SIM_DATA.ownerDecision.shieldWaitCost;
}
