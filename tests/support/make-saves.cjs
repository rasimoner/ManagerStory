/* Makes the save fixtures the save tests load (run by hand: node tests/support/make-saves.cjs).
   - generated/: saves of the current game at the moments a player can save: mid-season, on the season-end
     summary, in the middle of the season-end decisions, after three seasons, in the middle of a match.
   - legacy/:    saves made by older releases (their dist taken from git), so loading them keeps working.
   Saves are what the game keeps in localStorage ("msv4"), the same JSON a career export contains.
   Real saves exported from a phone go in real/ by hand; nothing here touches them. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadGame } = require('./game.cjs');
const { FAST } = require('./career-sim.cjs');
const { playToEnd } = require('../engine-harness.cjs');

const OUT = path.resolve(__dirname, '../fixtures/saves');
const write = (dir, name, text) => { fs.mkdirSync(path.join(OUT, dir), { recursive: true }); fs.writeFileSync(path.join(OUT, dir, name + '.json'), text); console.log(dir + '/' + name, (text.length / 1024).toFixed(0) + ' KB'); };
const saved = g => { g.run('save()'); return g.storage.get('msv4'); };

function generated() {
  const start = salt => { const g = loadGame(); g.run(FAST); g.run(`S=fresh();S.matchSalt=${salt};init();save();render()`); return g; };
  let g = start(1111);
  g.run('for(let i=0;i<17;i++)fastRound();S.event=null;nextEvent()');
  write('generated', 'mid-season', saved(g));

  g = start(2222);
  g.run('fastSeason()');
  write('generated', 'season-end-summary', saved(g));
  g.run("seasonEndNext('summary');seasonEndNext(S.seasonEnd.steps[S.seasonEnd.at])");
  write('generated', 'season-end-contracts', saved(g));

  g = start(3333);
  g.run('for(let i=0;i<3;i++){fastSeason();autoSeasonEnd()}');
  write('generated', 'after-three-seasons', saved(g));

  g = start(4444);
  g.run('for(let i=0;i<6;i++)fastRound();S.event=null;nextEvent();startMatch();resumeLive();advanceLive(20);pauseLive()');
  write('generated', 'mid-match', saved(g));
}

// older releases: a new career, one league match played through the live engine, saved
const LEGACY = { 'v7.8.2': '7f1ec48', 'v7.9.4': 'e24fcba', 'v7.9.5': 'fe6638d', 'v7.9.7': 'a09a6af' };
function legacy() {
  for (const [name, commit] of Object.entries(LEGACY)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-' + name + '-'));
    execFileSync('sh', ['-c', `git archive ${commit} dist | tar -x -C ${dir}`], { cwd: path.resolve(__dirname, '../..') });
    // (the presentation clock and view boundary are left out, as the current tests leave them out)
    const g = loadGame({ root: path.join(dir, 'dist'), skip: ['match3d-live-clock.js', 'match-view-adapter.js'], quiet: true });
    g.run('S=fresh();S.matchSalt=5555;init();save();render()');
    g.run('startMatch();resumeLive()'); playToEnd(g); g.run('finishMatch();S.event=null;save()');
    write('legacy', name, saved(g));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

generated();
legacy();
