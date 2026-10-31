const test = require('node:test');
const assert = require('node:assert/strict');
const { loadNativeLab } = require('./support/lab.cjs');

test('laboratory fast-forward includes the stopped halftime and finishes at 90:00', async () => {
  const api = await loadNativeLab(['createLabSession']), runner = api.createLabSession({ seed: 731 });
  runner.completeMatch();
  const state = runner.snapshot().simulation;
  assert.equal(state.match.phase, 'ended');
  assert.equal(state.matchTime, 5400);
  assert.ok(state.tick > 54000);
  assert.equal(state.tick - state.clock.stoppedTicks, 54000);
});
