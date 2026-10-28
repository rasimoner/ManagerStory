import MATCH_SIM_DATA from '../../data/match-sim.json';

export function setSimulationTactics(simulation, tactics) {
  if (!(tactics.press in MATCH_SIM_DATA.tactics.pressDistance) || !(tactics.line in MATCH_SIM_DATA.tactics.lineShift)) throw new TypeError('Unknown simulation tactic.');
  if (tactics.passingStyle !== undefined && !(tactics.passingStyle in MATCH_SIM_DATA.passing.styles)) throw new TypeError('Unknown simulation passing style.');
  if (tactics.tempo !== undefined && !(tactics.tempo in MATCH_SIM_DATA.ownerDecision.tempos)) throw new TypeError('Unknown simulation tempo.');
  validateSimulationMentality(tactics);
  for (const team of simulation.teams) {
    team.tactics = { ...team.tactics, ...tactics };
    for (const player of team.players) player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  }
}

function validateSimulationMentality(tactics) {
  if (tactics.mentality !== undefined && !(tactics.mentality in MATCH_SIM_DATA.shooting.mentalities)) throw new TypeError('Unknown simulation mentality.');
}
