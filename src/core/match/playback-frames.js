import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';

export function captureSimulationFrame(simulation) {
  return { tick: simulation.tick, time: simulation.time, half: simulation.match.half,
    players: simulation.teams.flatMap(team => team.players.map(player => ({ id: player.id, teamId: team.id, number: player.number,
      position: { ...player.position }, fitness: player.attributes.fitness, playedSeconds: player.workload.playedSeconds,
      distanceMetres: player.workload.distanceMetres, sentOff: player.sentOff }))),
    ball: { position: { ...simulation.ball.position }, height: simulation.ball.height,
      ownerId: simulation.ball.ownerId ?? simulation.ball.carry?.playerId ?? null, teamId: simulation.ball.teamId },
    statistics: Object.fromEntries(Object.entries(simulation.statistics.teams).map(([id, stats]) => [id, { ...stats }])) };
}

export function storePlaybackFrame(playback, simulation) {
  const frame = captureSimulationFrame(simulation);
  const capacity = CAREER_SIM_DATA.playback.capacity;
  playback.frames[playback.writeIndex] = frame;
  playback.writeIndex = (playback.writeIndex + 1) % capacity;
  playback.count = Math.min(capacity, playback.count + 1);
}

export function readPlaybackFrame(playback, seconds) {
  const capacity = CAREER_SIM_DATA.playback.capacity;
  const latestIndex = (playback.writeIndex - 1 + capacity) % capacity;
  const latest = playback.frames[latestIndex];
  const tick = Math.floor((seconds + CAREER_SIM_DATA.epsilon) / MATCH_SIM_DATA.clock.stepSeconds);
  const distance = Math.min(playback.count - 1, Math.max(0, latest.tick - tick));
  return playback.frames[(latestIndex - distance + capacity) % capacity];
}

export function refreshPlaybackFrame(playback, simulation) {
  const capacity = CAREER_SIM_DATA.playback.capacity;
  const index = (playback.writeIndex - 1 + capacity) % capacity;
  if (playback.frames[index]?.tick === simulation.tick) playback.frames[index] = captureSimulationFrame(simulation);
}
