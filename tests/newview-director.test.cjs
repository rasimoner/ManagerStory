// The new 3D match view, without a browser: the real engine plays complete matches, the view's
// director and pitch runtime play every engine event on the simulated pitch, and the rules the
// old renderer's tests protected are checked on the new view.
//
//   every engine event is played, in order, without stalls; the score shown is the engine's
//   no teleports: players move within football speeds, the ball only jumps for a placed restart
//   the ball stays in play unless the engine puts it out
//   ownership changes at a real touch (no ball snapped to a player)
//   recorded motions meet the ball: sliding boot, forehead
//   the broadcast camera follows smoothly (watched as on a phone: upright, 60 fps, match at 2x)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, playToEnd } = require('./engine-harness.cjs');

const dist = process.env.NV_DIST || path.join(__dirname, '..', 'dist');

// ---- engine side: what the view reads, recorded once a minute exactly as match3d-newview.js does ----
const READ = `({
  pl:[...M.active.map(id=>[id,'user']),...M.oppIds.map(id=>[id,'opp'])].filter(([id,s])=>!(s==='user'&&M.sentOff?.includes(id))).map(([id,s])=>[id,s,eventPoint(id,s)]),
  ball:[...(M.ballState?.position||[50,50])],
  roster:[...M.active.map((id,i)=>{const p=S.players.find(x=>x.id===id);return {id,side:'user',name:p?.name??String(id),role:M.matchRoles[id],no:p?.number??(S.players.indexOf(p)+1||i+1),moves:skillMoves(id,'user').moves,stars:skillMoves(id,'user').stars}}),
          ...M.oppIds.map((id,i)=>{const p=playerAtMarker(id,'opp');return {id,side:'opp',name:p?.name??id,role:p?.position??(i?'CM':'GK'),no:i+1,moves:skillMoves(id,'opp').moves,stars:skillMoves(id,'opp').stars}})],
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
  const { createBroadcastCamera } = await import(path.join(dist, 'newview/camera.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(dist, 'assets/models/footballer-rig.json'), 'utf8')));
  const gait = {}; for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
  const rt = createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, numberTexture: null, stride: 0.75 });

  // teleports the view is allowed: a kickoff/restart layout, i.e. rt.place
  const placed = new Set(), place = rt.place;
  rt.place = (p, ...a) => { placed.add(p); return place(p, ...a); };

  const shown = { score: [0, 0] };
  // the page's broadcast camera, watched on a phone held upright at 60 frames a second, match at 2x
  const camera = new THREE.PerspectiveCamera(40, 390 / 760, 0.1, 400), broadcast = createBroadcastCamera(camera);
  let shotPlan = { mode: 'tv', a: null, b: null }, cutNow = false;     // a hard cut is a new picture, not a jump
  const screen = [], camMoves = [], ndc = new THREE.Vector3();
  const meta = { user: rec.roster.filter(r => r.side === 'user'), opp: rec.roster.filter(r => r.side === 'opp'), teams: rec.teams, userHome: rec.userHome };
  const director = createDirector(rt, { events: rec.events, snaps: rec.snaps, meta }, {
    say() {}, banner() {}, flash() {}, excite() {}, minute() {}, slow() {}, whistle() {}, finished() {},
    cam: (mode, a = null, b = null, hard = false) => { shotPlan = { mode, a, b }; if (hard) { broadcast.cut(); cutNow = true; } },
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
    if (step % 4 === 3) {      // one phone frame = 1/60 s real = 2/60 s of match
      const before = broadcast.pos.clone();
      broadcast.update(rt, shotPlan, 1 / 60, 390 / 760); camera.updateMatrixWorld(); if (broadcast.cutFrame) cutNow = true;
      ndc.copy(ball.p).project(camera); screen.push([ndc.x, ndc.y, ndc.z < 1 && !cutNow]); camMoves.push(cutNow ? 0 : before.distanceTo(broadcast.pos)); if (process.env.NV_DEBUG) (out.camAt ||= []).push([+rt.S.t.toFixed(2), director.current?.type, shotPlan?.mode]); cutNow = false;
    }
    const current = director.current?.type;
    // how long each engine event takes to play on the pitch (the match clock waits for it)
    const cid = director.current?.eventId ?? null;
    if (cid !== out.paceId) { if (out.paceId != null) (out.pace ||= []).push({ id: out.paceId, type: out.paceType, d: rt.S.t - out.paceT0 }); out.paceId = cid; out.paceType = current; out.paceT0 = rt.S.t; }
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
  // how much the ball jerks about on screen (second difference of its screen position per frame),
  // and frames where the camera jumps (moves far more than in the frames around it)
  const jitter = [], jumps = [];
  for (let i = 2; i < screen.length; i++) if (screen[i][2] && screen[i - 1][2] && screen[i - 2][2]) jitter.push(Math.hypot(screen[i][0] - 2 * screen[i - 1][0] + screen[i - 2][0], screen[i][1] - 2 * screen[i - 1][1] + screen[i - 2][1]));
  for (let i = 1; i < camMoves.length - 1; i++) if (camMoves[i] > 0.25 && camMoves[i] < 30 && camMoves[i] > 3 * Math.max(camMoves[i - 1], camMoves[i + 1])) { jumps.push(+camMoves[i].toFixed(2)); if (process.env.NV_DEBUG) console.log('camjump', camMoves[i].toFixed(2), JSON.stringify(out.camAt?.slice(i - 3, i + 2)), camMoves.slice(i - 3, i + 3).map(v => v.toFixed(2)).join(',')); }
  jitter.sort((a, b) => a - b);
  const camStats = { jitterP99: jitter[Math.floor(0.99 * (jitter.length - 1))], jumps: jumps.length, jumpSizes: jumps.slice(0, 10), offFrame: screen.filter(x => !x[2] || Math.abs(x[0]) > 1 || Math.abs(x[1]) > 1).length / screen.length };
  return { ...out, director, shown, stats: director.stats, cam: camStats };
}

const matches = new Map();
async function match(fixture) {
  if (!matches.has(fixture)) { const rec = recordMatch(fixture); matches.set(fixture, { rec, view: await playMatch(rec) }); }
  return matches.get(fixture);
}

for (const fixture of (process.env.NV_FIXTURES || "3,7").split(",").map(Number)) {
  test(`fixture ${fixture}: the camera follows smoothly — the ball never jerks about on screen, the view never jumps`, async () => {
    const { view } = await match(fixture);
    if (process.env.NV_DEBUG) console.log('camera', JSON.stringify(view.cam));
    // (V7.6 camera: 0.07–0.10, part of it the ball's own sudden kicks; the edge-of-frame correction
    // that made the picture stutter: 0.46–0.50)
    assert.ok(view.cam.jitterP99 < 0.15, 'ball screen jitter p99 ' + view.cam.jitterP99.toFixed(3));
    assert.equal(view.cam.jumps, 0, 'camera jumps');
  });
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

  test(`fixture ${fixture}: skill moves are readable and special — boots on and round the ball, only the players who have them, only where they fit`, async () => {
    const { view } = await match(fixture);
    const skills = view.stats.skills || [];
    if (process.env.NV_DEBUG) console.log('skills', JSON.stringify(skills));
    for (const k of skills) {
      if (k.kind === 'stepover') {
        assert.ok(k.minGap > 0.12, 'step-over boot stays off the ball: ' + JSON.stringify(k));
        assert.ok(k.peak > 0.12, 'step-over boot lifts over the ball: ' + JSON.stringify(k));
        assert.ok(k.plantSlip < 0.05, 'standing boot stays planted: ' + JSON.stringify(k));
        assert.ok(k.contact != null && k.contact < 0.3, 'the take is made with the boot on the ball: ' + JSON.stringify(k));
      } else if (k.kind === 'nutmeg') {
        assert.ok(k.contact != null && k.contact < 0.3, 'the stab is made with the boot on the ball: ' + JSON.stringify(k));
        assert.ok(k.between === true && k.gapL > 0.15 && k.gapR > 0.15, 'the ball goes between the feet: ' + JSON.stringify(k));
      } else if (k.kind === 'elastico') {
        assert.ok(k.touch1 < 0.3 && k.touch2 < 0.3, 'both touches are made with the boot on the ball: ' + JSON.stringify(k));
        assert.ok(k.out > 0.12, 'the ball visibly goes out before it comes back: ' + JSON.stringify(k));
        assert.ok(k.plantSlip < 0.06, 'standing boot stays planted: ' + JSON.stringify(k));
      } else if (k.kind === 'nolook') {
        assert.ok(k.contact < 0.35, 'the no-look pass is struck with the boot on the ball: ' + JSON.stringify(k));
      } else if (k.kind === 'cruyff') {
        assert.ok(k.fake > 0.18, 'the shot is shaped, boot lifted back: ' + JSON.stringify(k));
        assert.ok(k.swingGap > 0.1, 'the boot comes through beside the ball without striking it: ' + JSON.stringify(k));
        assert.ok(k.contact < 0.3 && k.behind === true, 'the inside of the boot takes it back behind the standing leg: ' + JSON.stringify(k));
        assert.ok(k.plantSlip < 0.06, 'standing boot stays planted: ' + JSON.stringify(k));
      } else if (k.kind === 'croqueta') {
        assert.ok(k.touch1 < 0.3 && k.touch2 < 0.3, 'one touch with each boot: ' + JSON.stringify(k));
        assert.ok(k.shift > 0.2, 'the ball moves across from one boot to the other: ' + JSON.stringify(k));
      } else if (k.kind === 'roulette') {
        assert.ok(k.spin > 5.5, 'a full turn: ' + JSON.stringify(k));
        assert.ok(k.soleA < 0.3 && k.soleB < 0.3, 'one sole and then the other on the ball: ' + JSON.stringify(k));
        assert.ok(k.wander < 0.9 && k.contact < 0.35, 'the ball stays at his feet through the turn: ' + JSON.stringify(k));
      } else if (k.kind === 'flairnutmeg') {
        assert.ok(k.turn > 2.8, 'he turns his back first: ' + JSON.stringify(k));
        assert.ok(k.heel < 0.3, 'the heel plays it: ' + JSON.stringify(k));
        assert.ok(k.between === true && k.gapL > 0.15 && k.gapR > 0.15, 'the ball goes between the feet: ' + JSON.stringify(k));
      } else if (k.kind === 'flairpass') {
        assert.ok(k.minGap > 0.12 && k.peak > 0.12 && k.contact != null && k.contact < 0.3, 'a real step-over, then the pass with the boot on the ball: ' + JSON.stringify(k));
      } else if (k.kind === 'rainbow') {
        assert.ok(k.roll < 0.3 && k.heel < 0.3, 'rolled back under the sole, flicked by the heel: ' + JSON.stringify(k));
        assert.ok(k.apex > 1.9 && (k.overDef == null || k.overDef > 1.7), 'up over his head and the defender\'s: ' + JSON.stringify(k));
      } else if (k.kind === 'sombrero') {
        assert.ok(k.toe < 0.3, 'scooped with the toe: ' + JSON.stringify(k));
        assert.ok(k.apex > 1.8 && (k.overDef == null || k.overDef > 1.7), 'over the defender\'s head: ' + JSON.stringify(k));
      } else if (k.kind === 'juggle') {
        assert.ok(k.touch1 < 0.3 && k.touch2 < 0.3 && k.low > 0.2, 'two touches, the ball kept off the grass between them: ' + JSON.stringify(k));
        assert.ok(k.overDef == null || k.overDef > 0.5, 'over the lunging leg: ' + JSON.stringify(k));
      } else if (k.kind === 'chest') {
        assert.ok(k.contact < 0.38 && k.h > 0.9, 'the ball is taken on the chest: ' + JSON.stringify(k));
      }
      // a special move belongs to the player (his repertoire) and to the right part of the pitch
      if (k.kind !== 'chest') {
        assert.ok(k.moves.includes(k.kind), 'only a player who has the move does it: ' + JSON.stringify(k));
        assert.ok(k.fromOwn >= 35, 'no special move in his own third: ' + JSON.stringify(k));
        if (['rainbow', 'sombrero', 'juggle'].includes(k.kind)) assert.ok(!k.losing, 'no showboating when losing: ' + JSON.stringify(k));
        if (['elastico', 'nolook', 'flairnutmeg', 'flairpass', 'rainbow', 'sombrero', 'juggle'].includes(k.kind)) assert.ok(k.fromOwn > 52.5, k.kind + ' only in the opponents\' half: ' + JSON.stringify(k));
        if (k.kind === 'elastico') assert.ok(Math.abs(k.z) < 31, 'no elastico against the touchline: ' + JSON.stringify(k));
      }
    }
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

// pacing report (NV_PACE=1): how long the pitch takes per engine event — the match clock waits for it
if (process.env.NV_PACE) test('pace report', async () => {
  for (const fixture of (process.env.NV_FIXTURES || '3,7').split(',').map(Number)) {
    const { view } = await match(fixture);
    const d = (view.pace || []).map(x => x.d).sort((a, b) => a - b), q = f => d[Math.floor(f * (d.length - 1))];
    const by = {}; for (const x of view.pace || []) { const b = (by[x.type] ||= { n: 0, t: 0, max: 0 }); b.n++; b.t += x.d; b.max = Math.max(b.max, x.d); }
    const top = Object.entries(by).sort((a, b) => b[1].t - a[1].t).slice(0, 8).map(([k, v]) => `${k}:${v.n}x avg ${(v.t / v.n).toFixed(1)} max ${v.max.toFixed(1)}`).join(' | ');
    console.log(`PACE f${fixture} total ${(view.simSeconds / 60).toFixed(1)} min, events ${d.length}, median ${q(.5).toFixed(2)} p90 ${q(.9).toFixed(2)} p99 ${q(.99).toFixed(2)} max ${d.at(-1).toFixed(1)}, >6s ${d.filter(x => x > 6).length}\n  ${top}`);
  }
});
if (process.env.NV_PACE) test('pass breakdown', async () => {
  for (const fixture of (process.env.NV_FIXTURES || '3,7').split(',').map(Number)) {
    const { view } = await match(fixture); const P = (view.stats.passT || []).filter(x => x[0] >= 0);
    const avg = i => (P.reduce((a, x) => a + x[i], 0) / P.length).toFixed(2), mx = i => Math.max(...P.map(x => x[i])).toFixed(1);
    console.log(`PASS f${fixture} n ${P.length} toNear ${avg(0)} (max ${mx(0)}) control ${avg(1)} (max ${mx(1)}) dist ${avg(2)}`);
    const slow = P.filter(x => x[1] > 1.5).length; console.log('  control>1.5s', slow);
  }
});
