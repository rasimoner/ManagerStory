/* Whole matches through the presentation clock, compared with the engine alone (shared by
   match-clock.test.cjs and match-clock-fixtures.test.cjs). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, playToEnd, SUBSTITUTE } = require('../engine-harness.cjs');

const ENGINE = 'JSON.stringify([M.events,M.hg,M.ag,M.stats])';

function engineOnly(fixture) {
  const h = harness();
  h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`);
  playToEnd(h);
  return h.run(ENGINE);
}

function withClock(fixture, { failPhotoEvery = 0 } = {}) {
  const h = harness(undefined, { layers: ['clock', 'view'] });
  // as in a browser: the goal graphic loads the team photo (node has no Image, the clock would skip the wait)
  h.run('if(typeof Image!=="function")globalThis.Image=function(){}');
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
    const frame = h.run(`(()=>{const v=MatchView.read();return v&&{ball:v.ball.displayPosition,pl:v.players.map(p=>[p.side+':'+p.id,p.displayPosition]),ev:pitchV73.active&&(pitchV73.active.goalReset||pitchV73.active.restartReset)?'reset':pitchV73.active?.type??null,t:ManagerStoryLive3D.time}})()`);
    if (frame && prev && !['kickoff', 'restartPosition', 'restartPlayers', 'reset', 'goal', 'half', 'end', 'sub', 'red'].includes(frame.ev) && !['kickoff', 'restartPosition', 'restartPlayers', 'reset', 'goal', 'half', 'end', 'sub', 'red'].includes(prev.ev)) {
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

/* The two whole-match checks for each fixture. CLOCK_FIXTURES (default 0,7) chooses the fixtures; the
   first half of the list runs in match-clock.test.cjs, the rest in match-clock-fixtures.test.cjs, so the
   two files can run at the same time. */
const CLOCK_FIXTURES = (process.env.CLOCK_FIXTURES || '0,7').split(',').map(Number);
function clockFixtureTests(part) {
 const half = Math.ceil(CLOCK_FIXTURES.length / 2);
 for (const fixture of part === 0 ? CLOCK_FIXTURES.slice(0, half) : CLOCK_FIXTURES.slice(half)) {
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
}

module.exports = { clockFixtureTests };
