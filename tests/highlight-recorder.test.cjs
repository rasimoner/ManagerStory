/* What the manager's highlight archive records (modes/manager/highlight-recorder.js): a special move or a star
   save of one of ours in a 3D match (core's starMoment hook), a move learnt in training (with "▶ İzle" on the
   staff's note) or over the summer (core's movesLearned hook). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function career() {
  const g = loadGame({ quiet: true });
  g.run('S=fresh();S.matchSalt=1;init();save()');
  return g;
}

test('a star moment of one of ours in a match: a skill move or a keeper save, with the opponent, the minute and the seed', () => {
  const g = career();
  g.run('startMatch()');
  const opp = g.run('M.userHome?M.away:M.home'), star = g.json('S.players.find(p=>p.pos!=="GK")'), gk = g.json('S.players.find(p=>p.pos==="GK")');
  g.run(`starMoment({move:'elastico',playerId:${star.id},seed:41,minute:23})`);
  g.run(`starMoment({move:'pensave',playerId:${gk.id},seed:88,minute:67})`);
  g.run(`starMoment({move:'elastico',playerId:${star.id},seed:90,minute:80})`);
  const list = g.json('S.highlights');
  assert.equal(list.length, 2, 'the same move once a match');
  assert.deepEqual(list.map(h => [h.type, h.move, h.opponent, h.minute, h.seed, h.playerId]), [['skillMove', 'elastico', opp, 23, 41, star.id], ['keeperSave', 'pensave', opp, 67, 88, gk.id]]);
  assert.ok(list.every(h => h.season === '2025/26' && h.week === g.run('S.week') && h.stars >= 1));
  g.run('starMoment({move:"elastico",playerId:999999,seed:1,minute:1})');
  assert.equal(g.run('S.highlights.length'), 2, 'nobody of ours, nothing kept');
});

test('a move learnt in training: a newMove recipe and "▶ İzle" on the staff\'s note', () => {
  const g = career();
  const p = g.json('S.players[3]');
  g.run(`announceNewMoves(S.players[3],['rainbow'])`);
  const [h] = g.json('S.highlights');
  assert.deepEqual([h.type, h.move, h.playerId, h.seed, 'opponent' in h], ['newMove', 'rainbow', p.id, -1, false]);
  const note = g.json('S.inbox[0]');
  assert.equal(note.title, `${p.name} yeni hareket öğrendi`);
  assert.equal(note.highlight, h.id);
  assert.deepEqual(g.json('S.players[3].newMoves'), ['rainbow']);
});

test('a move learnt over the summer is recorded through the movesLearned hook', () => {
  const g = career();
  g.run(`movesLearned(S.players[5],['nutmeg','croqueta'])`);
  assert.deepEqual(g.json('S.highlights.map(h=>[h.type,h.move])'), [['newMove', 'nutmeg'], ['newMove', 'croqueta']]);
});
