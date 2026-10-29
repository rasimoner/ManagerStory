const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { loadGame } = require('../tests/support/game.cjs');
const { playToEnd } = require('../tests/engine-harness.cjs');

function newCareer() {
  const game = loadGame();
  game.run('S=fresh();init();S.matchSalt=73;S.experimentalMatchEngine=true');
  return game;
}

function handleStop(game) {
  if (game.run('M.reason') === 'half') { game.run('startSecondHalf()'); return; }
  game.run(`if(M.requiredSubstitution){const bench=eligibleSubstitutes()[0];
    if(bench)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:bench.id});}
    if(M.pause)resumeLive();`);
}

function playExperimentalMatch(game, highlights = false) {
  let frames = 0;
  while (!game.run('M.finished') && frames++ < 10000) {
    handleStop(game);
    game.run(highlights ? 'advanceExperimentalPlayback(.1,{maxSteps:512})' : 'advanceExperimentalSeconds(60)');
  }
  if (!game.run('M.finished')) throw new Error('Career match did not finish.');
  return highlights ? frames / 10 : null;
}

function boostCurrentTeam(game, boost) {
  if (!boost) return;
  game.ctx.careerStrengthBoost = boost;
  game.run(`for(const p of M.simulation.teams.find(t=>t.id==='user').players){
    for(const key of Object.keys(p.attributes))if(typeof p.attributes[key]==='number'&&key!=='fitness')p.attributes[key]=Math.min(100,p.attributes[key]+careerStrengthBoost);
    for(const key of Object.keys(p.attributes.gk))p.attributes.gk[key]=Math.min(100,p.attributes.gk[key]+careerStrengthBoost);
    p.limits=playerMovementLimits(p.attributes);
  }`);
}

function recoverThroughCareer(game) {
  // These are the player's existing weekly recovery/training choices, not a new recovery formula.
  game.run('S.day=5;chooseBase("rest");S.day=1;chooseBase("fitness")');
}

function season(boost, progress) {
  const game = newCareer(), matches = [];
  for (let fixture = 0; fixture < 34; fixture++) {
    game.ctx.careerFixtureIndex = fixture;
    game.run('S.fixture=careerFixtureIndex;S.week=careerFixtureIndex+1;startMatch()');
    boostCurrentTeam(game, boost);
    playExperimentalMatch(game);
    matches.push(game.json('({fixture:S.fixture,home:M.home,away:M.away,score:[M.hg,M.ag],userGoals:userSide()===0?M.hg:M.ag,against:userSide()===0?M.ag:M.hg,shots:M.shots,xg:M.stats.xg,injuries:M.events.filter(e=>e.type==="injury").length,red:M.stats.red,fitness:S.players.filter(p=>M.playerStats[p.id]?.minutes>=80).map(p=>p.fitness),ratings:Object.values(M.playerStats).filter(p=>p.minutes>0).map(p=>p.rating)})'));
    game.run('finishMatch()');
    recoverThroughCareer(game);
    progress(fixture + 1, matches);
  }
  const table = game.json('[...S.table].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)');
  const club = game.run('managedClubName()');
  const row = table.find(team => team.n === club);
  return { boost, matches, table, rank: table.findIndex(team => team.n === club) + 1, record: row,
    players: game.json('S.players.map(p=>({id:p.id,name:p.name,goals:p.goals,assists:p.assists,minutes:p.minutes,yellow:p.yellow,red:p.red,fitness:p.fitness}))'),
    totalGoals: matches.reduce((sum, match) => sum + match.score[0] + match.score[1], 0),
    injuries: matches.reduce((sum, match) => sum + match.injuries, 0) };
}

function referenceMatch() {
  const game = newCareer();
  game.run('S.experimentalMatchEngine=false;startMatch();resumeLive()');
  playToEnd(game);
  return game.json('S.players.filter(p=>M.playerStats[p.id]?.minutes>=80).map(p=>({id:p.id,fitness:p.fitness,minutes:M.playerStats[p.id].minutes}))');
}

function playbackTrial() {
  const game = newCareer();
  game.run('startMatch()');
  const started = performance.now();
  const seconds = playExperimentalMatch(game, true);
  game.run('save()');
  return { seconds, computingMs: performance.now() - started,
    metrics: game.json('M.simulationPlayback.metrics'), score: game.json('[M.hg,M.ag]'),
    saveBytes: Buffer.byteLength(game.storage.get('msv4')), fitness: game.json('S.players.filter(p=>M.playerStats[p.id]?.minutes>=80).map(p=>({id:p.id,fitness:p.fitness,minutes:M.playerStats[p.id].minutes}))') };
}

function write(output) {
  fs.writeFileSync(process.argv[2] || 'docs/measurements/match-sim-career-season.json', JSON.stringify(output, null, 2) + '\n');
}

function report() {
  const output = { node: process.version, status: 'running', baseline: null, stronger: null, progress: null };
  output.playback = playbackTrial();
  output.legacyFitness = referenceMatch();
  if (process.argv.includes('--playback-only')) { output.status = 'playback-only'; write(output); return; }
  write(output);
  for (const [name, boost] of [['baseline', 0], ['stronger', 10]]) {
    output[name] = season(boost, (completed, matches) => {
      output.progress = { name, completed, matches };
      write(output);
      process.stdout.write(`${name}: ${completed}/34\n`);
    });
  }
  output.progress = null;
  output.status = 'complete';
  write(output);
}

if (require.main === module) report();
