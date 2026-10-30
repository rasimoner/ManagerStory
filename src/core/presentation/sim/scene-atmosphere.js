import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function observedSimulationGoal(frame) {
  return frame.contacts.findLast(event => event.type === 'goal' && event.time <= frame.physicsTime
    && frame.physicsTime - event.time < SIM_VIEW_DATA.atmosphere.goalSeconds);
}

export function animateSimulationCrowd(stadium, frame, userHome) {
  const settings = SIM_VIEW_DATA.atmosphere, goal = observedSimulationGoal(frame);
  const teamId = goal?.teamId ?? frame.players.find(player => player.id === goal?.fromId)?.teamId;
  const homeScored = (teamId === 'user') === userHome;
  for (const material of [stadium.crowdMat, stadium.flagMat]) {
    material.uniforms.uTime.value = frame.physicsTime;
    material.uniforms.uExcite.value = goal ? homeScored ? settings.goalExcitement : settings.quietExcitement : settings.idleExcitement;
    material.uniforms.uExciteAway.value = goal ? homeScored ? settings.quietExcitement : settings.goalExcitement : settings.idleExcitement;
  }
}

export function simulationCelebration(sample, frame) {
  if (sample.slot === 'GK') return null;
  const goal = observedSimulationGoal(frame);
  if (!goal || frame.physicsTime - goal.time >= SIM_VIEW_DATA.atmosphere.celebrationSeconds) return null;
  const teamId = goal.teamId ?? frame.players.find(player => player.id === goal.fromId)?.teamId;
  if (sample.teamId !== teamId) return null;
  if (frame.contacts.some(event => event.fromId === sample.id && event.time > goal.time && event.time <= frame.physicsTime
    && ['pass', 'shot', 'tackle', 'block'].includes(event.type))) return null;
  return { name: 'celebrate', t0: goal.time };
}
