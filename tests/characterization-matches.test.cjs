/* Characterization: the 34 league fixtures, each played to full time by the engine on a new career,
   must produce exactly the same match as when this golden master was recorded (V7.9.13):
   - the full event log (every field of every event, commentary included), as a hash;
   - the score, the match statistics and the career after finishMatch (fitness, morale, injuries, the
     other games of the round, the table…), as hashes;
   - a readable story of the match (shots, goals, cards, penalties, substitutions, injuries) and the count
     of each event type, so a change shows where it happened.
   Recorded in tests/golden/matches.json; see tests/support/golden.cjs to regenerate. */
const test = require('node:test');
const { harness, playToEnd } = require('./engine-harness.cjs');
const { hash, matchJSON, withoutVersion } = require('./support/golden.cjs');

const STORY = new Set(['shot', 'goal', 'yellow', 'red', 'penalty', 'sub', 'injury', 'half', 'end']);

function playFixture(fixture) {
  const h = harness();
  h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`);
  playToEnd(h);
  const json = code => JSON.parse(h.run(`JSON.stringify(${code})`));
  const events = json('M.events');
  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
  const record = {
    match: `${h.run('M.home')} – ${h.run('M.away')}`,
    score: `${h.run('M.hg')}-${h.run('M.ag')}`,
    events: events.length,
    eventsHash: hash(events),
    statsHash: hash(json('M.stats')),
    counts,
    story: events.filter(e => STORY.has(e.type)).map(e =>
      `${e.minute}' ${e.type} ${e.fromSide || e.side || ''}:${e.fromId ?? e.playerId ?? ''}${e.outcome ? ' ' + e.outcome : ''} ${e.homeGoals ?? ''}-${e.awayGoals ?? ''}`.trim()),
  };
  h.run('finishMatch()');
  record.careerAfterHash = hash(withoutVersion(json('S')));
  return record;
}

test('34 fixtures: event logs, scores, statistics and the career after the match are unchanged', () => {
  const only = process.env.GOLDEN_FIXTURES ? process.env.GOLDEN_FIXTURES.split(',').map(Number) : null;
  const all = {};
  for (let f = 0; f < 34; f++) all[f] = only && !only.includes(f) ? null : playFixture(f);
  if (only) {
    const golden = require('./golden/matches.json');
    for (const f of only) require('node:assert/strict').deepEqual(all[f], golden[f], `fixture ${f}`);
    return;
  }
  matchJSON('matches', all);
});
