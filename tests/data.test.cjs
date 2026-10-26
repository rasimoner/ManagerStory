/* Game data lives apart from the code, as plain data (V7.9.13, refactor B):
   - every file in dist/data is one constant whose value is JSON (no functions, no references, no
     comments inside), so it can become a .json file at build time and be read by another engine;
   - index.html loads every data file, before any code;
   - the data says what the code used to say: the moves table matches the move names, the clubs cover the
     league, the starting squad is a full squad. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, pageScripts, DIST } = require('./support/game.cjs');

const files = fs.readdirSync(path.join(DIST, 'data')).filter(f => f.endsWith('.js')).sort().map(f => 'data/' + f);
const parse = file => {
  const text = fs.readFileSync(path.join(DIST, file), 'utf8');
  const m = /^\s*(?:\/\*[\s\S]*?\*\/\s*)?const ([A-Z][A-Z0-9_]*) = ([\s\S]*);\s*$/.exec(text);
  assert.ok(m, `${file}: one "const NAME = …;" after an optional leading comment`);
  return { name: m[1], value: JSON.parse(m[2]) };
};

test('every data file is a single constant whose value is JSON', () => {
  assert.ok(files.length >= 7, files.join(', '));
  const names = files.map(f => parse(f).name);
  assert.equal(new Set(names).size, names.length, 'one name per file');
});

test('index.html loads every data file, before any code', () => {
  const scripts = pageScripts().map(s => s.file);
  for (const f of files) assert.ok(scripts.includes(f), `${f} is loaded`);
  const lastData = Math.max(...files.map(f => scripts.indexOf(f)));
  const firstCode = scripts.findIndex(f => !f.startsWith('data/'));
  assert.ok(lastData < firstCode, 'data before code');
});

test('the game reads the same values the data files hold', () => {
  const g = loadGame();
  for (const f of files) {
    const { name, value } = parse(f);
    assert.deepEqual(g.json(name), value, name);
  }
  // what the code builds from the data
  assert.equal(g.run('OPP.length'), 17);
  assert.equal(g.run('Object.keys(CLUBSTYLE).length'), 18);
  assert.equal(g.run('CLUB_DATA.clubs.filter(c=>!c.team).map(c=>c.name).join()'), g.run('CLUB_DATA.startingClub'));
  assert.equal(g.run('P0.length'), 16);
  assert.equal(g.run('MOVE_DATA.moves.filter(m=>!m.keeper).length'), 19, 'the 19 outfield moves');
  assert.deepEqual(g.json('[...MOVE_DATA.starShow.order].sort()'), g.json('MOVE_DATA.moves.filter(m=>!m.keeper).map(m=>m.id).sort()'), 'every outfield move has a place in the star show');
});
