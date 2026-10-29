const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');
const { withoutVersion, versionless } = require('./support/golden.cjs');

function career() {
  const game = loadGame();
  game.run('S=fresh();init();S.matchSalt=73');
  installDriver(game);
  return game;
}

function installDriver(game) {
  game.run(`function completeExperimentalMatchForTest(){
    let guard=0;
    while(!M.finished&&guard++<200){
      if(M.reason==='half')startSecondHalf();
      else if(M.requiredSubstitution){
        const bench=eligibleSubstitutes()[0];
        if(bench)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:bench.id});
        resumeLive();
      }else if(M.pause)resumeLive();
      advanceExperimentalSeconds(60);
    }
    if(!M.finished)throw new Error('Experimental match did not finish');
  }`);
}

function assertCareerStorageBudget(game, completed) {
  const result = game.api.S.results[0];
  game.api.S.results = Array.from({ length: 33 }, (_, index) => ({ ...structuredClone(result), week: index + 1 }));
  game.api.M = completed;
  game.run('save()');
  assert.equal(game.run('saveWarning'), false);
  assert.ok(game.storage.get('msv4').length * 2 < 5 * 1024 * 1024, '33 archived matches plus a complete active match fit the mobile UTF-16 quota');
}

test('format 3 migrates to format 4 with the experiment disabled, and the setting survives reopening', () => {
  const game = career();
  game.run('S.schemaVersion=3;delete S.experimentalMatchEngine;migrateSave(S)');
  assert.equal(game.run('S.schemaVersion'), 4);
  assert.equal(game.run('S.experimentalMatchEngine'), false);
  game.run('setExperimentalMatchEngine(true);save()');
  const reopened = loadGame({ storage: game.storage });
  assert.equal(reopened.run('S.experimentalMatchEngine'), true);
});

test('the legacy golden comparison excludes only the new default-off metadata and the added setting section', () => {
  assert.deepEqual(withoutVersion({ version: '7.15.0', schemaVersion: 4, experimentalMatchEngine: false, fixture: 9 }), { schemaVersion: 3, fixture: 9 });
  assert.equal(withoutVersion({ schemaVersion: 4, experimentalMatchEngine: true }).experimentalMatchEngine, true);
  assert.equal(versionless('<p>Legacy</p><section class=card data-experimental-setting>New switch</section>'), '<p>Legacy</p>');
});

test('the existing settings screen exposes the switch and an active match locks it', () => {
  const game = career();
  game.run('showSettings()');
  assert.match(game.html(), /Deneysel maç motoru/);
  game.click('setExperimentalMatchEngine', {}, { checked: true });
  game.run('startMatch();setExperimentalMatchEngine(false)');
  assert.equal(game.run('M.experimental'), true);
  assert.equal(game.run('S.experimentalMatchEngine'), true);
  game.run('setMatchView("3d")');
  assert.equal(game.run('M.fieldView'), '2d');
  assert.match(game.html(), /Yeni motorda 3D yakında/);
});

test('the adapter reads the actual first eleven, opponent identities, fitness and goalkeeper attributes', () => {
  const game = career();
  game.run('setExperimentalMatchEngine(true);startMatch()');
  assert.deepEqual(game.json('M.simulation.teams.find(t=>t.id==="user").players.map(p=>p.id).sort((a,b)=>a-b)'), game.json('[...S.xi].sort((a,b)=>a-b)'));
  assert.deepEqual(game.json('M.simulation.teams.find(t=>t.id==="opponent").players.map(p=>p.id)'), game.json('M.oppIds'));
  assert.equal(game.run('new Set(M.simulation.teams.find(t=>t.id==="opponent").players.map(p=>p.number)).size'), 11);
  assert.equal(game.run('M.simulation.seed'), game.run('matchSeed()'));
  assert.equal(game.run('S.matchSalt'), 73);
  assert.equal(game.run('M.simulation.workload.enabled'), true);
});

