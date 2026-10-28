/* Game data lives apart from the code, as plain data (V7.9.13, refactor B; .json files since refactor E4):
   - every file in src/data is JSON, an object, so another engine (Godot) can read it as it is; what each file
     holds is described in src/data/README.md;
   - every data file is used: the game imports it, under one name (the name tests reach it by);
   - the data says what the code used to say: the moves table matches the move names, the clubs cover the
     league, the starting squad is a full squad. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, gameSources, SRC } = require('./support/game.cjs');

const { loadLab } = require('./support/lab.cjs');
const dataSources = () => [...gameSources(), ...gameSources({ page: 'lab.html' })];

const files = fs.readdirSync(path.join(SRC, 'data')).filter(f => f.endsWith('.json')).sort().map(f => 'data/' + f);
const read = file => JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
// the name a data file goes by: what the modules that import it call it
const nameOf = file => {
  const names = new Set();
  for (const s of dataSources()) for (const m of s.code.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.{1,2}\/[^'"]+\.json)['"]/g)) {
    if (path.posix.normalize(path.posix.join(path.posix.dirname(s.file), m[2])) === file) names.add(m[1]);
  }
  return [...names];
};

test('every data file is JSON, an object, and nothing else is in src/data', () => {
  assert.ok(files.length >= 7, files.join(', '));
  for (const f of files) assert.equal(Object.prototype.toString.call(read(f)), '[object Object]', f);
  const other = fs.readdirSync(path.join(SRC, 'data')).filter(f => !f.endsWith('.json') && f !== 'README.md');
  assert.deepEqual(other, [], 'no code in src/data');
  const readme = fs.readFileSync(path.join(SRC, 'data/README.md'), 'utf8');
  for (const f of files) assert.ok(readme.includes(`## ${path.posix.basename(f)}`), `README describes ${f}`);
});

test('the game imports every data file, each under one name', () => {
  const names = files.map(f => { const n = nameOf(f); assert.equal(n.length, 1, `${f}: imported as ${n.join(', ') || 'nothing'}`); return n[0]; });
  assert.equal(new Set(names).size, names.length, 'one name per file');
});

test('the game reads the same values the data files hold', () => {
  const g = loadGame();
  const lab = loadLab();
  for (const f of files) {
    const name = nameOf(f)[0];
    const page = name in g.api ? g : lab;
    assert.deepEqual(page.json(name), read(f), f);
  }
  // what the code builds from the data
  assert.equal(g.run('OPP.length'), 17);
  assert.equal(g.run('Object.keys(CLUBSTYLE).length'), 18);
  assert.equal(g.run('CLUB_DATA.clubs.filter(c=>!c.team).map(c=>c.name).join()'), g.run('CLUB_DATA.startingClub'));
  assert.equal(g.run('P0.length'), 16);
  assert.equal(g.run('MOVE_DATA.moves.filter(m=>!m.keeper).length'), 19, 'the 19 outfield moves');
  assert.deepEqual(g.json('[...MOVE_DATA.starShow.order].sort()'), g.json('MOVE_DATA.moves.filter(m=>!m.keeper).map(m=>m.id).sort()'), 'every outfield move has a place in the star show');
});
