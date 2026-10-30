import SIM_VIEW_DATA from '../../data/match-sim-view.json';

export function captureSimulationFrame(simulation) {
  return { tick: simulation.tick, time: simulation.time, physicsTime: simulation.physicsTime, matchTime: simulation.matchTime, half: simulation.match.half,
    phase: simulation.match.phase,
    players: simulation.teams.flatMap(team => team.players.map(player => ({ id: player.id, teamId: team.id, number: player.number,
      direction: team.direction, slot: player.slot, velocity: { ...player.velocity }, heading: player.heading,
      role: player.role, gait: player.gait, motionMode: player.motionMode, keeper: structuredClone(player.keeper), duel: structuredClone(player.duel),
      position: { ...player.position }, fitness: player.attributes.fitness, playedSeconds: player.workload.playedSeconds,
      distanceMetres: player.workload.distanceMetres, sentOff: player.sentOff }))),
    ball: { position: { ...simulation.ball.position }, height: simulation.ball.height, velocity: { ...simulation.ball.velocity },
      verticalVelocity: simulation.ball.verticalVelocity, heldBy: simulation.ball.heldBy,
      lastTouchId: simulation.ball.lastTouchId, shot: structuredClone(simulation.ball.shot),
      ownerId: simulation.ball.ownerId ?? simulation.ball.carry?.playerId ?? null, teamId: simulation.ball.teamId },
    contacts: simulation.events.slice(-SIM_VIEW_DATA.contacts.maximum).filter(event => simulation.time - event.time <= SIM_VIEW_DATA.contacts.seconds)
      .map(event => ({ type: event.type, fromId: event.fromId, time: event.physicsTime ?? event.time, kind: event.kind })),
    statistics: Object.fromEntries(Object.entries(simulation.statistics.teams).map(([id, stats]) => [id, { ...stats }])) };
}

export function refreshPlaybackFrame(playback, simulation) {
  playback.frame = captureSimulationFrame(simulation);
  playback.previousFrame = null;
  playback.displaySeconds = simulation.time;
  playback.displayMatchSeconds = simulation.matchTime;
}
