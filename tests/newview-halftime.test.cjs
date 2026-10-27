/* V7.9.5 half-time in the page: at the whistle the view gives way to the manager's screen; the second half
   starts while it is away; when it comes back (a resync) the teams are already in their new halves.
   Before V7.9.5 the keepers then ran the length of the pitch to their other goals (about 80 m each). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, playToEnd } = require('./engine-harness.cjs');
const srcDir = process.env.NV_SRC || path.join(__dirname, '..', 'src');

test('after half-time the keepers come back in their new goals: they do not run the length of the pitch', { timeout: 900000 }, async () => {
  const READ = `({pl:[...M.active.map(id=>[id,'user']),...M.oppIds.map(id=>[id,'opp'])].map(([id,s])=>[id,s,eventPoint(id,s)]),
   roster:[...M.active.map((id,i)=>({id,side:'user',name:String(id),role:M.matchRoles[id],no:i+1,moves:[],stars:1})),...M.oppIds.map((id,i)=>({id,side:'opp',name:id,role:playerAtMarker(id,'opp')?.position??(i?'CM':'GK'),no:i+1,moves:[],stars:1}))],n:M.events.length,reason:M.reason,own:M.ballOwner,side:M.ballSide,ball:[...(M.ballState?.position||[50,50])]})`;
  const h = harness(); h.run('S=fresh();init();S.fixture=3;startMatch();resumeLive()');
  const all = [h.run(READ)]; let halfAt = null;
  playToEnd(h, () => { const s = h.run(READ); if (s.n !== all.at(-1).n) all.push(s); if (halfAt == null && s.reason === 'half') halfAt = all.length - 1; });
  const events = h.run('M.events');
  const THREE = await import('three');
  const { loadRig } = await import(path.join(srcDir, 'core/presentation/match3d/newview/rig.js'));
  const { createRuntime, analyseGait } = await import(path.join(srcDir, 'core/presentation/match3d/newview/runtime.js'));
  const { createDirector } = await import(path.join(srcDir, 'core/presentation/match3d/newview/director.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(srcDir, 'assets/models/footballer-rig.json'), 'utf8')));
  const gait = {}; for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
  const rt = createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, numberTexture: null, stride: 0.75 });
  // the page's live arrays: only what the engine has produced so far
  const halfN = all[halfAt].n, liveEvents = events.slice(0, halfN), liveSnaps = all.slice(0, halfAt + 1).map(s => ({ n: s.n, pl: s.pl, ball: s.ball }));
  const meta = { user: all[0].roster.filter(r => r.side === 'user'), opp: all[0].roster.filter(r => r.side === 'opp'), teams: { home: {}, away: {} }, userHome: true };
  const noop = () => {};
  const director = createDirector(rt, { events: liveEvents, snaps: liveSnaps, meta }, { say: noop, banner: noop, flash: noop, excite: noop, minute: noop, slow: noop, whistle: noop, finished: noop, cam: noop, score: noop }, { startIndex: 0 });
  director.syncRoster(all[0].roster);
  const SUB = 1 / 120; let t = 0;
  const run = (sec) => { for (let k = 0; k < sec / SUB; k++) { rt.S.t += SUB; director.update(); for (const p of rt.players) if (!p.offPitch) rt.move(p, SUB); rt.stepBall(SUB); rt.contacts(); } };
  // play the first half out (fast, no drawing)
  for (let g = 0; g < 3600 * 2 && director.busy; g++) run(1);
  const gk = () => rt.players.filter(p => p.role === 'GK' && !p.offPitch).map(p => [p.side, +p.pos.x.toFixed(1)]);
  // the second half starts while the view is away: the engine has gone on to the next snapshot
  const next = all.slice(halfAt + 1, halfAt + 3);
  for (let i = halfN; i < next[0].n; i++) liveEvents.push(events[i]);
  // (the hardest order: the view resyncs first and only then gets the snapshot of where everyone stands now;
  //  since V7.9.5 the page records the snapshot first, and the director lays the teams out in their new halves either way)
  director.resync(next[0].own, next[0].side, next[0].ball);
  liveSnaps.push({ n: next[0].n, pl: next[0].pl, ball: next[0].ball });
  let ran = 0; const last = new Map(rt.players.map(p => [p, p.pos.clone()]));
  for (let k = 0; k < 8 / SUB; k++) { rt.S.t += SUB; director.update(); for (const p of rt.players) if (!p.offPitch) rt.move(p, SUB); rt.stepBall(SUB);
    for (const p of rt.players) if (p.role === 'GK') { const d = p.pos.distanceTo(last.get(p)); if (d < 1) ran += d; last.set(p, p.pos.clone()); } }
  // the match goes on: the next minute's events and snapshot arrive while the view is live
  for (const s of all.slice(halfAt + 2, halfAt + 5)) {
    for (let i = liveEvents.length; i < s.n; i++) liveEvents.push(events[i]);
    liveSnaps.push({ n: s.n, pl: s.pl, ball: s.ball });
    for (let k = 0; k < 6 / SUB; k++) { rt.S.t += SUB; director.update(); for (const p of rt.players) if (!p.offPitch) rt.move(p, SUB); rt.stepBall(SUB);
      for (const p of rt.players) if (p.role === 'GK') { const d = p.pos.distanceTo(last.get(p)); if (d < 1) ran += d; last.set(p, p.pos.clone()); } }
  }
  const ends = gk();
  assert.ok(ran < 40, 'keepers ran ' + ran.toFixed(1) + ' m after the restart (each should be at his new goal already)');
  // and they are at the ends they defend in the second half: each in front of the goal his snapshot puts him at
  const want = all[halfAt + 4].pl.filter(([id, side]) => rt.players.find(p => p.id === id && p.side === side)?.role === 'GK');
  assert.equal(want.length, 2);
  for (const [, side, pos] of want) { const x = ends.find(e => e[0] === side)[1]; assert.ok(Math.sign(x) === Math.sign(pos[0] - 50), side + ' keeper at ' + x); }
});
