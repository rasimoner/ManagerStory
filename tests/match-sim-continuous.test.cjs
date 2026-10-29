const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function match() {
  const game = loadGame();
  game.run('S=fresh();init();S.matchSalt=73;S.experimentalMatchEngine=true;startMatch()');
  return game;
}

test('continuous viewing calculates every step and keeps the engine at the exact displayed time', () => {
  const game = match();
  for (let frame = 0; frame < 120; frame++) game.run('advanceExperimentalPlayback(1/60,{maxSteps:250})');
  assert.ok(game.run('M.matchElapsedSeconds>1'));
  assert.equal(game.run('M.matchElapsedSeconds'), game.run('M.simulation.time'));
  assert.equal(game.run('M.simulationPlayback.metrics.steps'), game.run('M.simulation.tick'));
  assert.equal(game.run('M.simulationDisplayFrame.players.length'), 22);
  assert.equal(game.run('M.simulationPlayback.frames'), undefined, 'there is no ahead-of-screen ring buffer');
  assert.ok(game.run('M.events.every(e=>e.simulationTime==null||e.simulationTime<=M.matchElapsedSeconds)'));
});

test('presentation speed changes smoothly and its integrated clock is independent of rendering cadence', () => {
  const game = match();
  const result = game.run(`(()=>{
    const a={currentRate:32},b={currentRate:32};let fast=0,slow=0;
    for(let i=0;i<60;i++)fast+=integrateSimulationViewRate(a,{seconds:1/60,targetRate:3});
    for(let i=0;i<15;i++)slow+=integrateSimulationViewRate(b,{seconds:1/15,targetRate:3});
    return {fast,slow,rate:a.currentRate};
  })()`);
  assert.ok(result.rate > 3 && result.rate < 4);
  assert.ok(Math.abs(result.fast - result.slow) < 1e-9);
});

test('pause, tactics and substitution requests are applied at the step the manager is watching', () => {
  const game = match();
  game.run('advanceExperimentalPlayback(.1,{maxSteps:512});pauseLive()');
  const tick = game.run('M.simulation.tick');
  game.run('advanceExperimentalPlayback(10);setMatchTactic("press","Yüksek")');
  assert.equal(game.run('M.simulation.tick'), tick);
  assert.equal(game.run('M.simulation.events.findLast(e=>e.type==="tactics").tick'), tick);
  game.run('queueExperimentalSubstitution({outId:M.active.at(-1),inId:eligibleSubstitutes()[0].id})');
  assert.equal(game.run('M.simulation.events.findLast(e=>e.type==="substitutionRequested").tick'), tick);
  assert.equal(game.run('M.matchElapsedSeconds'), game.run('M.simulation.time'));
});

test('saving a continuous match preserves both the view speed and its future physical course', () => {
  const game = match();
  for (let frame = 0; frame < 80; frame++) game.run('advanceExperimentalPlayback(1/30,{maxSteps:250})');
  game.run('save()');
  const restored = loadGame({ storage: new Map(game.storage) });
  for (const current of [game, restored]) for (let frame = 0; frame < 80; frame++) current.run('advanceExperimentalPlayback(1/30,{maxSteps:250})');
  assert.deepEqual(restored.json('M.simulationDisplayFrame'), game.json('M.simulationDisplayFrame'));
  assert.deepEqual(restored.json('M.events'), game.json('M.events'));
  assert.equal(restored.run('M.simulationPlayback.currentRate'), game.run('M.simulationPlayback.currentRate'));
});

test('second-half kickoff continues from a slow viewing rate without discarding sub-step time', () => {
  const game = match();
  game.run('advanceExperimentalSeconds(2700);M.speed=.5;M.simulationPlayback.currentRate=1;startSecondHalf()');
  for (let frame = 0; frame < 120; frame++) game.run('advanceExperimentalPlayback(1/60,{maxSteps:250})');
  assert.ok(game.run('M.simulation.time>2700.1'));
});

function finish(game, continuous) {
  game.ctx.continuousTest = continuous;
  game.run(`(()=>{let frames=0;while(!M.finished&&frames++<15000){
    if(M.reason==='half')startSecondHalf();
    if(M.requiredSubstitution){const bench=eligibleSubstitutes()[0];if(bench)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:bench.id});resumeLive();}
    if(continuousTest)advanceExperimentalPlayback(.1,{maxSteps:512});else advanceExperimentalSeconds(60);
  }if(!M.finished)throw new Error('Continuous match did not finish');})()`);
}

test('a whole continuous match has the same physical events and RNG as the headless match', () => {
  const watched = match(), headless = match();
  finish(watched, true);
  finish(headless, false);
  assert.equal(watched.run('M.simulation.rngState'), headless.run('M.simulation.rngState'));
  assert.deepEqual(watched.json('M.simulation.events'), headless.json('M.simulation.events'));
  assert.deepEqual(watched.json('M.simulation.match.score'), headless.json('M.simulation.match.score'));
  assert.equal(watched.run('M.simulationPlayback.metrics.steps'), 54000);
  assert.equal(watched.run('M.fieldView'), '2d');
});
