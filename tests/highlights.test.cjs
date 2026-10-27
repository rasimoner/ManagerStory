/* The career's highlight archive (src/core/highlights.js): a highlight is not the scene but the small recipe
   that plays it again — type, player, move, season and week, opponent and minute in a match, the seed — and
   a player keeps his best moments only, by one rule that lives in data/balance.json (highlights). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

const g = loadGame();
const { addHighlight, bestHighlights, archiveView, stageKindFor, HIGHLIGHT_RULES } = g.api;
const plain = v => JSON.parse(JSON.stringify(v));        // (the game's objects come from another realm)

const when = (season, week) => ({ season, week });
const skill = (move, extra = {}) => ({ type: 'skillMove', playerId: 7, playerName: 'Yıldız', pos: 'RW', move, stars: 4, ...when('2025/26', 3), opponent: 'Rakip', minute: 30, seed: 12, ...extra });

test('a highlight is a recipe: an id, the type, the player, the move, when, the match and the seed', () => {
  const list = [];
  const rec = addHighlight(list, skill('elastico'));
  assert.deepEqual(plain(rec), { id: 'hl1', type: 'skillMove', playerId: 7, playerName: 'Yıldız', pos: 'RW', move: 'elastico', stars: 4, season: '2025/26', week: 3, opponent: 'Rakip', minute: 30, seed: 12 });
  assert.equal(addHighlight(list, skill('nutmeg', { week: 4 })).id, 'hl2', 'ids go up');
  assert.throws(() => addHighlight(list, { ...skill('x'), type: 'goal' }), /type/);
});

test('the same moment is kept once: a move once a match, a new move and a big signing once a player', () => {
  const list = [];
  addHighlight(list, skill('elastico', { minute: 20 }));
  assert.equal(addHighlight(list, skill('elastico', { minute: 70 })).minute, 20, 'the first elastico of that match stays');
  addHighlight(list, skill('elastico', { week: 4 }));
  addHighlight(list, { ...skill('rainbow'), type: 'newMove', opponent: undefined, minute: undefined });
  addHighlight(list, { ...skill('rainbow'), type: 'newMove', week: 9 });
  addHighlight(list, { ...skill('elastico'), type: 'starTransfer', fee: 1e6, fromClub: 'X' });
  addHighlight(list, { ...skill('elastico'), type: 'starTransfer', fee: 2e6, fromClub: 'Y' });
  assert.deepEqual(list.map(h => h.type), ['skillMove', 'skillMove', 'newMove', 'starTransfer']);
  assert.equal(list[2].opponent, undefined, 'outside a match there is no opponent or minute');
  assert.ok(!('minute' in list[2]));
});

test('a player keeps his best ten moments: type first, then stars, then a move he has not shown yet, then the newest', () => {
  assert.equal(HIGHLIGHT_RULES.perPlayer, 10);
  const rank = HIGHLIGHT_RULES.typeRank;
  assert.ok(rank.starTransfer > rank.keeperSave && rank.keeperSave > rank.skillMove && rank.skillMove > rank.newMove);
  const list = [];
  addHighlight(list, { ...skill('stepover'), type: 'newMove' });
  for (let w = 1; w <= 12; w++) addHighlight(list, skill('nutmeg', { week: w, stars: w < 3 ? 5 : 4 }));
  addHighlight(list, skill('cruyff', { week: 20 }));
  addHighlight(list, { ...skill('elastico'), type: 'starTransfer', week: 1 });
  addHighlight(list, skill('nutmeg', { playerId: 8, week: 2 }));
  const mine = list.filter(h => h.playerId === 7);
  assert.equal(mine.length, 10);
  assert.ok(mine.some(h => h.type === 'starTransfer'), 'the signing stays');
  assert.ok(mine.some(h => h.move === 'cruyff'), 'a move not shown yet comes before another nutmeg');
  assert.ok(mine.some(h => h.type === 'newMove'), 'so does the only stepover, though a new move ranks lowest');
  const nutmegs = mine.filter(h => h.move === 'nutmeg').map(h => h.week).sort((a, b) => a - b);
  assert.deepEqual(nutmegs, [1, 2, 8, 9, 10, 11, 12], 'the 5-star ones, then the newest');
  assert.equal(list.filter(h => h.playerId === 8).length, 1, 'another player keeps his own');
  assert.deepEqual(bestHighlights(mine).map(h => h.id), bestHighlights(list.filter(h => h.playerId === 7)).map(h => h.id));
});

test('the archive: newest first, by player, type and season', () => {
  const list = [];
  addHighlight(list, skill('elastico', { season: '2025/26', week: 3 }));
  addHighlight(list, { ...skill('scorpion'), type: 'keeperSave', playerId: 1, pos: 'GK', week: 5 });
  addHighlight(list, skill('nutmeg', { season: '2026/27', week: 1 }));
  assert.deepEqual(archiveView(list).map(h => h.move), ['nutmeg', 'scorpion', 'elastico']);
  assert.deepEqual(archiveView(list, { playerId: 7 }).map(h => h.move), ['nutmeg', 'elastico']);
  assert.deepEqual(archiveView(list, { type: 'keeperSave' }).map(h => h.move), ['scorpion']);
  assert.deepEqual(archiveView(list, { season: '2025/26' }).map(h => h.move), ['scorpion', 'elastico']);
});

test('a recipe says which scene plays it: keeper saves have their own stage', () => {
  assert.equal(stageKindFor({ move: 'elastico' }), 'elastico');
  assert.equal(stageKindFor({ move: 'scorpion' }), 'scorpion');
  assert.equal(stageKindFor({ move: 'pensave' }), 'gkpen');
  assert.equal(stageKindFor({ move: 'starsave' }), 'gkstarown');
});
