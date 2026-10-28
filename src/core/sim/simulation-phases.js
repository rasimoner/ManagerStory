import MATCH_SIM_DATA from '../../data/match-sim.json';

export function beginSimTransition(simulation, ownerId) {
  for (const team of simulation.teams) {
    team.phase = team.id === ownerId ? 'winning' : 'counterpress';
    team.phaseSinceTick = simulation.tick;
    team.ownershipChangedTick = simulation.tick;
    team.pressReactionSeconds = null;
    for (const player of team.players) player.nextDecisionTick = simulation.tick + player.limits.reactionTicks;
  }
}

export function updateSimPhase(simulation, team) {
  const phases = MATCH_SIM_DATA.phases;
  const elapsed = (simulation.tick - team.phaseSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  if (team.phase === 'winning' && elapsed >= phases.winningSeconds) team.phase = 'possession';
  if (team.phase === 'counterpress' && elapsed >= phases.counterpressSeconds) team.phase = 'defending';
  const multiplier = team.phase === 'counterpress' ? phases.counterpressTriggerFactor : 1;
  team.pressTriggerDistance = MATCH_SIM_DATA.tactics.pressDistance[team.tactics.press] * multiplier;
}
