/* Shirt numbers (V7.13.2): every player of ours has a real number of his own (player.number).
   - a new career: the squad wears its squad order, as it always showed
   - a signing, an academy promotion and a season-end top-up take a free number; a star asks for his wish
   - the season end keeps the numbers; a player who leaves frees his
   - an old save keeps the numbers its players showed; only a clash gets a free number (save migration)
   - the squad list, the profile and the 3D shirt read the same number */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, readSource } = require('./support/game.cjs');
const { FAST } = require('./support/career-sim.cjs');

function harness(storage = new Map()) {
  const g = loadGame({ storage, quiet: true });
  g.run(FAST);
  if (!storage.size) g.run('S=fresh();S.matchSalt=424242;init();save();render()');
  return g;
}
const squadNumbers = g => g.json('S.players.filter(p=>p.status!=="Transfer oldu").map(p=>p.number)');
function assertUnique(g, label) {
  const numbers = squadNumbers(g);
  const range = g.json('BALANCE.shirtNumbers');
  assert.ok(numbers.every(n => Number.isInteger(n) && n >= range.lowest && n <= range.highest), `${label}: everyone has a number (${numbers})`);
  assert.equal(new Set(numbers).size, numbers.length, `${label}: no two players share a number (${numbers})`);
}

test('a new career: the squad wears its squad order, one number each', () => {
  const g = harness();
  assert.deepEqual(squadNumbers(g), g.json('S.players.map((p,i)=>i+1)'));
  assertUnique(g, 'new career');
});

test('a signing takes the lowest free number; a sold player frees his', () => {
  const g = harness();
  g.run('S.budget=9e8');
  g.run('S.players[4].status="Transfer oldu"'); // number 5 leaves mid-season
  const x = g.json('S.v6.transferPool.find(x=>!x.star&&!starSceneQualifies(x))');
  g.run(`signTransfer('${x.id}',1000000)`);
  assert.equal(g.run('S.players.at(-1).number'), 5, 'the number the sold player left');
  const y = g.json('S.v6.transferPool.find(x=>!x.star&&!starSceneQualifies(x))');
  g.run(`signTransfer('${y.id}',1000000)`);
  assert.equal(g.run('S.players.at(-1).number'), 17, 'then the first one nobody wears');
  assertUnique(g, 'after two signings');
});

test('a star asks for his wish first, and may pick any free number', () => {
  const g = harness();
  g.run('S.budget=9e8;S.players[9].number=33');
  const x = g.json('S.v6.transferPool.find(x=>starSceneQualifies(x)&&!isGK(x.pos))');
  g.run(`signTransfer('${x.id}',12000000)`);
  assert.equal(g.run('S.players.at(-1).number'), 10, 'the 10 is free and first on the wish list');
  g.run('starSigningScreen();starPickNumber(1)');
  assert.equal(g.run('S.players.at(-1).number'), 10, 'the keeper’s 1 is taken');
  assertUnique(g, 'after a star signing');
});

test('an academy promotion takes a free number', () => {
  const g = harness();
  const a = g.json('S.v6.academy[0]');
  g.run(`promoteAcademyPlayer('${a.id}','warm')`);
  const p = g.json(`S.players.find(p=>p.academyCandidateId==='${a.id}')`);
  assert.equal(p.number, 17);
  assertUnique(g, 'after a promotion');
});

test('the season end keeps the numbers, frees the leavers’ and numbers the newcomers', () => {
  let g = harness();
  for (let season = 1; season <= 3; season++) {
    const before = g.json('Object.fromEntries(S.players.map(p=>[p.id,p.number]))');
    g.run('S.players[2].contract=1;S.players[2].age=36'); // a sure leaver: released or retired this summer
    g.run('fastSeason();autoSeasonEnd();save()');
    g = harness(g.storage);
    const after = g.json('S.players.map(p=>({id:p.id,number:p.number}))');
    for (const p of after) if (before[p.id] != null) assert.equal(p.number, before[p.id], `season ${season}: player ${p.id} kept his number`);
    assertUnique(g, `season ${season}`);
    // a squad thinned below the minimum is topped up from the academy, with free numbers
    g.run('while(S.players.length>14)departPlayer(S.players.at(-1),"sold");seasonTopUpSquad({data:{log:{}}})');
    assertUnique(g, `season ${season} top-up`);
    g.run('save()'); g = harness(g.storage);
  }
});

test('an old save keeps the numbers its players showed; only a clash gets a free number', () => {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/saves/legacy/v7.9.5.json'), 'utf8'));
  assert.ok(old.players.every(p => p.number == null), 'the fixture has no numbers');
  // the 3D match showed each player's place in the list
  const shown = old.players.map((p, i) => [p.id, i + 1]);
  let g = harness(new Map([['msv4', JSON.stringify(old)]]));
  for (const [id, n] of shown) if (g.run(`S.players.find(p=>p.id===${id})?.status`) !== 'Transfer oldu') assert.equal(g.run(`S.players.find(p=>p.id===${id}).number`), n);
  assertUnique(g, 'old save');
  // a later save: a star picked the 4 after a leaver moved the list up, so two players showed 4
  const clash = structuredClone(old);
  clash.players.forEach(p => delete p.number);
  clash.players[10].number = 4;
  g = harness(new Map([['msv4', JSON.stringify(clash)]]));
  assert.equal(g.run(`S.players.find(p=>p.id===${clash.players[10].id}).number`), 4, 'the chosen number stays');
  const moved = g.run(`S.players.find(p=>p.id===${clash.players[3].id}).number`);
  assert.notEqual(moved, 4, 'the one who only wore his place gets a free number');
  assert.equal(moved, 11, 'the place the star’s own list slot left free');
  for (const [i, p] of clash.players.entries()) if (i !== 3 && i !== 10) assert.equal(g.run(`S.players.find(p=>p.id===${p.id}).number`), i + 1, 'nobody else changes');
  assertUnique(g, 'clash');
});

test('the squad list, the profile and the 3D shirt show the same number', () => {
  const g = harness();
  g.run('S.players[5].number=27;modal="squad";render()');
  const p = g.json('S.players[5]');
  assert.ok(g.html().includes(`<span class=shirtno>27</span> <span class=badge>${p.pos}</span>`), 'the squad list');
  g.run(`showPlayerProfile(${p.id})`);
  assert.ok(g.html().includes('<span class=shirtno>27</span>'), 'the profile');
  // the 3D view reads player.number and nothing else (it needs WebGL, so the source is checked)
  const view = readSource('match3d-newview.js');
  assert.match(view, /no: p\??\.number\b/);
  assert.doesNotMatch(view, /indexOf\(p\)\s*\+\s*1/, 'no more squad-place numbers');
});
