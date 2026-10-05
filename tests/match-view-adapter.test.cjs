const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { harness, playToEnd } = require('./engine-harness.cjs');
const adapter = fs.readFileSync(require('node:path').join(__dirname, '../dist/match-view-adapter.js'), 'utf8');
function setup() {
  const h = harness();
  h.run(adapter);
  return h;
}
test('view reads never initialize or mutate match/presentation/save state', () => {
  const h = setup();
  assert.equal(h.run('MatchView.read()'), null);
  h.run('S=fresh();init();startMatch();resumeLive();advanceLive(2)');
  const before = h.run('JSON.stringify([M,S,pitchV73])');
  const saved = JSON.stringify([...h.storage]);
  h.run('for(let i=0;i<100;i++){MatchView.read();MatchView.readEvents()}');
  assert.equal(h.run('JSON.stringify([M,S,pitchV73])'), before);
  assert.equal(JSON.stringify([...h.storage]), saved);
  assert.equal(h.run('MatchView.read().matchSeconds'), h.run('M.matchElapsedSeconds'));
  assert.equal(h.run('MatchView.read().players.length'), 22);
  assert.equal(h.run('MatchView.read().players.every(p=>p.facingRadians===null)'), true);
});
test('copies are deeply frozen; presentation sync stays distinct from match events', () => {
  const h = setup();
  h.run('S=fresh();init();startMatch();resumeLive();advanceLive(2);paintLivePitch()');
  assert.equal(h.run('Object.isFrozen(MatchView.read().players[0].enginePosition)'), true);
  const before = h.run('JSON.stringify([M,S,pitchV73])');
  assert.throws(() => h.run("'use strict';MatchView.read().players[0].enginePosition[0]=999"));
  assert.equal(h.run('JSON.stringify([M,S,pitchV73])'), before);
  h.run("queuePresentationCatchup(pitchV73,[1,1],120)");
  assert.equal(h.run('MatchView.read().presentation.source'), 'presentation-catchup');
  assert.equal(h.run('MatchView.read().ball.heightMeters'), null);
});
test('observing a full match preserves seeded events/results and stops after unsubscribe', () => {
  const a = setup(), b = harness();
  for (const h of [a,b]) h.run('S=fresh();init();startMatch();resumeLive()');
  a.run('window.received=0;window.unsubscribe=MatchView.subscribe(()=>window.received++)');
  playToEnd(a, () => a.run('MatchView.publish(pitchV73)'));
  playToEnd(b);
  assert.equal(a.run('JSON.stringify(M.events)'), b.run('JSON.stringify(M.events)'));
  assert.equal(a.run('JSON.stringify([M.hg,M.ag])'), b.run('JSON.stringify([M.hg,M.ag])'));
  assert.ok(a.run('window.received') > 0);
  const count = a.run('window.received');
  a.run('window.unsubscribe();MatchView.publish(pitchV73)');
  assert.equal(a.run('window.received'), count);
  assert.equal(a.run('MatchView.readEvents().at(-1).type'), 'end');
});
test('pass description derives existing phase timing without changing engine or save state',()=>{
 const h=setup();h.run('S=fresh();init();startMatch();resumeLive();advanceLive(2)');
 const before=h.run('JSON.stringify([M,S,pitchV73])'),saved=JSON.stringify([...h.storage]);
 h.run('window.examplePass=M.events.find(e=>e.type==="pass");window.passView=MatchView.describePass(examplePass)');
 assert.equal(h.run('passView.event.eventId'),h.run('examplePass.eventId'));
 assert.equal(h.run('passView.contactAt'),h.run('eventAnimationTime(examplePass)*.19'));
 assert.equal(h.run('passView.arrivalAt'),h.run('eventAnimationTime(examplePass)*.76'));
 assert.equal(h.run('Object.isFrozen(passView.event.fromPos)'),true);
 assert.equal(h.run('JSON.stringify([M,S,pitchV73])'),before);assert.equal(JSON.stringify([...h.storage]),saved);
});
