// The new 3D match view, without a browser: the real engine plays complete matches, the view's
// director and pitch runtime play every engine event on the simulated pitch, and the rules the
// old renderer's tests protected are checked on the new view.
//
//   every engine event is played, in order, without stalls; the score shown is the engine's
//   no teleports: players move within football speeds, the ball only jumps for a placed restart
//   the ball stays in play unless the engine puts it out
//   ownership changes at a real touch (no ball snapped to a player)
//   recorded motions meet the ball: sliding boot, forehead
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, playToEnd } = require('./engine-harness.cjs');

const dist = path.join(__dirname, '..', 'dist');

// ---- engine side: what the view reads, recorded once a minute exactly as match3d-newview.js does ----
const READ = `({
  pl:[...M.active.map(id=>[id,'user']),...M.oppIds.map(id=>[id,'opp'])].filter(([id,s])=>!(s==='user'&&M.sentOff?.includes(id))).map(([id,s])=>[id,s,eventPoint(id,s)]),
  ball:[...(M.ballState?.position||[50,50])],
  roster:[...M.active.map((id,i)=>{const p=S.players.find(x=>x.id===id);return {id,side:'user',name:p?.name??String(id),role:M.matchRoles[id],no:p?.number??(S.players.indexOf(p)+1||i+1)}}),
          ...M.oppIds.map((id,i)=>{const p=playerAtMarker(id,'opp');return {id,side:'opp',name:p?.name??id,role:p?.position??(i?'CM':'GK'),no:i+1}})],
  n:M.events.length })`;

