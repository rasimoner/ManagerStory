// The shared presentation clock (match3d-live-clock.js), which paces the live match, drives the 2D
// pitch and holds the score and goal graphic until they are shown. Checked on complete matches,
// for any fixture, without depending on particular events of one seed:
//
//   presentation never changes the engine: same events, score and statistics as the engine alone
//   one engine minute is shown before the next one is generated
//   half time and full time happen once; the result is applied to the career once
//   a goal graphic waits for the team photo (or its fallback); a failed photo never stops the match
//   pause freezes clock, positions, ball and event phase; speed changes never restart an event
//   the 2D players and ball never jump across the pitch outside a placed restart (kickoff after a goal included)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness } = require('./engine-harness.cjs');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const { clockFixtureTests } = require('./support/clock-fixtures.cjs');
clockFixtureTests(0);

test('pause freezes the clock, positions, ball and event phase', () => {
  const h = harness(undefined, { layers: ['clock', 'view'] });
  h.run('S=fresh();init();presentation.live3d.enable();startMatch();resumeLive()');
  for (let i = 0; i < 300; i++) h.run(`presentation.live3d.step(.1,${i * 100})`);
  h.run('M.pause=true');
  const before = h.run('JSON.stringify([M,pitchV73,presentation.live3d.time])');
  for (let i = 0; i < 50; i++) h.run(`presentation.live3d.step(.5,${40000 + i * 500})`);
  h.run('setMatchSpeed(.5);setMatchSpeed(2);setMatchSpeed(1)');
  // (choosing a speed re-anchors the wall clock: lastTime is bookkeeping, not match state)
  const strip = j => j.replace(/"speed":[\d.]+/g, '').replace(/"lastTime":[\d.]+/g, '');
  assert.equal(strip(h.run('JSON.stringify([M,pitchV73,presentation.live3d.time])')), strip(before));
});

test('the score and statistics on screen never run ahead of the engine', () => {
  const h = harness(undefined, { layers: ['clock', 'view'] });
  h.run('S=fresh();init();presentation.live3d.enable();startMatch();resumeLive()');
  for (let i = 0; i < 2800; i++) {
    h.run(`presentation.live3d.step(1/60,${i * 1000 / 60})`);
    if (i % 100 === 0) {
      assert.ok(h.run('pitchV73.eventScore[0]<=M.hg&&pitchV73.eventScore[1]<=M.ag'));
      assert.ok(h.run('pitchV73.eventStatistics.shots[0]<=M.shots[0]&&pitchV73.eventStatistics.shots[1]<=M.shots[1]'));
    }
  }
  assert.equal(h.run('M.events.some(e=>e.engineStatistics)'), false, 'presentation snapshots never enter saved events');
});

test('switching 2D/3D and the match tabs keeps the engine, RNG, events and pending presentation', () => {
  const h = harness(undefined, { layers: ['clock', 'view'] });
  h.run('S=fresh();init();startMatch();resumeLive()');
  h.run('window.originalMatch=M;setMatchView("3d");for(let i=0;i<20;i++)presentation.live3d.step(.05,i*50);');
  const state = 'JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress,presentation.live3d.time])';
  const before = h.run(state);
  for (const action of ['setMatchView("2d")', 'switchMatchTab("stats")', 'switchMatchTab("details")', 'switchMatchTab("pitch")', 'setMatchView("3d")']) h.run(action);
  assert.equal(h.run('M===originalMatch'), true);
  assert.equal(h.run(state), before);
  h.run('pauseLive()'); const paused = h.run('JSON.stringify(presentation.view.read())');
  h.run('presentation.live3d.step(1,2000)');
  assert.equal(h.run('JSON.stringify(presentation.view.read())'), paused);
});
