const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function beatEvent(overrides = {}) {
  return { type: 'beat', time: 10, physicsTime: 10, success: true, fromId: 'home-RW', toId: 'away-LB', teamId: 'home',
    fromPos: { x: 4, y: 10 }, toPos: { x: 5, y: 10 }, ...overrides };
}

function presentedBeats(events) {
  const { api } = loadGame({ quiet: true });
  const simulation = { time: 10.2, events: [], teams: [] };
  simulation.events = events;
  return api.capturePresentationContacts(simulation).filter(contact => contact.type === 'beat');
}

test('a dribbler beating a defender gets a close-up even in midfield', () => {
  assert.equal(presentedBeats([beatEvent()])[0].closeUp, true);
});

test('a failed beat does not interrupt the wide camera', () => {
  assert.equal(presentedBeats([beatEvent({ success: false })])[0].closeUp, false);
});

test('the automatic camera frames the dribbler and the beaten defender together', async () => {
  const scene = await sceneFixture();
  const frame = { physicsTime: 10.2, ball: { position: { x: 4, y: 0, z: 10 } },
    players: [{ id: 'home-RW', position: { x: 4, y: 0, z: 10 } }, { id: 'away-LB', position: { x: 5, y: 0, z: 10 } }],
    contacts: [{ ...beatEvent(), closeUp: true }] };
  const shot = scene.api.simulationCameraShot(frame, 'auto');
  assert.equal(shot.mode, 'close');
  assert.equal(shot.a.pos.x, 4);
  assert.equal(shot.b.pos.x, 5);
});
