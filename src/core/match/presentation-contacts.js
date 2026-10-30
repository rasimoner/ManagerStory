import SIM_VIEW_DATA from '../../data/match-sim-view.json';

const cameraHistory = new WeakMap();

// Keep the legacy alternate final-third close-up gate without writing to the simulation log.
export function capturePresentationContacts(simulation) {
  const history = updateCameraHistory(simulation);
  const start = Math.max(0, simulation.events.length - SIM_VIEW_DATA.contacts.maximum);
  return simulation.events.slice(start).map((event, offset) => copyPresentationContact(event, {
    id: start + offset, closeUp: history.closeUps.has(start + offset),
  })).filter(event => simulation.time - event.time <= contactHistorySeconds(event));
}

function updateCameraHistory(simulation) {
  if (!cameraHistory.has(simulation)) cameraHistory.set(simulation, { cursor: 0, challenges: 0, closeUps: new Set() });
  const history = cameraHistory.get(simulation);
  while (history.cursor < simulation.events.length) {
    const event = simulation.events[history.cursor];
    if (isCloseChallenge(event)) {
      if (history.challenges++ % 2 === 0) history.closeUps.add(history.cursor);
    }
    history.cursor++;
  }
  for (const id of history.closeUps) if (id < simulation.events.length - SIM_VIEW_DATA.contacts.maximum) history.closeUps.delete(id);
  return history;
}

function isCloseChallenge(event) {
  const position = event.ballPosition ?? event.toPos;
  return event.type === 'tackle' && position && Math.abs(position.x) > SIM_VIEW_DATA.camera.challengeZoneMetres;
}

function copyPresentationContact(event, cue) {
  return { ...cue, type: event.type, fromId: event.fromId, toId: event.toId, teamId: event.teamId,
    time: event.physicsTime ?? event.time, kind: event.kind, height: event.height, success: event.success, result: event.result,
    fromPos: event.fromPos ? { ...event.fromPos } : null, toPos: event.toPos ? { ...event.toPos } : null };
}

function contactHistorySeconds(event) {
  if (event.type === 'goal') return SIM_VIEW_DATA.atmosphere.goalSeconds;
  return event.type === 'keeperClaim' ? SIM_VIEW_DATA.pose.handHistorySeconds : SIM_VIEW_DATA.contacts.seconds;
}
