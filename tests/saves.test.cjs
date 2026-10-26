/* Saves keep working. Every save in tests/fixtures/saves is loaded the two ways a player brings a career in
   (the browser's own save, and importing an exported file) and played on:
   - generated/ current saves at the moments a player can save (mid-season, season-end summary, mid-way
     through the season-end decisions, after three seasons, mid-match) — made by tests/support/make-saves.cjs;
   - legacy/    saves made by older releases (V7.8.2, V7.9.4, V7.9.5, V7.9.7);
   - real/      careers exported from a phone (added by hand; any *.json there is picked up).
   After loading: the career opens without an error, a match in progress is finished, an open season end
   is completed, the next league match is played through the live engine, every main screen draws, and the
   career can be exported again. For generated and legacy saves the result must also be exactly as recorded
   (tests/golden/saves.json), so a refactor cannot change what an old save turns into. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./support/game.cjs');
const { FAST } = require('./support/career-sim.cjs');
const { playToEnd } = require('./engine-harness.cjs');
const { hash, matchJSON, withoutVersion } = require('./support/golden.cjs');

const DIR = path.join(__dirname, 'fixtures/saves');
const saves = kind => fs.existsSync(path.join(DIR, kind))
  ? fs.readdirSync(path.join(DIR, kind)).filter(f => f.endsWith('.json')).sort().map(f => ({ name: `${kind}/${f}`, text: fs.readFileSync(path.join(DIR, kind, f), 'utf8') }))
  : [];

function playOn(g, text) {
  const record = { savedBy: JSON.parse(text).version };
  assert.equal(g.run('loadError'), '', 'loads without an error');
  assert.ok(g.run('!!S'), 'a career is open');
  assert.equal(g.run('S.version'), g.run('GAME_VERSION'), 'the save is brought up to this version');
  if (g.run('!!M')) { // a match was saved mid-way: it carries on to full time
    record.resumedAt = g.run('M.min');
    g.run('resumeLive()'); playToEnd(g);
    record.resumedScore = `${g.run('M.hg')}-${g.run('M.ag')}`;
    g.run('finishMatch()');
  }
  if (g.run('!!S.seasonEnd')) { g.run('autoSeasonEnd()'); record.seasonEndFinished = true; }
  g.run('S.event=null;M=null;modal=null');
  g.run('startMatch();resumeLive()'); playToEnd(g);
  record.match = `${g.run('M.home')} ${g.run('M.hg')}-${g.run('M.ag')} ${g.run('M.away')}`;
  record.matchHash = hash(g.json('M.events'));
  g.run('finishMatch();S.event=null;nextEvent()');
  for (const tab of ['home', 'league', 'squad', 'plan', 'transfer', 'academy']) {
    g.run(`goMain('${tab}')`);
    assert.ok(g.html().length > 500, `${tab} draws`);
  }
  assert.doesNotThrow(() => g.run('validateCareerImport(JSON.parse(JSON.stringify(S)))'), 'can be exported again');
  assert.deepEqual(g.alerts, [], 'no alerts');
  record.week = g.run('S.week'); record.season = g.run('S.season');
  record.careerHash = hash(withoutVersion(g.json('S')));
  return record;
}

const fromStorage = text => { const g = loadGame({ storage: new Map([['msv4', text]]) }); g.run(FAST); return g; };

async function fromImport(text) {
  // a player with a career open imports the exported file (Ayarlar → İçe aktar)
  const g = loadGame(); g.run(FAST);
  g.run('S=fresh();S.matchSalt=1;init();save();render()');
  g.ctx.__file = { size: Buffer.byteLength(text), text: async () => text };
  await g.run('importCareer(__file)');
  assert.deepEqual(g.alerts, [], 'import accepted');
  assert.ok(g.storage.get('msv4-before-import'), 'the career it replaced is kept');
  return g;
}

test('generated and legacy saves load, play on and give exactly the recorded result', async () => {
  const results = {};
  for (const { name, text } of [...saves('generated'), ...saves('legacy')]) {
    results[name] = playOn(fromStorage(text), text);
    const imported = playOn(await fromImport(text), text);
    assert.equal(imported.careerHash, results[name].careerHash, `${name}: importing gives the same career as loading`);
  }
  matchJSON('saves', results);
});

test('real saves exported from a phone load and play on', async t => {
  const real = saves('real');
  if (!real.length) return t.skip('no real saves yet (tests/fixtures/saves/real)');
  for (const { name, text } of real) {
    await t.test(name, async () => {
      playOn(fromStorage(text), text);
      playOn(await fromImport(text), text);
    });
  }
});
