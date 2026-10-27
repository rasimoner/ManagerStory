/* Refactor D4: which team in a match is the user's is a parameter of the engine, not an assumption.
   - By default it is what the game has always played: the club the career manages, with the career's squad.
   - The engine takes the user's players and the user's opponent from that parameter.
   - The league answers for any club: its fixture and its opponent this round. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

test('the user\'s team is the managed club and the career\'s squad unless a mode says otherwise', () => {
  const g = loadGame({ quiet: true });
  g.run('S=fresh();S.matchSalt=newMatchSalt();init()');
  assert.equal(g.run('userClub()===managedClubName()'), true);
  assert.equal(g.run('userSquad()===S.players'), true);
  assert.equal(g.run('userOpponent()===currentOpponent()'), true);
});

test('the engine plays the squad and the opponent of the team it is given', () => {
  const g = loadGame({ quiet: true });
  g.run('S=fresh();S.matchSalt=newMatchSalt();init();startMatch()');
  const full = g.run('strength()');
  g.run('setUserTeam({ squad: () => [] })');
  assert.equal(g.run('strength()'), 30, 'no players: the floor strength');
  g.run('setUserTeam()');
  assert.equal(g.run('strength()'), full, 'reset: the career squad again');
  // another club's point of view: its own fixture and rival this round
  const other = g.run('OPP[0][0]');
  g.run(`setUserTeam({ club: () => ${JSON.stringify(other)} })`);
  const f = g.json('currentFixture(userClub()).game');
  assert.ok(f.home === other || f.away === other, 'its own game');
  assert.notEqual(g.run('userOpponent()[0]'), other, 'not itself');
  g.run('setUserTeam()');
});

test('the league answers for any club; left out, the managed club', () => {
  const g = loadGame({ quiet: true });
  g.run('S=fresh();init()');
  assert.deepEqual(g.json('currentFixture()'), g.json('currentFixture(managedClubName())'));
  const club = g.run('OPP[5][0]');
  const f = g.json(`currentFixture(${JSON.stringify(club)})`);
  assert.equal(f.home ? f.game.home : f.game.away, club);
});
