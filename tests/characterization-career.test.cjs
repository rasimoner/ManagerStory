/* Characterization: the career over seasons and the main screens, exactly as when recorded (V7.9.13).
   - Three seasons in a row (rounds through the league model, as in the season test, then the season end
     with the same automatic decisions): after each season the final table, our squad, the rival squads,
     the market, the academy, the wonderkids and the whole career record (as a hash).
   - The main screens of a career a few weeks in, and every season-end screen, as HTML.
   Recorded in tests/golden/; see tests/support/golden.cjs to regenerate. */
const test = require('node:test');
const { loadGame } = require('./support/game.cjs');
const { FAST } = require('./support/career-sim.cjs');
const { hash, matchJSON, matchText, withoutVersion } = require('./support/golden.cjs');

function career(salt) {
  const g = loadGame();
  g.run(FAST);
  g.run(`S=fresh();S.matchSalt=${salt};init();save();render()`);
  return g;
}

function seasonRecord(g) {
  const summary = g.json('S.seasonEnd.data.summary');
  return {
    season: g.run('S.season'),
    table: summary.table.map(t => `${t.n} ${t.p} ${t.gf}-${t.ga} ${t.pts}`),
    rank: summary.rank,
    scorers: summary.goals,
    squad: g.json('S.players.map(p=>[p.id,p.name,p.age,p.pos,p.overall,p.potential,p.status,p.contract])'),
    rivals: hash(g.json('S.opponentSquads')),
    market: hash(g.json('S.v6.transferPool')),
    academy: g.json('S.v6.academy.map(a=>[a.id,a.name,a.age,a.pos,a.overall,a.potential])'),
    wonderkids: g.json('S.v795.wonderkids'),
    careerHash: hash(withoutVersion(g.json('S'))),
  };
}

test('three seasons: tables, squads, market, academy and the career record are unchanged', () => {
  const g = career(424242);
  const seasons = [];
  for (let i = 0; i < 3; i++) {
    g.run('fastSeason()');
    seasons.push(seasonRecord(g));
    g.run('autoSeasonEnd()');
    seasons[i].afterSummerHash = hash(withoutVersion(g.json('S')));
  }
  matchJSON('seasons', seasons);
});

test('main screens of a career five weeks in: home, league, squad, tactics, transfers, academy, settings, inbox, profiles, live match', () => {
  const g = career(97531);
  g.run('for(let i=0;i<5;i++)fastRound();S.event=null;nextEvent();save();render()');
  for (const tab of ['home', 'league', 'squad', 'plan', 'formation', 'transfer', 'academy', 'settings']) {
    g.run(`goMain('${tab}')`);
    matchText(`screens/${tab}.html`, g.html());
  }
  // profiles: one of ours, one on the market, one in the academy
  g.run('showPlayerProfile(S.xi[9])');
  matchText('screens/profile-squad.html', g.html());
  g.run('showMarketProfile(S.v6.transferPool[0].id)');
  matchText('screens/profile-market.html', g.html());
  g.run('showAcademyProfile(S.v6.academy[0].id)');
  matchText('screens/profile-academy.html', g.html());
  g.run('showInbox()');
  matchText('screens/inbox.html', g.html());
  // the live match screen at the half-hour
  g.run('goMain("home");startMatch();resumeLive();advanceLive(20);render()');
  matchText('screens/match.html', g.html());
});

test('every season-end screen, from the summary to the new season', () => {
  const g = career(31337);
  g.run('fastSeason()');
  let guard = 0;
  while (g.run('!!S.seasonEnd') && guard++ < 20) {
    const step = g.run('S.seasonEnd.steps[S.seasonEnd.at]');
    g.run('render()');
    matchText(`screens/season-end-${String(guard).padStart(2, '0')}-${step}.html`, g.html());
    if (step === 'contracts') g.run('for(const x of S.seasonEnd.data.expiring)seasonContractPick(x.id,Math.min(2,x.maxYears))');
    g.run(`seasonEndNext('${step}')`);
  }
  g.run('render()');
  matchText('screens/season-start.html', g.html());
});
