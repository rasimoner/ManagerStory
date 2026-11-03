const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function presented(event) {
  const { api } = loadGame({ quiet: true });
  return api.capturePresentationContacts({ time: 10.2, events: [{ time: 10, physicsTime: 10, success: true, fromId: 'home-RW', toId: 'away-LB',
    teamId: 'home', fromPos: { x: 4, y: 10 }, toPos: { x: 5, y: 10 }, ...event }] })[0];
}

test('a deliberate special move gets a close-up wherever it happens', () => {
  assert.equal(presented({ type: 'skill', kind: 'elastico' }).closeUp, true);
});

test('a measured change of direction in midfield stays on the wide camera', () => {
  assert.equal(presented({ type: 'skill', kind: 'cut', observed: true }).closeUp, false);
});

test('beating a defender is not a reason to leave the wide camera by itself', () => {
  assert.equal(presented({ type: 'beat' }).closeUp, false);
});