function recordMatch(fixture) {
  const h = harness();
  h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`);
  const teams = h.run("({home:resolveClubIdentity('goal',{teamId:M.home}),away:resolveClubIdentity('goal',{teamId:M.away})})");
  const userHome = h.run('M.userHome');
  const first = h.run(READ), snaps = [{ n: first.n, pl: first.pl, roster: first.roster }];
  playToEnd(h, () => { const s = h.run(READ); if (s.n !== snaps.at(-1).n) snaps.push(s); });
  const events = h.run('M.events'), score = h.run('[M.hg,M.ag]');
  return { events, snaps, teams, userHome, score, roster: first.roster };
}

// ---- view side: director + runtime on the simulated pitch, at the view's own step ----
async function playMatch(rec) {
  const THREE = await import(path.join(dist, 'vendor/three/three.module.min.js'));
  const { loadRig } = await import(path.join(dist, 'newview/rig.js'));
  const { createRuntime, analyseGait } = await import(path.join(dist, 'newview/runtime.js'));
  const { createDirector } = await import(path.join(dist, 'newview/director.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(dist, 'assets/models/footballer-rig.json'), 'utf8')));
  const gait = {}; for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
  const rt = createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, numberTexture: null, stride: 0.75 });

  // teleports the view is allowed: a kickoff/restart layout, i.e. rt.place
  const placed = new Set(), place = rt.place;
  rt.place = (p, ...a) => { placed.add(p); return place(p, ...a); };

  const shown = { score: [0, 0] };
  const meta = { user: rec.roster.filter(r => r.side === 'user'), opp: rec.roster.filter(r => r.side === 'opp'), teams: rec.teams, userHome: rec.userHome };
  const director = createDirector(rt, { events: rec.events, snaps: rec.snaps, meta }, {
    say() {}, banner() {}, flash() {}, excite() {}, minute() {}, cam() {}, slow() {}, whistle() {}, finished() {},
    score: (h, a) => { shown.score = [h, a]; },
  }, { startIndex: 0, debug: true });

  const out = { maxSpeed: 0, maxDive: 0, playerJumps: [], ballJumps: [], outWithoutLeave: 0, simSeconds: 0 };
  const SUB = 1 / 120, players = rt.players, ball = rt.ball;
  const prev = new Map(), prevBall = ball.p.clone(), seen = new Map();
  let rosterKey = '', step = 0;
  // the ball is placed (not played) for a kickoff, a restart and a penalty
  const PLACEMENT = new Set(['kickoff', 'restartPosition']);
  while (director.busy && out.simSeconds < 4 * 3600) {
    // substitutions and red cards reach the pitch with the snapshot of their minute
    const snap = rec.snaps.find(s => s.n > director.index) || rec.snaps.at(-1);
    const key = JSON.stringify(snap.roster.map(r => [r.side, r.id]));
    if (key !== rosterKey) { director.syncRoster(snap.roster); rosterKey = key; }
    for (const p of players) prev.set(p, p.pos.clone());
    prevBall.copy(ball.p);
    rt.S.t += SUB; out.simSeconds += SUB;
    director.update();
    for (const p of players) if (!p.offPitch) rt.move(p, SUB);
    rt.stepBall(SUB); rt.contacts();
    const current = director.current?.type;
    if (process.env.NV_BALL && step % 6 === 0) { const [a0, a1] = process.env.NV_BALL.split(':').map(Number); if (rt.S.t > a0 && rt.S.t < a1) console.log('ball', rt.S.t.toFixed(2), current, director.current?.eventId, ball.p.toArray().map(v => v.toFixed(2)).join(','), 'v', ball.v.toArray().map(v => v.toFixed(1)).join(','), 'owner', ball.owner?.id, 'held', !!ball.held); }
    // what the viewer sees: the drawn body (a keeper's dive moves the body, not the root)
    if (step++ % 2 === 0) {
      for (const p of players) {
        if (p.offPitch) continue;
        rt.pose(p, 2 * SUB);
        const now = p.model.position.clone().setY(0), was = seen.get(p);
        seen.set(p, now);
        if (!was || placed.has(p)) continue;
        const d = now.distanceTo(was), v = d / (2 * SUB);
        if (p.dive) { if (v > out.maxDive) out.maxDive = v; }
        else if (v > out.maxSpeed && d < 1) out.maxSpeed = v;
        if (d > 0.3) out.playerJumps.push({ t: +rt.S.t.toFixed(2), event: current, id: p.id, d: +d.toFixed(2) });
        if (process.env.NV_DEBUG && v > 9.5) (out.fast ||= []).push({ t: +rt.S.t.toFixed(2), event: current, id: p.id, role: p.role, v: +v.toFixed(1), warp: !!p.warp, motion: p.motion?.name, dive: !!p.dive, act: p.act?.name, busy: p.busy, want: p.want });
      }
      placed.clear();
    }
    if (process.env.NV_TRACE && step % 15 === 0) { const [t0, id] = process.env.NV_TRACE.split(':'); const q = players.find(x => String(x.id) === id); if (q && rt.S.t > +t0 - 5 && rt.S.t < +t0 + 0.2) console.log('trace', rt.S.t.toFixed(2), current, 'pos', q.pos.toArray().map(v => v.toFixed(2)).join(','), 'tgt', q.target.toArray().map(v => v.toFixed(2)).join(','), 'want', q.want.toFixed(1), 'vel', q.vel.length().toFixed(2), 'busy', q.busy, 'ball', ball.p.toArray().map(v => v.toFixed(2)).join(','), 'bv', ball.v.length().toFixed(2), 'owner', ball.owner?.id, 'act', q.act?.name, 'warp', !!q.warp); }
    const db = ball.p.distanceTo(prevBall);
    if (db > 0.6 && !PLACEMENT.has(current) && !director.current?.penalty) out.ballJumps.push({ t: +rt.S.t.toFixed(2), event: current, d: +db.toFixed(2), ...(process.env.NV_DEBUG ? { from: prevBall.toArray().map(v => +v.toFixed(2)), to: ball.p.toArray().map(v => +v.toFixed(2)), v: ball.v.toArray().map(v => +v.toFixed(1)), held: !!ball.held, allowOut: ball.allowOut, owner: ball.owner?.id } : {}) });
    if (ball.out && !ball.allowOut) { out.outWithoutLeave++; if (process.env.NV_DEBUG && out.outWithoutLeave < 4) console.log('out', rt.S.t.toFixed(2), current, director.current?.eventId, ball.p.toArray().map(v => v.toFixed(2)).join(','), 'v', ball.v.toArray().map(v => v.toFixed(1)).join(','), 'owner', ball.owner?.id, 'held', !!ball.held); }
  }
  return { ...out, director, shown, stats: director.stats };
}

const matches = new Map();
async function match(fixture) {
  if (!matches.has(fixture)) { const rec = recordMatch(fixture); matches.set(fixture, { rec, view: await playMatch(rec) }); }
  return matches.get(fixture);
}

for (const fixture of (process.env.NV_FIXTURES || "3,7").split(",").map(Number)) {
  test(`fixture ${fixture}: every engine event is played in order, without stalls, and the score shown is the engine's`, async () => {
    const { rec, view } = await match(fixture);
    assert.equal(view.director.index, rec.events.length, 'all events reached');
    assert.equal(view.director.busy, false, 'nothing left playing');
    if (process.env.NV_DEBUG) console.log('stall', JSON.stringify(view.stats.stallDetail || []));
    assert.equal(view.stats.stalls, 0, 'no event had to be skipped: ' + view.stats.stallLog.join(','));
    assert.deepEqual(JSON.parse(JSON.stringify(view.shown.score)), JSON.parse(JSON.stringify(rec.score)));
  });

  test(`fixture ${fixture}: no teleports — players move at football speeds (a keeper's dive a little faster), the ball only jumps for a placed restart`, async () => {
    const { view } = await match(fixture);
    if (process.env.NV_DEBUG) { const by = {}; for (const f of view.fast || []) { const k = [f.event, f.warp && 'warp', f.motion, f.dive && 'dive', f.act].filter(Boolean).join('/'); by[k] = (by[k] || 0) + 1; } console.log('fast', JSON.stringify(by)); const seen = {}; for (const f of view.fast || []) { const k = [f.event, f.warp && 'warp', f.motion, f.dive && 'dive', f.act].filter(Boolean).join('/'); if ((seen[k] = (seen[k] || 0) + 1) <= 2) console.log('ex', k, JSON.stringify(f)); } }
    assert.ok(view.maxSpeed < 10.5, 'top speed ' + view.maxSpeed.toFixed(2) + ' m/s');
    assert.ok(view.maxDive < 13, 'keeper dive peak ' + view.maxDive.toFixed(2) + ' m/s');   // explosive, but a body
    assert.deepEqual(view.playerJumps, [], 'player position jumps');
    assert.deepEqual(view.ballJumps, [], 'ball position jumps');
  });

  test(`fixture ${fixture}: the ball stays in play unless the engine puts it out`, async () => {
    const { view } = await match(fixture);
    assert.equal(view.outWithoutLeave, 0);
  });

  test(`fixture ${fixture}: possession changes at a real touch — no ball snapped to a player`, async () => {
    const { view } = await match(fixture);
    if (process.env.NV_DEBUG) console.log('fixes', JSON.stringify(view.stats.fixDetail || []));
    assert.equal(view.stats.fixes, 0, 'snaps: ' + view.stats.fixLog.join(', '));
  });

  test(`fixture ${fixture}: the ball is played by what touches it — sliding leg, forehead, keeper's gloves`, async () => {
    const { view } = await match(fixture);
    const c = view.stats.contacts;
    if (process.env.NV_DEBUG) console.log('jump', JSON.stringify((view.stats.jumpLog || []).filter(x => Math.abs(x.t - (+process.env.NV_CT || 0)) < 4)));
    if (process.env.NV_DEBUG) console.log('cross', JSON.stringify((view.stats.crossLog || []).filter(x => Math.abs(x.t - (+process.env.NV_CT || 0)) < 4)));
    if (process.env.NV_DEBUG) console.log('saves', JSON.stringify((view.stats.saveLog || []).filter(x => Math.hypot(x.hands[0] - x.ball[0], x.hands[1] - x.ball[1], x.hands[2] - x.ball[2]) > 0.45)));
    if (process.env.NV_DEBUG) console.log('clog', JSON.stringify((view.stats.contactLog || []).filter(x => !x.c || Math.hypot(x.c[0] - x.ball[0], x.c[1] - x.ball[1], x.c[2] - x.ball[2]) > 0.45)));
    // a slide or header that does not reach the ball does not play it (rare: it looks like a near miss)
    assert.ok((view.stats.misses || 0) <= 2, 'near misses ' + view.stats.misses);
    // distance from the ball to what plays it: the outstretched leg (slide), forehead, gloves
    for (const [kind, list] of Object.entries(c)) for (const d of list) assert.ok(d >= 0 && d < 0.45, `${kind} contact ${d} m`);
  });
}
