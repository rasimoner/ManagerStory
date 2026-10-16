// The shared presentation clock (match3d-live-clock.js), which paces the live match, drives the 2D
// pitch and holds the score and goal graphic until they are shown. Checked on complete matches,
// for any fixture, without depending on particular events of one seed:
//
//   presentation never changes the engine: same events, score and statistics as the engine alone
//   one engine minute is shown before the next one is generated
//   half time and full time happen once; the result is applied to the career once
//   a goal graphic waits for the team photo (or its fallback); a failed photo never stops the match
//   pause freezes clock, positions, ball and event phase; speed changes never restart an event
//   the 2D players and ball never jump across the pitch outside a placed restart
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { harness, playToEnd } = require('./engine-harness.cjs');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'dist', f), 'utf8');
const SUBSTITUTE = vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'engine-harness.cjs'), 'utf8').match(/const SUBSTITUTE = ('[^\n]+');/)[1]);
const ENGINE = 'JSON.stringify([M.events,M.hg,M.ag,M.stats])';

function engineOnly(fixture) {
  const h = harness();
  h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`);
  playToEnd(h);
  return h.run(ENGINE);
}

function withClock(fixture, { failPhotoEvery = 0 } = {}) {
  const h = harness();
  h.run(read('match3d-live-clock.js')); h.run(read('match-view-adapter.js'));
  h.run(`S=fresh();init();S.fixture=${fixture};ManagerStoryLive3D.enable();startMatch();resumeLive()`);
  const seen = { minutesMixed: 0, halfEvents: 0, goals: 0, photoWaits: 0, jumps: [], steps: 0, speedRestarts: 0 };
  let prev = null, goalsAcked = 0;
  for (let i = 0; i < 400000 && !(h.run('M.finished') && !h.run('ManagerStoryLive3D.finishing')); i++) {
    seen.steps++;
    const speed = [0.5, 1, 2][Math.floor(i / 400) % 3];
    const before = h.run('({id:pitchV73.active?.eventId??null,progress:pitchV73.progress})');
    h.run(`M.speed=${speed};ManagerStoryLive3D.step(.1,${i * 100})`);
    const after = h.run('({id:pitchV73.active?.eventId??null,progress:pitchV73.progress})');
    if (before.id != null && before.id === after.id && after.progress + 1e-9 < before.progress) seen.speedRestarts++;
    // one engine minute at a time in the queue
    if (h.run('pitchV73.queue.some(e=>e.gameSecond!==pitchV73.queue[0].gameSecond)')) seen.minutesMixed++;
    // goal: the net first, then the photo (acknowledged by the page, or failed and replaced by the fallback)
    const g = h.run('pitchV73.goalPresentation&&{stage:pitchV73.goalPresentation.stage,id:pitchV73.goalPresentation.goal.eventId}');
    if (g && g.stage === 'image') {
      seen.photoWaits++;
      const failed = failPhotoEvery > 0 && ++goalsAcked % failPhotoEvery === 0;
      h.run(`ManagerStoryLive3D.goalImageReady(M,${JSON.stringify(g.id)},${failed})`);
    }
    // 2D positions
    const frame = h.run(`(()=>{const v=MatchView.read();return v&&{ball:v.ball.displayPosition,pl:v.players.map(p=>[p.side+':'+p.id,p.displayPosition]),ev:pitchV73.active?.type??null,t:ManagerStoryLive3D.time}})()`);
    if (frame && prev && !['kickoff', 'restartPosition', 'restartPlayers', 'goal', 'half', 'end', 'sub', 'red'].includes(frame.ev) && !['kickoff', 'restartPosition', 'restartPlayers', 'goal', 'half', 'end', 'sub', 'red'].includes(prev.ev)) {
      const m = (a, b) => Math.hypot((a[0] - b[0]) * 1.05, (a[1] - b[1]) * 0.68);
      const was = new Map(prev.pl);
      for (const [k, pos] of frame.pl) { const w = was.get(k); if (pos && w && m(pos, w) > 6) seen.jumps.push({ k, d: +m(pos, w).toFixed(1), ev: frame.ev }); }
    }
    prev = frame;
    if (h.run('M.pause') && !h.run('M.finished')) {
      const reason = h.run('M.reason');
      if (reason === 'half') { seen.halfEvents++; h.run('startSecondHalf()'); }
      else if (reason === 'injury') h.run(SUBSTITUTE);
      else h.run('resumeLive()');
    }
  }
  seen.finished = h.run('M.finished') && !h.run('ManagerStoryLive3D.finishing');
  seen.engine = h.run(ENGINE);
  seen.ends = h.run("M.events.filter(e=>e.type==='end').length");
  seen.halves = h.run("M.events.filter(e=>e.type==='half').length");
  seen.goals = h.run("M.events.filter(e=>e.type==='goal').length");
  const results = h.run('S.results?.length||0');
  h.run('finishMatch();finishMatch()');
  seen.resultsAdded = h.run('S.results?.length||0') - results;
  seen.fixturePlayed = h.run('S.fixtures?S.fixtures.filter(f=>f.game&&f.game.played).length:null');
  return seen;
}

for (const fixture of (process.env.CLOCK_FIXTURES || '0,7').split(',').map(Number)) {
  test(`fixture ${fixture}: through the clock the match is the engine's — same events, score and statistics`, () => {
    const base = engineOnly(fixture), run = withClock(fixture);
    assert.ok(run.finished, 'the match reaches full time and the presentation drains');
    assert.equal(run.engine, base);
    assert.equal(run.minutesMixed, 0, 'one engine minute at a time');
    assert.equal(run.speedRestarts, 0, 'a speed change never restarts an event');
    assert.equal(run.halves, 1); assert.equal(run.ends, 1);
    assert.equal(run.resultsAdded, 1, 'the result is applied to the career once');
    if (run.goals) assert.ok(run.photoWaits >= run.goals, 'each goal graphic waits for the team photo');
    assert.deepEqual(run.jumps, [], '2D players move continuously');
  });
  test(`fixture ${fixture}: a team photo that fails to load falls back once and the match goes on`, () => {
    const run = withClock(fixture, { failPhotoEvery: 1 });
    assert.ok(run.finished);
    assert.equal(run.engine, engineOnly(fixture));
  });
}

