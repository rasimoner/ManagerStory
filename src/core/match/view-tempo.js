import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';

export function simulationViewTempo(simulation, playback) {
  const settings = CAREER_SIM_DATA.continuous;
  if (criticalSimulationMoment(simulation, playback)) return { phase: 'critical', rate: settings.criticalRate };
  if (simulation.match.phase !== 'playing' || simulation.referee.stoppage || simulation.ball.restart) return { phase: 'restart', rate: settings.restartRate };
  const danger = simulationViewDanger(simulation);
  if (danger.depth <= settings.threatDepth && danger.width <= settings.threatWidth) return { phase: 'threat', rate: settings.threatRate };
  if (danger.depth <= settings.approachDepth) return { phase: 'approach', rate: settings.approachRate };
  return { phase: 'quiet', rate: settings.quietRate };
}

function criticalSimulationMoment(simulation, playback) {
  return simulation.time < playback.criticalUntil || simulation.ball.shot != null || simulation.ownerDecision.selected === 'shot';
}

function simulationViewDanger(simulation) {
  const ball = simulation.ball, settings = CAREER_SIM_DATA.continuous;
  const team = simulation.teams.find(candidate => candidate.id === ball.teamId);
  const forecast = ball.position.x + ball.velocity.x * settings.anticipationSeconds;
  const side = ball.position.y + ball.velocity.y * settings.anticipationSeconds;
  return { depth: MATCH_SIM_DATA.pitch.length / 2 - Math.max(ball.position.x * team.direction, forecast * team.direction),
    width: Math.min(Math.abs(ball.position.y), Math.abs(side)) * 2 };
}

export function integrateSimulationViewRate(playback, { seconds, targetRate }) {
  const settings = CAREER_SIM_DATA.continuous;
  const tau = targetRate < playback.currentRate ? settings.slowdownSeconds : settings.accelerationSeconds;
  const difference = playback.currentRate - targetRate;
  const decay = Math.exp(-seconds / tau);
  const gameSeconds = targetRate * seconds + difference * tau * (1 - decay);
  playback.currentRate = targetRate + difference * decay;
  return gameSeconds;
}

export function collectContinuousViewEvents(playback, simulation) {
  const settings = CAREER_SIM_DATA.continuous;
  while (playback.eventCursor < simulation.events.length) {
    const event = simulation.events[playback.eventCursor++];
    if (settings.criticalTypes.includes(event.type) || event.penaltyPending) playback.criticalUntil = Math.max(playback.criticalUntil, event.time + settings.afterEventSeconds);
  }
}
