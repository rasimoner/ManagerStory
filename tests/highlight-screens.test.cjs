/* The highlight archive on screen (modes/manager/highlight-screens.js): the archive is a detail screen of the
   squad tab (back to Kadro in the header), newest first, filtered by player, type and season; a player's
   profile shows his latest; the staff's new-move note carries "▶ İzle"; "İzle" plays the recipe's stage. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function career() {
  const g = loadGame({ quiet: true });
  g.run('S=fresh();S.matchSalt=1;init();save()');
  return g;
}
const add = (g, h) => g.run(`addHighlight(S.highlights,${JSON.stringify(h)})`);
const moment = (id, name, extra) => ({ type: 'skillMove', playerId: id, playerName: name, pos: 'RW', move: 'elastico', stars: 4, season: '2025/26', week: 3, opponent: 'Rakip', minute: 30, seed: 12, ...extra });

test('the squad tab leads to the archive; an empty archive says what goes in it', () => {
  const g = career();
  g.run("setModal('squad');render()");
  assert.match(g.html(), /data-action="showHighlights"[^>]*>🎬 Highlight arşivi</);
  g.run('showHighlightArchive({})');
  assert.match(g.html(), /<h1>Highlight arşivi<\/h1>/);
  assert.match(g.html(), /class="iconbtn navback"[^>]*data-to="openSquad"/, 'a detail screen: back to Kadro in the header');
  assert.match(g.html(), /Arşiv henüz boş/);
});

test('the archive: newest first, each with "▶ İzle"; by player, type and season', () => {
  const g = career();
  const [a, b] = g.json('S.players.slice(1,3).map(p=>[p.id,p.name])');
  add(g, moment(a[0], a[1]));
  add(g, moment(b[0], b[1], { move: 'rainbow', week: 5 }));
  add(g, moment(a[0], a[1], { type: 'newMove', move: 'nutmeg', week: 6, opponent: undefined, minute: undefined, seed: -1 }));
  g.run('showHighlightArchive({})');
  const html = g.html();
  const order = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]).filter(t => ['Elastico', 'Gökkuşağı', 'Bacak arası'].includes(t));
  assert.deepEqual(order, ['Bacak arası', 'Gökkuşağı', 'Elastico']);
  assert.equal((html.match(/data-action="watchHighlight"/g) || []).length, 3);
  assert.match(html, /2025\/26 • 3\. hafta • Rakip 30&#39;/);
  g.run(`setHighlightFilter('playerId','${a[0]}')`);
  assert.equal((g.html().match(/data-action="watchHighlight"/g) || []).length, 2);
  g.run("setHighlightFilter('type','newMove')");
  assert.equal((g.html().match(/data-action="watchHighlight"/g) || []).length, 1);
  g.run("setHighlightFilter('season','2030/31')");
  assert.match(g.html(), /Bu filtreyle highlight yok/);
});

test('his profile shows his latest highlights; the staff\'s note of a new move has "▶ İzle"', () => {
  const g = career();
  const id = g.run('S.players[4].id');
  g.run(`announceNewMoves(S.players[4],['rainbow'])`);
  g.run(`showPlayerProfile(${id})`);
  assert.match(g.html(), /<h3>Highlight'lar<\/h3>[\s\S]*Gökkuşağı[\s\S]*data-action="watchHighlight"/);
  g.run('showInbox()');
  assert.match(g.html(), /yeni hareket öğrendi[\s\S]*?data-action="watchHighlight" data-id="hl1">▶ İzle/);
});

test('İzle plays the recipe: its stage, its seed, a keeper\'s save with our keeper', () => {
  const g = career();
  const gk = g.json('S.players.find(p=>p.pos==="GK")');
  add(g, { type: 'keeperSave', playerId: gk.id, playerName: gk.name, pos: 'GK', move: 'starsave', stars: 3, season: '2025/26', week: 2, opponent: 'Rakip', minute: 70, seed: 55 });
  add(g, moment(7, 'Yıldız', { seed: 41 }));
  const keeper = g.json('watchOptions(S.highlights[0])'), skill = g.json('watchOptions(S.highlights[1])');
  assert.deepEqual([keeper.kind, keeper.seed, keeper.player.keeper, keeper.player.no, keeper.moveName], ['gkstarown', 55, true, gk.number, 'Yıldız kurtarış']);
  assert.deepEqual([skill.kind, skill.seed, skill.player.keeper, skill.moveName], ['elastico', 41, false, 'Elastico']);
});
