const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab, plain } = require('./support/lab.cjs');

test('the persistent shot map links final outcomes and sizes points by xG', () => {
  const { api } = loadLab();
  const state = { cursor: 0, shots: [], current: null };
  const events = [{ type: 'shot', fromPos: { x: 30, y: 3 }, xg: 0.1, teamId: 'home' }, { type: 'save', success: true }];
  api.recordLabShotMapEvents(state, events);
  assert.equal(state.shots[0].outcome, 'save');
  events.push({ type: 'goal', shotId: 0 });
  api.recordLabShotMapEvents(state, events);
  assert.equal(state.shots[0].outcome, 'goal');
  assert.equal(state.shots.length, 1);
  assert.deepEqual(plain(state.shots[0].position), { x: 30, y: 3 });
  const markup = api.labShotMapMarkup(state.shots);
  assert.match(markup, /data-shot-result="goal"/);
  assert.match(markup, /pointer-events="none"/);
  assert.ok(markup.includes('0.10'));
});
