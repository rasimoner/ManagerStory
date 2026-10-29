const test = require('node:test');
const assert = require('node:assert/strict');
const { analyseGoalTail } = require('../tools/sim-report/tail.cjs');

test('tail diagnostics preserve every goal, its interval and the full preceding thirty seconds', () => {
  const events = [
    { type: 'kickoff', time: 1, teamId: 'home' },
    { type: 'goal', time: 100, teamId: 'away' },
    { type: 'kickoff', time: 110, teamId: 'home' },
    { type: 'pass', time: 111, fromId: 'h1', actualToId: 'a1', success: false },
    { type: 'goal', time: 130, teamId: 'away' },
  ];
  const result = analyseGoalTail(events);
  assert.equal(result.goals.length, 2);
  assert.equal(result.goals[0].intervalSeconds, null);
  assert.equal(result.goals[1].intervalSeconds, 30);
  assert.equal(result.goals[1].sinceKickoffSeconds, 20);
  assert.deepEqual(result.goals[1].before, events.slice(1));
  assert.equal(result.goals[1].restartTurnover, true);
});
