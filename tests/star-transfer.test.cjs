/* Yıldız transfer sahnesi: which signings get the scene (one threshold), what he shows, the shirt number he
   picks, the highlight record kept for the coming archive, and old saves (and saves carrying other new
   fields) still loading. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../dist');
const { loadGame } = require('./support/game.cjs');

function harness() {
  const g = loadGame({ prepend: true, quiet: true, document(q, app) {
    // the transfer office picture: the test card goes right after it (V7.9.8: no longer before the header)
    if (q === '#app .vscene' && app.innerHTML.includes('<div class="vscene')) return { insertAdjacentHTML(_w, html) { const a = app.innerHTML.indexOf('<div class="vscene'), e = app.innerHTML.indexOf('</div>', a) + 6; app.innerHTML = app.innerHTML.slice(0, e) + html + app.innerHTML.slice(e); } };
  } });
  g.run('S=fresh();S.matchSalt=newMatchSalt();init();save();render()');
  return { run: g.run, html: g.html, json: g.json };
}
// the best outfield star on the market and a player below the threshold
const pick = (h, cond) => h.run(`S.v6.transferPool.find(x=>{const r=starShowRating(x);return ${cond}})?.id`);

test('one threshold decides: 4–5 star players get the scene, keepers by their overall', () => {
  const h = harness();
  assert.equal(h.run('STAR_SCENE_MIN_STARS'), 4);
  // defined once (the only place to change it)
  assert.equal(require('./support/game.cjs').gameSources().map(x => x.code).join('\n').match(/const STAR_SCENE_MIN_STARS\b/g).length, 1);
  assert.equal(h.run(`starSceneQualifies({pos:'CAM',overall:80,dribbling:90,technique:90,vision:80,finishing:70,composure:70})`), true);
  assert.equal(h.run(`starSceneQualifies({pos:'CB',overall:80,dribbling:50,technique:55,vision:50,finishing:30,composure:60})`), false);
  // a keeper's skill stars are always 1; for the scene his overall counts
  assert.deepEqual(h.json(`[79,80,84,85].map(o=>starShowRating({pos:'GK',overall:o}).stars)`), [3, 4, 4, 5]);
  assert.equal(h.run(`starSceneQualifies({pos:'GK',overall:80})`), true);
  assert.equal(h.run(`starSceneQualifies({pos:'GK',overall:79})`), false);
  // the market's own stars agree with the list cards (recordMoves)
  assert.equal(h.run(`S.v6.transferPool.filter(x=>x.pos!=='GK').every(x=>starShowRating(x).stars===recordMoves(x).stars)`), true);
});

test('he shows his most spectacular move; a keeper the scorpion; nobody is left without a show', () => {
  const h = harness();
  assert.equal(h.run(`starShowMove({moves:['nutmeg','elastico','cruyff']})`), 'elastico');
  assert.equal(h.run(`starShowMove({moves:['trap','cruyff']})`), 'cruyff');
  assert.equal(h.run(`starShowMove({moves:[]})`), 'juggle');
  assert.equal(h.run(`starShowMove({keeper:true,moves:['scorpion']})`), 'scorpion');
  assert.equal(h.run(`starShowMove({keeper:true,moves:[]})`), 'gkvolley');
  // the order holds the 19 special moves, each once
  const order = h.json('STAR_SHOW_ORDER');
  assert.equal(new Set(order).size, 19);
  assert.ok(order.every(m => h.run(`!!SKILL_NAMES['${m}']`)), 'every move has a name');
});

test('a big signing: breaking news, a free shirt number, the highlight record, the announcement screen', () => {
  const h = harness();
  const id = pick(h, 'r.stars>=4&&!r.keeper');
  assert.ok(id, 'the market has a 4–5 star player');
  h.run('S.budget=9e8;S.week=3;S.fixture=2');
  const before = h.json('S.players.map((p,i)=>Number.isInteger(p.number)?p.number:i+1)');
  h.run(`v6Sign('${id}',12000000)`);
  const p = h.json('S.players.at(-1)');
  assert.ok(Number.isInteger(p.number) && !before.includes(p.number), 'his number is not worn by anyone else');
  const hl = h.json('S.highlights');
  assert.equal(hl.length, 1);
  assert.deepEqual({ ...hl[0], move: typeof hl[0].move }, { id: 'hl1', kind: 'star-transfer', playerId: p.id, playerName: p.name, pos: p.pos, move: 'string', stars: hl[0].stars, keeper: false, fee: 12000000, fromClub: hl[0].fromClub, season: '2025/26', week: 3, matchday: 3 });
  assert.ok(hl[0].stars >= 4);
  assert.ok(h.run(`S.inbox.some(m=>m.title.startsWith('SON DAKİKA')&&m.title.includes(${JSON.stringify(p.name)}))`), 'breaking news in the inbox');
  assert.match(h.html(), /class="stflash"/, 'the announcement screen, not the old photo');
  assert.match(h.html(), /özel hareket/);
  assert.ok(h.html().includes('★★★★'), 'big stars');
  // saved: the record survives a reload
  assert.equal(JSON.parse(h.run('localStorage.getItem("msv4")')).highlights.length, 1);
});

test('a small signing keeps the old flow and leaves no record', () => {
  const h = harness();
  const id = pick(h, 'r.stars<4&&!r.keeper');
  h.run('S.budget=9e8');
  h.run(`v6Sign('${id}',3000000)`);
  assert.equal(h.run('S.highlights?.length||0'), 0);
  assert.ok(!h.html().includes('class="stflash"'));
  assert.ok(!h.run('Number.isInteger(S.players.at(-1).number)'), 'no number is forced on him');
});

test('the shirt number: only free numbers can be picked', () => {
  const h = harness();
  const id = pick(h, 'r.stars>=4&&!r.keeper');
  h.run('S.budget=9e8;S.players[9].number=33');
  h.run(`v6Sign('${id}',12000000)`);
  const free = h.json('freeShirtNumbers(S.players.at(-1).id)');
  assert.ok(!free.includes(33) && !free.includes(1) && !free.includes(9), 'explicit and squad-place numbers are taken');
  assert.ok(free.includes(10), 'the 10th player wears 33, so 10 is free');
  h.run('starSigningScreen()');
  h.run('starPickNumber(10)');
  assert.equal(h.run('S.players.at(-1).number'), 10);
  h.run('starPickNumber(33)');
  assert.equal(h.run('S.players.at(-1).number'), 10, 'a taken number is refused');
  assert.match(h.html(), /10 numarayla sahaya çık/);
  assert.match(h.html(), /Atla/, 'the signing can be skipped');
});

test('the home page carries the flash card for the week of the signing and the next', () => {
  const h = harness();
  const id = pick(h, 'r.stars>=4&&!r.keeper');
  h.run('S.budget=9e8;S.week=4');
  h.run(`v6Sign('${id}',12000000)`);
  h.run('starFlow=null;modal=null;render()');
  assert.match(h.html(), /stflashcard/);
  assert.match(h.html(), /Sahneyi izle/);
  h.run('S.week=5;render()'); assert.match(h.html(), /stflashcard/);
  h.run('S.week=6;render()'); assert.ok(!h.html().includes('stflashcard'), 'gone two weeks later');
});

test('the test button plays the scene on a copy: nothing is bought, numbered or recorded', () => {
  const h = harness();
  h.run('showV6Transfers()');
  assert.match(h.html(), /Transfer sahnesi dene/);
  assert.ok(h.html().indexOf('sttry') > h.html().indexOf('hisarhead'), 'the test card sits under the header, not above it');
  const before = h.run('JSON.stringify(S)');
  h.run(`starTransferTrial('out')`);
  assert.match(h.html(), /DENEME/);
  h.run('starSigningScreen();starPickNumber(freeShirtNumbers(-1)[0])');
  h.run(`starTransferTrial('gk')`);
  assert.equal(h.run('JSON.stringify(S)'), before);
});

test('old saves and saves with other new fields load; the archive starts empty', () => {
  const h = harness();
  // an old save: no archive, no shirt numbers; plus fields another branch may add (contracts, free agents)
  h.run(`(()=>{const d=structuredClone(S);delete d.highlights;d.players.forEach(p=>{delete p.number;p.contractInfo={years:2,wage:1e5}});d.freeAgents=[{name:'Serbest'}];d.seasonState={phase:'regular'};
    S=migrateSave(validateCareerImport(d));init();save();render()})()`);
  assert.deepEqual(h.json('ensureHighlights()'), []);
  assert.equal(h.run('latestStarTransfer()'), null);
  assert.equal(h.run('S.freeAgents.length'), 1, 'unknown fields are kept');
  assert.equal(h.run('S.players[0].contractInfo.years'), 2);
  // a save carrying an archive and numbers survives export/import
  const id = pick(h, 'r.stars>=4&&!r.keeper');
  h.run(`S.budget=9e8;v6Sign('${id}',12000000)`);
  h.run('S=validateCareerImport(JSON.parse(JSON.stringify(S)));init();render()');
  assert.equal(h.run('S.highlights.length'), 1);
  assert.equal(h.run('S.highlights[0].playerId===S.players.at(-1).id'), true);
});

test('the page loads the scene files and the offline cache keeps them', () => {
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(base, 'sw.js'), 'utf8');
  assert.match(html, /<script src="star-transfer\.js\?v=[\d.]+"><\/script>/);
  assert.match(sw, /"\.\/star-transfer\.js\?v=[\d.]+"/);
  assert.match(sw, /"\.\/star-transfer-scene\.js"/);
  const scene = fs.readFileSync(path.join(base, 'star-transfer-scene.js'), 'utf8');
  const t = scene.match(/export const TIMES = (\{[^}]+\})/)[1];
  const T = Function(`return ${t}`)();
  assert.ok(T.walk + T.cheer + T.fade + T.showMax + T.after + T.closing <= 30, 'the 3D part stays short');
});

test('with the season transition: the star keeps his number and his clip into the next season', () => {
  const h = harness();
  const { FAST } = require('./support/career-sim.cjs');
  h.run(FAST);
  const id = pick(h, 'r.stars>=4&&!r.keeper');
  h.run(`S.budget=9e8;S.week=3;v6Sign('${id}',12000000);starFlow=null`);
  const star = h.json('(({id,number,name})=>({id,number,name}))(S.players.at(-1))');
  const season0 = h.run('S.season');
  h.run('fastSeason();autoSeasonEnd();render()');
  assert.notEqual(h.run('S.season'), season0, 'a new season started');
  assert.equal(h.run(`S.players.find(p=>p.id===${star.id})?.number`), star.number, 'he kept his number');
  assert.ok(!h.json(`freeShirtNumbers(-1)`).includes(star.number), 'nobody else can take it');
  assert.equal(h.run('S.highlights.length'), 1, 'the clip stays in the archive');
  assert.equal(h.run('S.highlights[0].season'), season0);
  assert.equal(h.run('latestStarTransfer()'), null, 'the flash card belongs to the season of the signing');
  h.run('S=validateCareerImport(JSON.parse(JSON.stringify(S)));init();render()');
  assert.equal(h.run('S.highlights.length'), 1);
});
