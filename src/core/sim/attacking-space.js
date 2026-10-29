import MATCH_SIM_DATA from '../../data/match-sim.json';

export function simulationGoalProgress(team, from, target) {
  const goal = team.direction * MATCH_SIM_DATA.pitch.length / 2;
  return Math.hypot(goal - from.x, from.y) - Math.hypot(goal - target.x, target.y);
}
