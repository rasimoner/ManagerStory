const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function playback() {
  const game = loadGame();
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch()');
  return game;
}

test('the lookahead is bounded, stores only a ring of frames, and never publishes a future goal', () => {
  const game = playback();
  for (let frame = 0; frame < 120; frame++) game.run('advanceExperimentalPlayback(1/60,{maxSteps:250})');
  assert.ok(game.run('M.matchElapsedSeconds>1'), 'filling the buffer must not deadlock the displayed clock');
  assert.ok(game.run('M.simulation.time-M.matchElapsedSeconds<=CAREER_SIM_DATA.playback.maximumLookaheadSeconds+.2'));
  assert.ok(game.run('M.simulationPlayback.frames.length<=CAREER_SIM_DATA.playback.capacity'));
  assert.ok(game.run('M.events.every(e=>e.simulationTime==null||e.simulationTime<=M.matchElapsedSeconds)'));
  assert.equal(game.run('M.hg+M.ag'), game.run('M.events.filter(e=>e.type==="goal").length'));
});

test('an upcoming shot forces real-speed playback before the event and speed buttons affect highlights only', () => {
  const game = playback();
  const result = game.run(`(()=>{
    const p={displaySeconds:100,windows:[{start:105,end:120}],mode:'fast'};
    const before=advanceHighlightClock(p,{seconds:1,speed:.5,limit:200});
    const slow=advanceHighlightClock(p,{seconds:2,speed:.5,limit:200});
    const fast=advanceHighlightClock(p,{seconds:2,speed:2,limit:200});
    return {before,slow,fast};
  })()`);
  assert.ok(result.before >= 105 && result.before < 106);
  assert.ok(Math.abs(result.slow - result.before - 1) < 1e-8);
  assert.ok(Math.abs(result.fast - result.slow - 4) < 1e-8);
});

test('saving the lookahead preserves the displayed frame, the pending events and the later course', () => {
  const game = playback();
  for (let frame = 0; frame < 80; frame++) game.run('advanceExperimentalPlayback(1/30,{maxSteps:250})');
  game.run('save()');
  const restored = loadGame({ storage: new Map(game.storage) });
  for (const current of [game, restored]) for (let frame = 0; frame < 80; frame++) current.run('advanceExperimentalPlayback(1/30,{maxSteps:250})');
  assert.deepEqual(restored.json('M.simulationDisplayFrame'), game.json('M.simulationDisplayFrame'));
  assert.deepEqual(restored.json('M.events'), game.json('M.events'));
});

test('the skip control finishes through the same events, stops for a required substitution, and never permits 3D', () => {
  const game = playback();
  game.run('skipExperimentalMatch()');
  game.run(`(()=>{let frames=0;while(!M.finished&&frames++<1000){
    if(M.requiredSubstitution){const bench=eligibleSubstitutes()[0];if(bench)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:bench.id});resumeLive();}
    advanceExperimentalPlayback(.1,{maxSteps:512});
  }})()`);
  assert.equal(game.run('M.finished'), true);
  assert.equal(game.run('M.hg+M.ag'), game.run('M.simulation.match.score.user+M.simulation.match.score.opponent'));
  assert.equal(game.run('M.fieldView'), '2d');
});
