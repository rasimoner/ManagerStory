/* Phase 1, test 15/16: 100 stress matches through tools/engine-audit.cjs. (Split from
   matchengine-phase1.test.cjs: the longest single test, it runs alongside the others.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('15/16. no NaN, Infinity, undefined players or out-of-bounds coordinates over 100 stress matches', { timeout: 300000 }, () => {
  const out = execFileSync(process.execPath, [path.resolve(__dirname, '../tools/engine-audit.cjs'), '100', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const a = JSON.parse(out.trim().split('\n').at(-1));
  assert.equal(a.matches, 100);
  assert.equal(a.crashes, 0, a.firstCrash);
  assert.deepEqual(a.problems, {}, 'no ghost possession, NaN, missing team, or out-of-bounds player');
  assert.ok(a.minPairDistance >= .9, 'no stacked players (min ' + a.minPairDistance + ')');
  assert.equal(a.matchesWithBadFinalization, 0);
  assert.equal(a.eventsAfterFullTime, 0);
  assert.equal(a.secondHalfInverted, 0);
  assert.equal(a.collapseSamples, 0);
  assert.ok(a.recoveries > 0 && a.recoveriesAfterRealChase > 0);
  assert.ok(a.gkPassShare < .03, 'goalkeeper is not a routine pass outlet');
  assert.ok(a.goalsPerMatch > 1 && a.goalsPerMatch < 5, 'scoring stays plausible: ' + a.goalsPerMatch);
});

