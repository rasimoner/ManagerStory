import MATCH_SIM_DATA from '../../data/match-sim.json';

export function setSimulationTactics(simulation, tactics) {
  if (!(tactics.press in MATCH_SIM_DATA.tactics.pressDistance) || !(tactics.line in MATCH_SIM_DATA.tactics.lineShift)) throw new TypeError('Unknown simulation tactic.');
  for (const team of simulation.teams) {
    team.tactics = { ...tactics };
    for (const player of team.players) player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  }
}
