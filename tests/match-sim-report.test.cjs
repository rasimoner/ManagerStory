const test = require('node:test');
const assert = require('node:assert/strict');
const { distribution, bucket, shotRows, sliceRows } = require('../tools/sim-report/analysis.cjs');

test('report distributions include mean, median and interpolated 10th/90th percentiles', () => {
  assert.deepEqual(distribution([0, 10, 20, 30, 40]), { mean: 20, median: 20, p10: 4, p90: 36 });
  assert.equal(bucket(0.05, [0.05, 0.1]), '0.05–0.1');
  assert.equal(bucket(0.1, [0.05, 0.1]), '0.1+');
});

test('a second shot requires a rebound in the same attack within three seconds', () => {
  const events = [
    { type: 'shot', time: 0, teamId: 'home', fromId: 'home-ST', xg: 0.1 },
    { type: 'save', time: 0.5 },
    { type: 'shot', time: 3.4, teamId: 'home', fromId: 'home-ST', xg: 0.2, onTarget: true },
    { type: 'goal', time: 3.6, shotId: 2 },
    { type: 'interception', time: 4, toId: 'away-ST', success: true },
    { type: 'shot', time: 4.5, teamId: 'away', fromId: 'away-ST', xg: 0.1 },
  ];
  const rows = shotRows(events, id => id?.split('-')[0]);
  assert.deepEqual(rows.map(row => row.second), [false, true, false]);
  const slices = sliceRows(rows, row => row.second ? 'second' : 'first');
  assert.equal(slices.second.goals, 1);
  assert.equal(slices.second.meanXg, 0.2);
  assert.equal(slices.first.count, 2);
});

test('late rebounds and opponent control break second-shot attribution', () => {
  const events = [
    { type: 'shot', time: 0, teamId: 'home', xg: 0.1 },
    { type: 'block', time: 0.5 },
    { type: 'shot', time: 3.6, teamId: 'home', xg: 0.1 },
    { type: 'post', time: 3.8 },
    { type: 'interception', time: 4, toId: 'away-ST', success: true },
    { type: 'shot', time: 4.2, teamId: 'home', xg: 0.1 },
  ];
  assert.ok(shotRows(events, id => id?.split('-')[0]).every(row => !row.second));
});
