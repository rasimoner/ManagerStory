export function captureSimulationFrame(simulation) {
  return { tick: simulation.tick, time: simulation.time, physicsTime: simulation.physicsTime, matchTime: simulation.matchTime, half: simulation.match.half,
    players: simulation.teams.flatMap(team => team.players.map(player => ({ id: player.id, teamId: team.id, number: player.number,
      position: { ...player.position }, fitness: player.attributes.fitness, playedSeconds: player.workload.playedSeconds,
      distanceMetres: player.workload.distanceMetres, sentOff: player.sentOff }))),
    ball: { position: { ...simulation.ball.position }, height: simulation.ball.height,
      ownerId: simulation.ball.ownerId ?? simulation.ball.carry?.playerId ?? null, teamId: simulation.ball.teamId },
    statistics: Object.fromEntries(Object.entries(simulation.statistics.teams).map(([id, stats]) => [id, { ...stats }])) };
}

export function refreshPlaybackFrame(playback, simulation) {
  playback.frame = captureSimulationFrame(simulation);
  playback.displaySeconds = simulation.time;
  playback.displayMatchSeconds = simulation.matchTime;
}
