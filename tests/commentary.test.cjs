// Commentary lines read as Turkish sentences: nothing undefined or null leaks into them, and a match
// does not repeat one sentence per event type.
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, playToEnd } = require('./engine-harness.cjs');

for (const fixture of [0, 5]) {
  test(`fixture ${fixture}: every commentary line is a complete sentence`, () => {
    const h = harness(); h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`); playToEnd(h);
    const lines = h.run('M.events.flatMap(e=>[e.text,presentationEvent(e).text]).filter(Boolean)');
    const broken = lines.filter(t => /undefined|null|NaN|\[object/.test(t));
    assert.equal(broken.length, 0, broken.slice(0, 3).join(' | '));
    // variety: the most common sentence (names masked) is not most of the match
    const masked = lines.map(t => t.replace(/^\d+['’]\s*/, '').replace(/[A-ZÇĞİÖŞÜ][\wçğıöşü]*/g, 'X'));
    const counts = {}; for (const m of masked) counts[m] = (counts[m] || 0) + 1;
    const top = Math.max(...Object.values(counts));
    assert.ok(top / masked.length < 0.12, 'most common sentence ' + (100 * top / masked.length).toFixed(1) + '%');
  });
}