test('pause freezes the clock, positions, ball and event phase', () => {
  const h = harness();
  h.run(read('match3d-live-clock.js')); h.run(read('match-view-adapter.js'));
  h.run('S=fresh();init();ManagerStoryLive3D.enable();startMatch();resumeLive()');
  for (let i = 0; i < 300; i++) h.run(`ManagerStoryLive3D.step(.1,${i * 100})`);
  h.run('M.pause=true');
  const before = h.run('JSON.stringify([M,pitchV73,ManagerStoryLive3D.time])');
  for (let i = 0; i < 50; i++) h.run(`ManagerStoryLive3D.step(.5,${40000 + i * 500})`);
  h.run('setMatchSpeed(.5);setMatchSpeed(2);setMatchSpeed(1)');
  // (choosing a speed re-anchors the wall clock: lastTime is bookkeeping, not match state)
  const strip = j => j.replace(/"speed":[\d.]+/g, '').replace(/"lastTime":[\d.]+/g, '');
  assert.equal(strip(h.run('JSON.stringify([M,pitchV73,ManagerStoryLive3D.time])')), strip(before));
});

test('the score and statistics on screen never run ahead of the engine', () => {
  const h = harness();
  h.run(read('match3d-live-clock.js')); h.run(read('match-view-adapter.js'));
  h.run('S=fresh();init();ManagerStoryLive3D.enable();startMatch();resumeLive()');
  for (let i = 0; i < 2800; i++) {
    h.run(`ManagerStoryLive3D.step(1/60,${i * 1000 / 60})`);
    if (i % 100 === 0) {
      assert.ok(h.run('pitchV73.eventScore[0]<=M.hg&&pitchV73.eventScore[1]<=M.ag'));
      assert.ok(h.run('pitchV73.eventStatistics.shots[0]<=M.shots[0]&&pitchV73.eventStatistics.shots[1]<=M.shots[1]'));
    }
  }
  assert.equal(h.run('M.events.some(e=>e.engineStatistics)'), false, 'presentation snapshots never enter saved events');
});

test('switching 2D/3D and the match tabs keeps the engine, RNG, events and pending presentation', () => {
  const h = harness();
  h.run(read('match3d-live-clock.js')); h.run(read('match-view-adapter.js'));
  h.run('S=fresh();init();startMatch();resumeLive()');
  h.run('window.originalMatch=M;setMatchView("3d");for(let i=0;i<20;i++)ManagerStoryLive3D.step(.05,i*50);');
  const state = 'JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress,ManagerStoryLive3D.time])';
  const before = h.run(state);
  for (const action of ['setMatchView("2d")', 'switchMatchTab("stats")', 'switchMatchTab("details")', 'switchMatchTab("pitch")', 'setMatchView("3d")']) h.run(action);
  assert.equal(h.run('M===originalMatch'), true);
  assert.equal(h.run(state), before);
  h.run('pauseLive()'); const paused = h.run('JSON.stringify(MatchView.read())');
  h.run('ManagerStoryLive3D.step(1,2000)');
  assert.equal(h.run('JSON.stringify(MatchView.read())'), paused);
});
