/* Randomness has one source: the seeded generator in random.js. (V7.9.13)
   - No game script calls Math.random: the page scripts, the 3D modules and the scene, whatever their files.
   - R is the same generator as ever: a fixed seed gives fixed numbers, and R(r.state) carries on.
   - Draws without a seed of their own (sale offers, the board's budget answer) come from sessionRandom,
     seeded once from the device: repeatable when the device entropy is fixed, as it is in tests. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, gameSources, DIST } = require('./support/game.cjs');

function moduleFiles(dir = '') {
  return fs.readdirSync(path.join(DIST, dir), { withFileTypes: true }).flatMap(d => {
    const f = path.posix.join(dir, d.name);
    if (d.isDirectory()) return f === 'vendor' ? [] : moduleFiles(f);
    return f.endsWith('.js') && f !== 'sw.js' ? [f] : [];
  });
}

test('no game script calls Math.random', () => {
  const scripts = [...gameSources({ layers: ['clock', 'view'] }).map(s => s.file), ...moduleFiles()];
  const offenders = [...new Set(scripts)].filter(f => /Math\.random/.test(fs.readFileSync(path.join(DIST, f), 'utf8')));
  assert.deepEqual(offenders, []);
  assert.ok(scripts.some(f => f.endsWith('random.js')) && scripts.some(f => f.endsWith('newview/director.js')), 'page scripts and modules both checked');
});

test('R: a fixed seed gives the same numbers as always, and its state resumes the sequence', () => {
  const g = loadGame();
  assert.equal(g.run('(()=>{const r=R(12345);return [r(),r(),r(),r(),r(),r.state].join(",")})()'),
    '0.9797282677609473,0.3067522644996643,0.484205421525985,0.817934412509203,0.5094283693470061,567906818');
  assert.equal(g.run('(()=>{const a=R(99);a();a();const b=R(a.state);return a()===b()&&a()===b()})()'), true);
});

test('sale offers and the board answer come from the session generator: repeatable with the same entropy', () => {
  const sell = entropy => {
    const g = loadGame({ entropy });
    g.run('S=fresh();S.matchSalt=1;init();const p=S.players.find(p=>!p.academyLocked&&!S.xi.includes(p.id));listPlayer(p.id)');
    g.run('S.v6.boardBudgetAskedWeek=-9;requestBoardBudget()');
    return g.json('[S.budget,S.board,S.inbox.slice(0,2).map(m=>m.title)]');
  };
  assert.deepEqual(sell(7), sell(7));
  const draws = entropy => loadGame({ entropy }).json('[sessionRandom(),sessionRandom(),sessionRandom()]');
  assert.deepEqual(draws(7), draws(7));
  assert.notDeepEqual(draws(7), draws(8), 'another device, other numbers');
});