test('existing tactic controls affect only our team and an injury uses the required-substitution flow', () => {
  const game = career();
  game.run('setExperimentalMatchEngine(true);startMatch();advanceExperimentalSeconds(120)');
  const opponent = game.json('M.simulation.teams.find(t=>t.id==="opponent").tactics');
  game.run('setMatchTactic("press","Yüksek")');
  assert.equal(game.run('M.simulation.teams.find(t=>t.id==="user").tactics.press'), 'Yüksek');
  assert.deepEqual(game.json('M.simulation.teams.find(t=>t.id==="opponent").tactics'), opponent);
  game.run('injureSimulationPlayer(M.simulation,{playerId:M.active.at(-1),cause:"contact"});synchronizeExperimentalMatch()');
  assert.equal(game.run('M.reason'), 'injury');
  assert.equal(game.run('M.simulation.teams.find(t=>t.id==="user").players.length'), 10);
  game.run('queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:eligibleSubstitutes()[0].id})');
  assert.equal(game.run('M.requiredSubstitution'), null);
  assert.equal(game.run('M.simulation.teams.find(t=>t.id==="user").players.length'), 11);
});

test('repeating a pending substitution through the match screen keeps one request and explains the wait', () => {
  const game = career();
  game.run('setExperimentalMatchEngine(true);startMatch();advanceExperimentalSeconds(120);pauseLive();setSubOut(M.active.at(-1))');
  const incoming = game.run('eligibleSubstitutes()[0].id');
  assert.equal(game.api.doSub(incoming), true);
  game.run('setSubOut(M.active.at(-1))');
  assert.equal(game.api.doSub(incoming), false);
  assert.equal(game.run('M.simulation.commands.substitutions.length'), 1);
  assert.match(game.alerts.at(-1), /bekliyor/);
});

test('a complete experimental match writes goals, cards, minutes, fitness, table, summary and season records through career hooks', () => {
  const game = career();
  game.run('setExperimentalMatchEngine(true);startMatch();completeExperimentalMatchForTest()');
  assert.equal(game.run('M.finished'), true);
  assert.equal(game.run('M.hg+M.ag'), game.run('M.events.filter(e=>e.type==="goal").length'));
  assert.equal(game.run('Object.values(M.playerStats).reduce((n,p)=>n+p.goals,0)'), game.run('userSide()===0?M.hg:M.ag'));
  assert.ok(game.run('S.players.some(p=>p.minutes>0&&p.fitness<95)'));
  assert.equal(game.run('M.shots.reduce((a,b)=>a+b,0)'), game.run('M.simulation.events.filter(e=>e.type==="shot").length'));
  const completed = game.api.M;
  game.run('finishMatch()');
  assert.equal(game.run('S.results.length'), 1);
  assert.equal(game.run('S.results[0].matchSummary.players.length>=11'), true);
  assert.equal(game.run('S.results[0].season'), 0);
  assert.ok(game.run('S.table.every(t=>t.p===1)'));
  assertCareerStorageBudget(game, completed);
});

test('saving and reopening an experimental match resumes the same result without duplicating career events', () => {
  const game = career();
  game.run('setExperimentalMatchEngine(true);startMatch();advanceExperimentalSeconds(130);save()');
  const saved = new Map(game.storage);
  game.run('completeExperimentalMatchForTest()');
  const restored = loadGame({ storage: saved });
  installDriver(restored);
  restored.run('completeExperimentalMatchForTest()');
  assert.deepEqual(restored.json('M.events'), game.json('M.events'));
  assert.deepEqual(restored.json('M.playerStats'), game.json('M.playerStats'));
  assert.deepEqual(restored.json('S.players.map(p=>[p.id,p.goals,p.yellow,p.red,p.minutes,p.fitness])'), game.json('S.players.map(p=>[p.id,p.goals,p.yellow,p.red,p.minutes,p.fitness])'));
});

test('explicit simulation assists reach the season record even when intervening contact events exceed the old search window', () => {
  const game = career();
  const result = game.run('seasonMatchAssists({events:[{type:"goal",fromSide:"user",fromId:1,assistId:2,simulationEvent:true}]})');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { 2: 1 });
});

test('a simulation assist is recorded once in the career, match summary and derived season statistics', () => {
  const game = career();
  const result = { matchSummary: { engine: 'continuous', players: [{ id: 2, name: 'Furkan', minutes: 90, assists: 1, goals: 0, rating: 7 }] } };
  game.api.seasonRecordMatch({ experimental: true, events: [{ type: 'goal', fromSide: 'user', fromId: 1, assistId: 2, simulationEvent: true }] }, result);
  game.api.S.results = [result];
  assert.equal(game.run('S.players.find(p=>p.id===2).assists'), 1);
  assert.equal(result.matchSummary.players[0].assists, 1);
  assert.equal(game.run('seasonPlayerStats(0)[0].assists'), 1);
});
