const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadGame } = require('./support/game.cjs');
const { withoutVersion } = require('./support/golden.cjs');

function career(minutes = 7) {
  const game = loadGame();
  game.run('S=fresh();init();S.matchSalt=73;S.experimentalMatchEngine=true');
  game.api.setMatchDurationMinutes(minutes);
  game.run('startMatch()');
  return game;
}

function finish(game, skip = false) {
  game.ctx.durationSkipTest = skip;
  game.run(`(()=>{let guard=0;while(!M.finished&&guard++<1000){
    if(M.reason==='half')startSecondHalf();
    if(M.requiredSubstitution){const p=eligibleSubstitutes()[0];if(p)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:p.id});resumeLive();}
    if(durationSkipTest){skipExperimentalMatch();advanceExperimentalPlayback(.1,{maxSteps:512});}
    else advanceExperimentalSeconds(60);
  }if(!M.finished)throw new Error('Duration match did not finish');})()`);
}

test('format five defaults to seven minutes, persists four options and rejects invalid setting changes', () => {
  const game = loadGame();
  game.run('S=fresh();init();showSettings()');
  assert.equal(game.run('SAVE_SCHEMA'), 5);
  assert.equal(game.run('S.matchDurationMinutes'), 7);
  assert.equal(game.run('S.experimentalMatchEngine'), false);
  for (const minutes of [3, 5, 7, 10]) {
    assert.equal(game.api.setMatchDurationMinutes(minutes), true);
    const restored = loadGame({ storage: new Map(game.storage) });
    assert.equal(restored.run('S.matchDurationMinutes'), minutes);
  }
  for (const invalid of [null, 0, 6, NaN, Infinity, '7']) assert.equal(game.api.setMatchDurationMinutes(invalid), false);
  assert.equal(game.run('S.matchDurationMinutes'), 10);
  assert.match(game.html(), /Maç süresi/);
});

test('only default setting metadata is excluded from legacy goldens', () => {
  assert.deepEqual(withoutVersion({ schemaVersion: 5, experimentalMatchEngine: false, matchDurationMinutes: 7, score: [2, 1] }), { schemaVersion: 3, score: [2, 1] });
  assert.equal(withoutVersion({ schemaVersion: 5, experimentalMatchEngine: false, matchDurationMinutes: 3 }).matchDurationMinutes, 3);
});

test('the active duration survives later setting changes and reopening; only the next match uses the new choice', () => {
  const game = career(3);
  game.run('advanceExperimentalSeconds(40);setMatchDurationMinutes(10);pauseLive();save()');
  const restored = loadGame({ storage: new Map(game.storage) });
  assert.equal(restored.run('M.simulation.clock.durationSeconds'), 180);
  assert.equal(restored.run('M.simulation.time'), 40);
  assert.equal(restored.run('M.matchElapsedSeconds'), 1200);
  assert.equal(restored.run('S.matchDurationMinutes'), 10);
  restored.run('resumeLive()');
  finish(restored);
  restored.run('finishMatch();S.matchSalt=73;startMatch()');
  assert.equal(restored.run('M.simulation.clock.durationSeconds'), 600);
});

test('invalid loaded settings recover to seven minutes without changing an active duration', () => {
  const game = career(5);
  game.run('S.matchDurationMinutes=123;save()');
  const restored = loadGame({ storage: new Map(game.storage) });
  assert.equal(restored.run('S.matchDurationMinutes'), 7);
  assert.equal(restored.run('M.simulation.clock.durationSeconds'), 300);
});

test('full-time players receive 90 career minutes; a player entering at 60 minutes receives 30', () => {
  const game = career(3);
  game.run('advanceExperimentalSeconds(90);startSecondHalf();advanceExperimentalSeconds(30)');
  assert.equal(game.run('M.matchElapsedSeconds'), 3600);
  game.run('M.simulation.referee.stoppage={kind:"test"};queueExperimentalSubstitution({outId:M.active.at(-1),inId:eligibleSubstitutes()[0].id});M.simulation.referee.stoppage=null');
  const incoming = game.run('M.active.at(-1)');
  finish(game);
  assert.equal(game.api.M.playerStats[incoming].minutes, 30);
  assert.ok(game.run('Object.values(M.playerStats).some(row=>row.minutes===90)'));
  assert.equal(game.run('M.simulation.time'), 180);
  assert.ok(game.run('S.players.some(p=>p.minutes===90&&p.fitness<95)'));
});

test('pause and tactics do not advance time or substitute during live football', () => {
  const game = career(7);
  game.run('advanceExperimentalSeconds(40);pauseLive();setMatchTactic("press","Yüksek");queueExperimentalSubstitution({outId:M.active.at(-1),inId:eligibleSubstitutes()[0].id});advanceExperimentalPlayback(100)');
  assert.equal(game.run('M.simulation.tick'), 400);
  assert.equal(game.run('M.simulation.events.findLast(e=>e.type==="tactics").tick'), 400);
  assert.equal(game.run('M.simulation.events.filter(e=>e.type==="substitution").length'), 0);
  assert.equal(game.run('M.simulation.commands.substitutions.length'), 1);
});

test('save/reload and skip preserve the same short match, actual events and career totals', () => {
  const game = career(7);
  game.run('advanceExperimentalSeconds(97);save()');
  const restored = loadGame({ storage: new Map(game.storage) });
  finish(game);
  finish(restored, true);
  assert.deepEqual(restored.json('M.events'), game.json('M.events'));
  assert.deepEqual(restored.json('M.playerStats'), game.json('M.playerStats'));
  assert.equal(restored.run('M.simulation.rngState'), game.run('M.simulation.rngState'));
  assert.deepEqual(restored.json('S.players.map(p=>[p.id,p.minutes,p.goals,p.assists,p.yellow,p.red,p.fitness])'), game.json('S.players.map(p=>[p.id,p.minutes,p.goals,p.assists,p.yellow,p.red,p.fitness])'));
  assert.ok(game.run('M.simulation.events.every(e=>Math.abs(e.matchTime-e.time*5400/420)<1e-8)'));
});

test('a genuine V7.15.0 active experimental match retains its original duration and football result', () => {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures/saves/duration/v7.15.0-experimental.json'), 'utf8');
  const expected = require('./fixtures/saves/duration/v7.15.0-expected.json');
  const game = loadGame({ storage: new Map([['msv4', raw]]) });
  assert.equal(game.run('M.simulation.clock.model'), 'reference');
  assert.equal(game.run('M.simulation.clock.durationSeconds'), 5400);
  assert.equal(game.run('S.matchDurationMinutes'), 7);
  finish(game);
  const actual = game.json('({score:[M.hg,M.ag],rng:M.simulation.rngState,statistics:M.simulation.statistics,players:S.players.map(p=>[p.id,p.minutes,p.goals,p.assists,p.yellow,p.red,p.fitness])})');
  actual.eventsSha256 = createHash('sha256').update(game.run('JSON.stringify(M.events)')).digest('hex');
  assert.deepEqual(actual, expected);
});
