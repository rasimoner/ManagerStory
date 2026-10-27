/* V7.9.6 season transition: the career carries on after the 34th round.
   - five seasons in a row (our rounds played headlessly with the league model, so it stays fast): squads,
     strength spread and league balance stay sensible, every save round-trips and can be exported
   - the season-end screens: summary, summer report, contract decisions, free agents, resuming mid-way
   - an old V7.9.5 save opens and gets the season fields
   - season 2 plays a real live match to the end (assists and the compact archive come from real events) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');
const { FAST } = require('./support/career-sim.cjs');
function harness(existing = new Map()) {
  const g = loadGame({ storage: existing });
  const h = { run: g.run, app: g.app, storage: g.storage, alerts: g.alerts };
  h.run(FAST);
  return h;
}
const json = (h, code) => JSON.parse(h.run(`JSON.stringify(${code})`));

test('five seasons in a row: squads, strength spread and league balance stay sensible; every save round-trips', () => {
  let h = harness();
  h.run('S=fresh();S.matchSalt=424242;init();save();render()');
  assert.equal(h.run('S.season'), '2025/26');
  assert.equal(h.run('S.seasonIndex'), 0);
  let lastOrder = json(h, 'S.leagueSchedule[0].map(g=>g.home+"-"+g.away)');
  for (let season = 1; season <= 5; season++) {
    h.run('fastSeason()');
    assert.equal(h.run('!!S.seasonEnd'), true, `season ${season}: the season end starts after round 34`);
    assert.match(h.app.innerHTML, /Final puan durumu/);
    assert.match(h.app.innerHTML, /ŞAMPİYON/);
    const summary = json(h, 'S.seasonEnd.data.summary');
    assert.equal(summary.table.length, 18);
    assert.ok(summary.table.every(t => t.p === 34), 'every club played 34 games');
    assert.ok(summary.rank >= 1 && summary.rank <= 18);
    assert.ok(summary.table[0].pts >= 50 && summary.table[0].pts <= 92, `champion points ${summary.table[0].pts}`);
    assert.ok(summary.table[0].pts - summary.table[17].pts >= 15, 'the table has a spread');
    assert.ok(summary.goals.length > 0, 'top scorers listed');
    h.run('autoSeasonEnd()');
    assert.equal(h.run('!!S.seasonEnd'), false, 'the pipeline finishes');
    // reload: the save written by the pipeline is the one the next season plays on
    h = harness(h.storage);
    assert.equal(h.run('S.seasonIndex'), season);
    assert.equal(h.run('S.season'), `${2025 + season}/${String(26 + season).padStart(2, '0')}`);
    assert.equal(h.run('S.week'), 1); assert.equal(h.run('S.day'), 1); assert.equal(h.run('S.fixture'), 0);
    assert.match(h.run('S.event.title'), /Sezonu Başlıyor/);
    assert.ok(json(h, 'S.table').every(t => t.p === 0 && t.pts === 0), 'table reset');
    assert.equal(h.run('S.leagueSchedule.length'), 34);
    assert.ok(h.run('allTeams().every(t=>S.leagueSchedule.reduce((n,r)=>n+r.filter(g=>g.home===t||g.away===t).length,0)===34)'), 'a full round robin');
    assert.ok(h.run('S.leagueSchedule.flat().every(g=>!g.played)'));
    const order = json(h, 'S.leagueSchedule[0].map(g=>g.home+"-"+g.away)');
    assert.notDeepEqual(order, lastOrder, 'a new fixture order'); lastOrder = order;
    // our squad
    const squad = json(h, 'S.players.map(p=>({id:p.id,age:p.age,pos:p.pos,ovr:p.overall,pot:p.potential,c:p.contract,st:p.status}))');
    assert.ok(squad.length >= 16 && squad.length <= 30, `squad size ${squad.length}`);
    assert.ok(squad.every(p => p.st !== 'Transfer oldu' && p.st !== 'Kirada'), 'departed players left the squad list');
    assert.ok(squad.some(p => p.pos.split('/')[0] === 'GK'), 'a goalkeeper');
    assert.ok(squad.every(p => p.c >= 1 && p.pot >= p.ovr && p.age <= 40));
    assert.equal(new Set(squad.map(p => p.id)).size, squad.length, 'unique ids');
    assert.equal(h.run('S.xi.length'), 11, 'a full first eleven');
    assert.ok(h.run('S.xi.every(id=>S.players.some(p=>p.id===id))'));
    // league squads: size, ages and each club around its own level
    const rivals = json(h, 'OPP.map(t=>({n:t[0],size:S.opponentSquads[t[0]].length,avg:S.opponentSquads[t[0]].slice(0,11).reduce((n,p)=>n+p.overall,0)/11,target:t[1]+LEAGUE_LIFT,ages:S.opponentSquads[t[0]].map(p=>p.age),ids:S.opponentSquads[t[0]].map(p=>p.id)}))');
    for (const r of rivals) {
      assert.ok(r.size >= 16 && r.size <= 17, `${r.n} squad ${r.size}`);
      assert.ok(Math.abs(r.avg - r.target) <= 3, `${r.n} starters ${r.avg.toFixed(1)} vs ${r.target}`);
      assert.ok(r.ages.every(a => a >= 16 && a <= 40), `${r.n} ages`);
      assert.equal(new Set(r.ids).size, r.ids.length, `${r.n} unique ids`);
    }
    const meanDev = rivals.reduce((n, r) => n + r.avg - r.target, 0) / rivals.length;
    assert.ok(Math.abs(meanDev) <= 2.5, `league level drift ${meanDev.toFixed(2)}`);
    const rivalAge = rivals.flatMap(r => r.ages).reduce((a, b) => a + b, 0) / rivals.flatMap(r => r.ages).length;
    assert.ok(rivalAge >= 23 && rivalAge <= 29, `league average age ${rivalAge.toFixed(1)}`);
    // market, academy, wonderkids, archive
    assert.ok(h.run('S.v6.transferPool.length') >= 110);
    assert.equal(h.run('S.v6.academy.length'), 5);
    assert.equal(h.run('S.v795.wonderkids.length'), season, 'one wonderkid every season');
    assert.equal(h.run('S.v796.seasons.length'), season);
    assert.ok(h.run('S.results.filter(r=>r.season<S.seasonIndex-1).every(r=>!r.matchSummary?.events)'), 'older seasons are compact');
    assert.doesNotThrow(() => h.run('validateCareerImport(JSON.parse(JSON.stringify(S)))'), 'the save can be exported and imported');
    assert.ok(h.run('JSON.stringify(S).length') < 2.5e6, 'save size');
    assert.deepEqual(h.alerts, []);
  }
  // over five summers the league renews itself: original league players have retired somewhere
  assert.ok(h.run('Object.values(S.opponentSquads).flat().filter(p=>/-s\\d+-/.test(p.id)).length') >= 40, 'league squads renewed');
  assert.ok(h.run('S.v796.former.length') >= 1, 'players have left over five seasons');
});

test('season-end screens: summary, summer report, contract decisions, free agents, resume mid-way', () => {
  let h = harness();
  h.run('S=fresh();S.matchSalt=97531;init();save();render()');
  // make the decisions visible: two contracts run out this summer, one veteran is certain to retire
  h.run('S.players.forEach(p=>p.contract=2);S.players.find(p=>p.name==="Kerem").contract=1;S.players.find(p=>p.name==="Taylan").contract=1;S.players.find(p=>p.name==="Serkan").age=37');
  h.run('fastSeason()');
  assert.equal(h.run('S.seasonEnd.steps[S.seasonEnd.at]'), 'summary');
  assert.match(h.app.innerHTML, /Sezon arasına geç/);
  assert.match(h.app.innerHTML, /ASİST/);
  assert.match(h.app.innerHTML, /Lig ödülü/);
  assert.match(h.app.innerHTML, /class=bottomnav/);
  // the header still shows the season that ended
  assert.match(h.app.innerHTML, /2025\/26/);
  // resume: a reload during the summary stays on the summary
  h = harness(h.storage);
  assert.equal(h.run('S.seasonEnd.steps[S.seasonEnd.at]'), 'summary');
  assert.match(h.app.innerHTML, /Final puan durumu/);
  h.run("seasonEndNext('summary')");
  assert.equal(h.run('S.seasonEnd.steps[S.seasonEnd.at]'), 'report');
  assert.match(h.app.innerHTML, /Bir yaş büyüdüler/);
  assert.match(h.app.innerHTML, /Serkan/);
  assert.equal(h.run('S.players.some(p=>p.name==="Serkan")'), false, 'the 38-year-old retired');
  assert.match(h.run('S.inbox.map(m=>m.title+" "+m.text).join("|")'), /Serkan/);
  assert.equal(h.run('S.players.find(p=>p.name==="Burak").age'), 30, 'everyone is a year older');
  h.run("seasonEndNext('report')");
  assert.equal(h.run('S.seasonEnd.steps[S.seasonEnd.at]'), 'contracts');
  assert.match(h.app.innerHTML, /Sözleşmesi bitenler/);
  assert.match(h.app.innerHTML, /Kerem/); assert.match(h.app.innerHTML, /Taylan/);
  assert.match(h.app.innerHTML, /2 karar bekliyor/);
  // no silent defaults: continuing without decisions is refused
  h.run("seasonEndNext('contracts')");
  assert.equal(h.run('S.seasonEnd.steps[S.seasonEnd.at]'), 'contracts');
  assert.equal(h.alerts.length, 1);
  const kerem = h.run('S.players.find(p=>p.name==="Kerem").id'), taylan = h.run('S.players.find(p=>p.name==="Taylan").id');
  const demand = h.run(`S.seasonEnd.data.expiring.find(x=>x.id===${kerem}).demand`);
  h.run(`seasonContractPick(${kerem},3);seasonContractPick(${taylan},0)`);
  assert.match(h.app.innerHTML, /Kararları onayla/);
  // resume again, now in the middle of the decisions
  h = harness(h.storage);
  assert.equal(h.run(`S.seasonEnd.data.decisions[${kerem}]`), 3);
  h.run("seasonEndNext('contracts')");
  assert.equal(h.run('!!S.seasonEnd'), false);
  assert.equal(h.run(`S.players.find(p=>p.id===${kerem}).contract`), 3);
  assert.equal(h.run(`S.players.find(p=>p.id===${kerem}).wage`), demand);
  assert.equal(h.run(`S.players.some(p=>p.id===${taylan})`), false);
  // Taylan is a free agent in the market and can be signed back in the transfer window
  const fa = json(h, 'S.v6.transferPool.find(x=>x.name==="Taylan")');
  assert.equal(fa.club, 'Serbest'); assert.ok(fa.free); assert.match(fa.id, /^v6fa\d+$/);
  assert.equal(h.run('transferOpen()'), true);
  const before = h.run('S.players.length'), maxId = h.run('Math.max(...S.players.map(p=>p.id),S.v796.maxPlayerId)');
  h.run(`v6Sign('${fa.id}',asking(S.v6.transferPool.find(x=>x.id==='${fa.id}')))`);
  assert.equal(h.run('S.players.length'), before + 1);
  assert.ok(h.run('S.players.at(-1).id') > maxId, 'a new id, never a departed player\'s');
  assert.equal(h.run('S.players.at(-1).name'), 'Taylan');
  h.run('render()');
  assert.match(h.app.innerHTML, /2026\/27/);
  assert.match(h.app.innerHTML, /Sezonu Başlıyor/);
  assert.doesNotThrow(() => h.run('validateCareerImport(JSON.parse(JSON.stringify(S)))'));
  // the new season's first week runs like any other: board answer, then the training day
  h.run("choose('ambitious')");
  assert.ok(['office', 'dynamic', 'meeting'].includes(h.run('S.event.kind')), h.run('S.event.kind'));
  assert.equal(h.run('S.week'), 1);
  assert.equal(h.run('!!S.seasonEnd'), false);
});

test('an old V7.9.5 save opens: season fields, contracts spread once, players and progress kept', () => {
  const h0 = harness();
  h0.run('S=fresh();S.matchSalt=1111;init();for(let i=0;i<5;i++)fastRound();S.event=null;nextEvent();save()');
  const old = JSON.parse(h0.storage.get('msv4'));
  for (const k of ['seasonIndex', 'season', 'v796', 'seasonEnd']) delete old[k];
  old.version = '7.9.5';
  old.players.forEach(p => { p.contract = p.id === 11 ? 3 : 2; delete p.careerGoals; delete p.careerApps; });
  old.results.forEach(r => delete r.season);
  old.v6.transferPool[0].id = 'v6wk1';   // a wonderkid offer: such saves used to fail the import check
  const h = harness(new Map([['msv4', JSON.stringify(old)]]));
  assert.equal(h.run('S.season'), '2025/26');
  assert.equal(h.run('S.seasonIndex'), 0);
  assert.equal(h.run('S.fixture'), 5);
  assert.equal(h.run('S.players.length'), old.players.length);
  assert.ok(h.run('S.results.every(r=>r.season===0)'));
  const contracts = json(h, 'S.players.map(p=>p.contract)');
  assert.ok(contracts.every(c => c >= 1 && c <= 4));
  assert.ok(new Set(contracts).size >= 2, 'contracts are spread, not all equal');
  // spread once: a reload keeps them
  const again = harness(h.storage);
  assert.deepEqual(json(again, 'S.players.map(p=>p.contract)'), contracts);
  assert.doesNotThrow(() => h.run('validateCareerImport(JSON.parse(JSON.stringify(S)))'));
  assert.equal(h.storage.get('msv4-v71-backup'), JSON.stringify(old), 'the pre-upgrade save is backed up untouched');
  // it then reaches its season end like a new career
  h.run('fastSeason()');
  assert.equal(h.run('S.seasonEnd.steps[S.seasonEnd.at]'), 'summary');
});

test('week-stamped counters move back one season, the first season keeps its fixed seeds', () => {
  const h = harness();
  h.run('S=fresh();S.matchSalt=2222;init();save()');
  // season 1 results are drawn exactly as before (no seed offset)
  assert.equal(h.run('seasonSeedOffset()'), 0);
  h.run('S.cooldowns.captain=33;S.promises.push({type:"minutes",player:7,due:36,atMinutes:0});S.v6.boardBudgetAskedWeek=32;S.v71.lastTacticWeek=34');
  h.run('fastSeason();autoSeasonEnd()');
  assert.equal(h.run('S.cooldowns.captain'), -1);
  assert.equal(h.run('S.promises.find(x=>x.player===7)?.due ?? "gone"') === 2 || h.run('S.players.some(p=>p.id===7)') === false, true);
  assert.equal(h.run('S.v6.boardBudgetAskedWeek'), -2);
  assert.equal(h.run('S.v71.lastTacticWeek'), 0);
  assert.equal(h.run('canEvent("captain",4)'), false, 'a cooldown set in the last weeks still holds early next season');
  assert.equal(h.run('Object.keys(S.sundayEvents).length'), 0);
  assert.ok(h.run('seasonSeedOffset()') > 0);
  // the Mensah offer was a first-season story: it does not come back
  h.run("S.week=3;S.day=2;S.event=null;nextEvent()");
  assert.notEqual(h.run('S.event.kind'), 'transfer');
});

test('season 2: a real live match plays to the end; assists come from its events and the archive stays compact', () => {
  let h = harness();
  h.run('S=fresh();S.matchSalt=31337;init();save()');
  h.run('fastSeason();autoSeasonEnd()');
  h.run("choose('calm')");
  h = harness(h.storage);
  assert.equal(h.run('S.seasonIndex'), 1);
  h.run('S.event=null;S.day=4;nextEvent();render()');
  assert.equal(h.run('S.event.kind'), 'matchday');
  h.run("modal='formation';render()");
  h.run('startMatch()');
  assert.equal(h.run('M.min'), 0);
  h.run('resumeLive();advanceLive(30)');
  for (let tries = 0; h.run('M.reason') === 'injury' && tries < 6; tries++) {
    h.run('(function(){const out=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const sub=S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&p.injury===0&&positionPenalty(p,M.matchRoles[out])>=.7);setSubOut(out);if(sub)doSub(sub.id);else S.players.find(p=>p.id===out).injury=0;resumeLive()})()');
    h.run('advanceLive(30)');
  }
  assert.equal(h.run('M.reason'), 'half');
  h.run("teamTalk('belief');startSecondHalf()");
  let tries = 0;
  while (!h.run('M.finished') && tries++ < 12) {
    h.run('advanceLive(40)');
    if (h.run('M.reason') === 'injury') h.run('(function(){const out=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const sub=S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&p.injury===0&&positionPenalty(p,M.matchRoles[out])>=.7);setSubOut(out);if(sub)doSub(sub.id);else S.players.find(p=>p.id===out).injury=0;resumeLive()})()');
    else if (h.run('M.pause') && !h.run('M.finished')) h.run('resumeLive()');
  }
  assert.equal(h.run('M.finished'), true);
  h.run('finishMatch()');
  assert.equal(h.run('M'), null);
  const r = json(h, 'S.results.at(-1)');
  assert.equal(r.season, 1);
  assert.ok(r.assists && typeof r.assists === 'object');
  const ourGoals = r.home === 'Anadolu Hisarı' ? r.hg : r.ag;
  const assists = Object.values(r.assists).reduce((a, b) => a + b, 0);
  assert.ok(assists <= ourGoals, `assists ${assists} ≤ goals ${ourGoals}`);
  assert.ok(r.matchSummary.events.length > 0, 'the current season keeps its replay chains');
  assert.equal(h.run('S.fixture'), 1);
  assert.equal(h.run('S.leagueSchedule[0].every(g=>g.played)'), true, 'the other games of the round were played');
  assert.ok(h.run('JSON.stringify(S).length') < 2.5e6);
});
