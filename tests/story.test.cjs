/* Rules that used to name players (Mensah, Oğuz, Aras, Burak) or their place in the squad list now read the
   player's id and data/squad.js / data/story.js (V7.9.13, refactor B). These checks pin what they do. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

const career = () => { const g = loadGame(); g.run('S=fresh();S.matchSalt=7;init()'); return g; };

test('the first-season bid: week 3, day 2, for the starting striker, with the bids from the data', () => {
  const g = career();
  g.run('S.week=3;S.day=1;S.event=null;advance()');
  const e = g.json('S.event');
  assert.equal(e.kind, 'transfer');
  assert.equal(e.player, g.run('STORY_DATA.transferOffer.playerId'));
  assert.equal(e.text, 'Kuzey Liman, Mensah için ₺9.5M teklif etti. Oyuncunun temsilcisi de durumdan haberdar.');
  assert.deepEqual(e.choices, [['₺13M karşı teklif yap.', 'counter'], ['Teklifi reddet.', 'reject'], ['₺9.5M kabul et.', 'accept']]);
  g.run('choose("counter")');
  assert.equal(g.run('S.event.text'), "Kuzey Liman ₺11.5M'ye çıktı. Sportif direktör son kararını bekliyor.");
  const budget = g.run('S.budget');
  g.run('choose("accept115")');
  assert.equal(g.run('S.budget') - budget, 11.5e6);
  assert.equal(g.run('playerById(12).status'), 'Transfer oldu');
  assert.ok(g.run('!S.xi.includes(12)&&S.xi.includes(13)'), 'the replacement takes his place');
  assert.equal(g.run('S.inbox[0].from'), 'Burak ©');
  // not in a later season, and not when he has gone already
  const later = career(); later.run('S.seasonIndex=1;S.week=3;S.day=1;S.event=null;advance()');
  assert.notEqual(later.run('S.event?.kind'), 'transfer');
});

test('style edges: the quick striker against a high line, the target man against a deep block, nobody else', () => {
  const g = career();
  assert.equal(g.run('styleEdge(playerById(12),"high")'), 1.55);
  assert.equal(g.run('styleEdge(playerById(13),"deep")'), 1.45);
  assert.equal(g.run('styleEdge(playerById(12),"deep")'), 1);
  assert.equal(g.run('S.players.filter(p=>styleEdge(p,"high")!==1||styleEdge(p,"deep")!==1).map(p=>p.name).join()'), 'Mensah,Oğuz');
  // a signing with the same name has no edge: the edge belongs to the starting player
  assert.equal(g.run('styleEdge({id:999,name:"Mensah"},"high")'), 1);
});

test('the captain and the playmaker are the starting squad\'s, by id', () => {
  const g = career();
  assert.equal(g.run('captainName()'), 'Burak');
  assert.equal(g.run('playerById(STARTING_SQUAD.captain).name'), 'Burak');
  g.run('S.event={kind:"x",choices:[["a","arasFree"]]};choose("arasFree")');
  assert.equal(g.run('S.history.at(-1)'), "Aras'a serbestlik ve güven verdin.");
});
