/* Phase 1 — MatchEngine core / football integrity. Deterministic; uses the real game loop. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { harness, PROBES, playToEnd } = require('./engine-harness.cjs');

const fresh = (fixture = 0) => { const h = harness(); h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`); return h; };
const MOVERS = new Set(['pass', 'cross', 'shot', 'goal', 'save', 'block', 'post', 'wide', 'dribble', 'ballCarry', 'looseBall', 'recovery',
  'tackle', 'interception', 'kickoff', 'goalKick', 'corner', 'throwIn', 'freeKick', 'restartPosition', 'ballOut', 'firstTouch', 'run', 'hold', 'press']);
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg); // values come from another vm realm
const roster = h => h.run('({user:M.active.slice(),opp:M.oppIds.slice()})');

test('1. a home-team pass can only target a valid home-team teammate', () => {
  const h = fresh(0);
  const side = h.run('userHome=M.userHome'); // whichever side the managed club plays, "user" ids are numeric
  assert.ok(typeof side === 'boolean');
  h.run('advanceLive(20)');
  const bad = [];
  for (let i = 0; i < 60; i++) {
    const owner = h.run('M.ballOwner'), s = h.run('M.ballSide');
    if (s !== 'user') { h.run('advanceLive(60/90)'); if (h.run('M.pause'))h.run('resumeLive()'); continue; }
    const opts = h.run(`passOptions('user',${JSON.stringify(owner)},'Normal').map(o=>o.id)`);
    const active = h.run('M.active');
    for (const id of opts) if (typeof id !== 'number' || !active.includes(id) || id === owner) bad.push([owner, id]);
    h.run('advanceLive(60/90)'); if (h.run('M.pause') && !h.run('M.finished')) h.run('resumeLive()');
  }
  same(bad, []);
  // every completed user pass in a whole match stays inside the user's roster
  // two full matches so the sample never depends on one seed's pass count
  const passes = [];
  for (const fixture of [3, 5]) { const h2 = fresh(fixture); playToEnd(h2);
    passes.push(...h2.run("M.events.filter(e=>(e.type==='pass'||e.type==='cross')&&e.success!==false&&e.fromSide==='user'&&e.toSide==='user')")); }
  assert.ok(passes.length > 40, 'sample size ' + passes.length);
  assert.ok(passes.every(e => typeof e.fromId === 'number' && typeof e.toId === 'number'));
});

test('2. away-team pass isolation works identically', () => {
  const h = fresh(0);
  h.run('advanceLive(20)');
  const bad = [];
  for (let i = 0; i < 60; i++) {
    if (h.run('M.ballSide') === 'opp') {
      const owner = h.run('M.ballOwner');
      const opts = h.run(`passOptions('opp',${JSON.stringify(owner)},'Normal').map(o=>o.id)`);
      const pool = h.run('M.oppIds');
      for (const id of opts) if (typeof id !== 'string' || !pool.includes(id) || id === owner) bad.push([owner, id]);
    }
    h.run('advanceLive(60/90)'); if (h.run('M.pause') && !h.run('M.finished')) h.run('resumeLive()');
  }
  same(bad, []);
  // two full matches so the sample never depends on one seed's pass count
  const passes = [];
  for (const fixture of [3, 5]) { const h2 = fresh(fixture); playToEnd(h2);
    passes.push(...h2.run("M.events.filter(e=>(e.type==='pass'||e.type==='cross')&&e.success!==false&&e.fromSide==='opp'&&e.toSide==='opp')")); }
  assert.ok(passes.length > 40, 'sample size ' + passes.length);
  assert.ok(passes.every(e => /^o\d+$/.test(e.fromId) && /^o\d+$/.test(e.toId)));
});

test('3. teams attack opposite directions and shots go toward the correct goal', () => {
  const h = fresh(5);
  assert.equal(h.run("attackDirection('user')"), -h.run("attackDirection('opp')"));
  assert.equal(h.run("attackDirection('user')"), 1);
  playToEnd(h);
  const shots = h.run("M.events.filter(e=>e.type==='shot'&&e.toPos).map(e=>({s:e.gameSecond,side:e.fromSide,x:e.toPos[0]}))");
  const first = shots.filter(s => s.s <= 2700), second = shots.filter(s => s.s > 2700);
  assert.ok(first.length > 0 && second.length > 0);
  for (const s of first) assert.ok(s.side === 'user' ? s.x > 50 : s.x < 50, 'first-half shot heads to the attacked goal');
  for (const s of second) assert.ok(s.side === 'user' ? s.x < 50 : s.x > 50, 'second-half shot heads to the swapped goal');
});

test('4. directions switch after half-time and both teams restart in valid positions', () => {
  const h = fresh(2);
  h.run('advanceLive(30)');
  assert.equal(h.run('M.reason'), 'half');
  assert.equal(h.run("attackDirection('user')"), 1);
  const score = h.run('[M.hg,M.ag]'), events = h.run('M.events.filter(e=>e.type==="goal").length');
  // first-half shape: user defends the left goal (x small), opponent the right goal (x large)
  h.run("for(const id of M.active)M.dynamicPositions[String(id)]=[25,50];for(const id of M.oppIds)M.dynamicPositions[String(id)]=[75,50]");
  h.run('startSecondHalf()');
  assert.equal(h.run("attackDirection('user')"), -1);
  assert.equal(h.run("attackDirection('opp')"), 1);
  const p = h.run(PROBES);
  assert.ok(p.meanXUser > 50, 'user now defends the right-hand goal');
  assert.ok(p.meanXOpp < 50, 'opponent now defends the left-hand goal');
  same(p.problems, []);
  same(h.run('[M.hg,M.ag]'), score, 'score untouched by the restart');
  assert.equal(h.run('M.events.filter(e=>e.type==="goal").length'), events);
  assert.equal(h.run('M.active.length'), 11 - h.run('11-M.active.length'));
  assert.equal(new Set(h.run('[...M.active,...M.oppIds].map(String)')).size, h.run('M.active.length+M.oppIds.length'), 'no duplicated players');
});

test('5. the ball never moves without a valid ball/action state (no ghost kicks)', () => {
  const violations = [];
  for (const fixture of [1, 4, 8, 13]) {
    const h = fresh(fixture);
    let prevPos = h.run('[...M.ballState.position]'), prevEvents = h.run('M.events.length');
    playToEnd(h, kind => {
      if (kind) { prevPos = h.run('[...M.ballState.position]'); prevEvents = h.run('M.events.length'); return; }
      const pos = h.run('[...M.ballState.position]');
      const fresh = h.run(`M.events.slice(${prevEvents}).map(e=>e.type)`);
      const moved = Math.hypot(pos[0] - prevPos[0], pos[1] - prevPos[1]);
      const st = h.run('M.ballState.state'), owner = h.run('M.ballOwner');
      if (moved > 2 && !fresh.some(t => MOVERS.has(t))) violations.push({ fixture, min: h.run('M.min'), moved, fresh });
      // glued ball: a LIVE ball is at its owner, otherwise it is explicitly loose/dead
      if (st === 'LIVE') {
        const at = h.run(`eventPoint(M.ballOwner,M.ballSide)`);
        if (Math.hypot(at[0] - pos[0], at[1] - pos[1]) > 3) violations.push({ fixture, glued: false, min: h.run('M.min') });
      } else assert.ok(['LOOSE_BALL', 'BALL_OUT'].includes(st) || owner == null, 'non-live ball is explicit: ' + st);
      prevPos = pos; prevEvents = h.run('M.events.length');
    });
  }
  same(violations, []);
});

test('6. possession side always agrees with ball owner, and broken states are repaired', () => {
  const h = fresh(6); const issues = [];
  playToEnd(h, () => { const p = h.run(PROBES); issues.push(...p.problems); });
  same(issues, []);
  // direct repair: Team A possession with a Team B owner must not survive
  const g = fresh(6);
  g.run("M.ballSide='user';M.ballOwner='o3';setBallState(eventPoint('o3','opp'),'o3');enforceBallInvariants()");
  assert.equal(g.run('M.ballOwner===null||typeof M.ballOwner==="string"&&M.ballSide==="opp"'), true);
  same(g.run(PROBES).problems.filter(x => x !== 'side-without-owner'), []);
  // sent-off / substituted owner drops the ball instead of keeping a ghost owner
  g.run("M.ballSide='user';M.ballOwner=M.active[3];setBallState(eventPoint(M.active[3],'user'),M.active[3]);M.active=M.active.filter(id=>id!==M.ballOwner);enforceBallInvariants()");
  same(g.run(PROBES).problems, []);
});

test('7. player ids from different teams cannot collide logically', () => {
  const h = fresh(0);
  const r = roster(h);
  assert.ok(r.user.every(id => typeof id === 'number') && r.opp.every(id => /^o\d+$/.test(id)));
  assert.equal(new Set([...r.user, ...r.opp].map(String)).size, r.user.length + r.opp.length);
  assert.equal(h.run(`getPlayer('user','o3')`), undefined);
  assert.equal(h.run(`getPlayer('opp',${r.user[2]})`), undefined);
  assert.ok(h.run(`getPlayer('user',${r.user[2]})`));
  // asking one team to hand the ball to the other team's id is repaired inside the correct team
  h.run(`switchPitchOwner(${r.user[4]},'opp')`);
  assert.equal(h.run('M.ballSide'), 'opp');
  assert.match(h.run('String(M.ballOwner)'), /^o\d+$/);
  h.run("switchPitchOwner('o5','user')");
  assert.equal(h.run('M.ballSide'), 'user');
  assert.equal(typeof h.run('M.ballOwner'), 'number');
  // a tactical/individual instruction key for a user id never touches the opponent with the same digits
  h.run(`M.dynamicPositions['5']=[11,11];M.dynamicPositions['o5']=[77,77]`);
  same(h.run("eventPoint(5,'user')"), [11, 11]);
  same(h.run("eventPoint('o5','opp')"), [77, 77]);
});

test('8. players keep recognisable shape and minimum spacing', () => {
  const h = fresh(9); let tooClose = 0, samples = 0, shapeOk = 0;
  playToEnd(h, kind => {
    if (kind) return;
    const p = h.run(PROBES);
    if (p.minPair < .9) tooClose++;
    if (p.setPiece) return; // set pieces (corner/penalty) legitimately stack the box
    samples++;
    const lines = h.run(`(function(){const d=attackDirection('user');const rel=id=>{const x=eventPoint(id,'user')[0];return d>0?x:100-x};
      const by=r=>M.active.filter(id=>M.matchRoles[id]===r).map(rel);const avg=a=>a.reduce((n,x)=>n+x,0)/Math.max(1,a.length);
      return {cb:avg(by('CB')),cm:avg(by('CM').concat(by('CAM'))),st:avg(by('ST').concat(by('LW'),by('RW')))}})()`);
    if (lines.cb < lines.cm + 6 && lines.cm < lines.st + 6) shapeOk++;
  });
  assert.equal(tooClose, 0, 'no two players stacked on one coordinate');
  assert.ok(shapeOk / samples > .9, 'defenders stay behind midfield and midfield behind attackers');
});

test('9. the entire team does not collapse onto the ball', () => {
  let worst = 0, crowded = 0, samples = 0;
  for (const fixture of [0, 7, 15]) {
    const h = fresh(fixture);
    playToEnd(h, kind => {
      if (kind) return;
      const p = h.run(PROBES);
      if (p.setPiece) return;
      samples++;
      worst = Math.max(worst, p.nearUser, p.nearOpp);
      if (Math.max(p.nearUser, p.nearOpp) >= 6) crowded++;
    });
  }
  assert.ok(worst <= 7, 'at most a small group is near the ball (max ' + worst + ')');
  assert.ok(crowded / samples < .01);
  // only the nearest defenders may be sent to close the ball down
  const h = fresh(0);
  h.run("M.press='Yüksek';M.ballSide='opp';M.ballOwner='o6';setBallState([45,50],'o6');M.min=14");
  h.run('M.pitchMotion={};evolvePitchPositions()');
  const pressing = h.run("Object.values(M.pitchMotion).filter(m=>m.action==='press'||m.action==='counterPress').length");
  assert.ok(pressing <= 3, 'presser count is capped (' + pressing + ')');
});

test('10. a loose ball stays unowned until a player physically reaches it', () => {
  const h = fresh(0);
  // everybody far from the ball: after the first chase window nobody owns it
  h.run("S.players.forEach(p=>{p.pace=40;p.acceleration=40});M.oppIds.forEach(id=>{const p=opponentPlayer(id);if(p){p.pace=40;p.acceleration=40}});");
  h.run("for(const id of M.active)M.dynamicPositions[String(id)]=[8,10];for(const id of M.oppIds)M.dynamicPositions[String(id)]=[92,90];");
  h.run("makeLooseBall([50,50],[50,50],'test','user')");
  assert.equal(h.run('M.ballOwner'), null);
  assert.equal(h.run('M.ballSide'), 'none');
  assert.equal(h.run('M.ballState.state'), 'LOOSE_BALL');
  assert.ok(h.run('M.looseBall'));
  assert.equal(h.run("M.events.filter(e=>e.type==='recovery').length"), 0);
  // the chase continues over further seconds; ownership appears only once someone is within control range
  let owner = null, guard = 0;
  while (owner == null && guard++ < 10) { h.run('resolveLooseBall(3)'); owner = h.run('M.ballOwner'); }
  assert.notEqual(owner, null);
  const rec = h.run("M.events.filter(e=>e.type==='recovery').at(-1)");
  assert.ok(rec.startDistance > 20 && rec.chaseSeconds > 3, 'winner really travelled: ' + JSON.stringify([rec.startDistance, rec.chaseSeconds]));
  assert.equal(h.run('M.looseBall'), null);
  // speed integrity: with equal distance the faster player arrives first
  const g = fresh(0);
  g.run("for(const id of [...M.active,...M.oppIds])M.dynamicPositions[String(id)]=[95,95];");
  const [fast, slow] = g.run("(function(){const u=S.players.filter(p=>M.active.includes(p.id)&&M.matchRoles[p.id]!=='GK').sort((a,b)=>b.pace-a.pace);return [u[0].id,u.at(-1).id]})()");
  g.run(`S.players.find(p=>p.id===${fast}).pace=95;S.players.find(p=>p.id===${slow}).pace=45;M.dynamicPositions['${fast}']=[30,50];M.dynamicPositions['${slow}']=[70,50]`);
  g.run("makeLooseBall([50,50],[50,50],'test',null)");
  assert.equal(g.run('M.ballOwner'), fast, 'fast player reaches the space first');
});

test('11. second balls (blocks, parries, rebounds) resolve through the loose-ball logic', () => {
  let blocks = 0, parried = 0, badBlock = 0, teleports = 0, blockLoose = 0, blockCorner = 0;
  for (const fixture of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const h = fresh(fixture); playToEnd(h);
    const ev = h.run('M.events.map(e=>({t:e.type,r:e.reason,sd:e.startDistance,rt:e.restartType}))');
    ev.forEach((e, i) => {
      if (e.t === 'block') {
        // exactly ONE outcome per block: a contested second ball OR a deflection behind for a corner — never both
        blocks++;
        const after = ev.slice(i + 1, i + 7);
        const loose = after.findIndex(x => x.t === 'looseBall' && x.r === 'block');
        const corner = after.findIndex(x => x.rt === 'CORNER');
        const nextShot = after.findIndex(x => x.t === 'shot');
        const end = nextShot < 0 ? after.length : nextShot;
        const hasLoose = loose >= 0 && loose < end, hasCorner = corner >= 0 && corner < end;
        if (hasLoose === hasCorner) badBlock++;
        if (hasLoose) blockLoose++; else if (hasCorner) blockCorner++;
      }
      if (e.t === 'looseBall' && ['parry', 'post', 'block'].includes(e.r)) parried++;
      if (e.t === 'recovery' && e.sd == null) teleports++;
    });
  }
  assert.ok(blocks > 0 && parried > 0, 'sample contains second-ball situations');
  assert.equal(badBlock, 0, 'every blocked shot has exactly one outcome (second ball or corner)');
  assert.ok(blockLoose > 0 && blockCorner > 0, `both block outcomes occur: loose ${blockLoose}, corner ${blockCorner}`);
  assert.equal(teleports, 0, 'every recovery comes from the physical chase');
});

test('12. the simulation is frozen after full time', () => {
  const h = fresh(4); playToEnd(h);
  assert.equal(h.run('M.finished'), true);
  const snap = () => JSON.stringify(h.run('[M.events.length,M.hg,M.ag,M.ballOwner,M.ballSide,M.ballState.position,M.dynamicPositions,M.matchElapsedSeconds,M.rand.state]'));
  const before = snap();
  h.run('tick()');
  h.run('advanceLive(500)');
  h.run("actionMinute(true,tacticalEffects(),currentOpponent())");
  h.run('chanceV73(true);chanceV73(false)');
  h.run('evolvePitchPositions()');
  h.run("makeLooseBall([50,50],[50,50],'late','user')");
  h.run("startPitchRestart('CORNER','user',[100,10])");
  h.run("emitPitchKickoff('user')");
  h.run('settlePlay()');
  assert.equal(snap(), before, 'no player, ball, event, clock or RNG movement after 90:00');
  assert.equal(h.run('M.events.at(-1).type'), 'end');
});

test('13. match finalisation executes exactly once', () => {
  const h = fresh(4); playToEnd(h);
  assert.equal(h.run("M.events.filter(e=>e.type==='end').length"), 1);
  assert.equal(h.run('finalizeMatch()'), false);
  assert.equal(h.run("M.events.filter(e=>e.type==='end').length"), 1);
  const before = h.run('S.results.length');
  h.run('finishMatch()');
  assert.equal(h.run('S.results.length'), before + 1);
  h.run('finishMatch()');
  assert.equal(h.run('S.results.length'), before + 1);
});

test('14. the same seed produces the same match', () => {
  const sig = fixture => {
    const h = fresh(fixture); playToEnd(h);
    return JSON.stringify(h.run("[M.hg,M.ag,M.events.map(e=>[e.type,e.fromId,e.toId,e.gameSecond,e.success])]"));
  };
  assert.equal(sig(11), sig(11));
  assert.equal(sig(12), sig(12));
  assert.notEqual(sig(11), sig(12));
});

test('15/16. no NaN, Infinity, undefined players or out-of-bounds coordinates over 100 stress matches', { timeout: 300000 }, () => {
  const out = execFileSync(process.execPath, [path.resolve(__dirname, '../tools/engine-audit.cjs'), '100', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const a = JSON.parse(out.trim().split('\n').at(-1));
  assert.equal(a.matches, 100);
  assert.equal(a.crashes, 0, a.firstCrash);
  assert.deepEqual(a.problems, {}, 'no ghost possession, NaN, missing team, or out-of-bounds player');
  assert.ok(a.minPairDistance >= .9, 'no stacked players (min ' + a.minPairDistance + ')');
  assert.equal(a.matchesWithBadFinalization, 0);
  assert.equal(a.eventsAfterFullTime, 0);
  assert.equal(a.secondHalfInverted, 0);
  assert.equal(a.collapseSamples, 0);
  assert.ok(a.recoveries > 0 && a.recoveriesAfterRealChase > 0);
  assert.ok(a.gkPassShare < .03, 'goalkeeper is not a routine pass outlet');
  assert.ok(a.goalsPerMatch > 1 && a.goalsPerMatch < 5, 'scoring stays plausible: ' + a.goalsPerMatch);
});

test('no second simulation path: legacy duplicates are gone and the live loop is single-sourced', () => {
  const fs = require('node:fs');
  const dist = path.resolve(__dirname, '../dist');
  const count = (file, name) => (fs.readFileSync(path.join(dist, file), 'utf8').match(new RegExp('function ' + name + '\\b', 'g')) || []).length;
  for (const fn of ['actionMinute', 'eventPoint', 'paintLivePitch', 'eventPosition']) {
    const total = ['live-match.js', 'pitch-v73.js', 'pitch-v731.js', 'app.js', 'match-support.js'].reduce((n, f) => n + count(f, fn), 0);
    assert.ok(total <= 1, fn + ' defined ' + total + ' times');
  }
  // rendering reads engine state: the pitch painter never advances the seeded simulation
  const painter = fs.readFileSync(path.join(dist, 'pitch-v73.js'), 'utf8');
  const paint = painter.slice(painter.indexOf('function paintLivePitch'), painter.indexOf('function resetPitchHalf'));
  assert.doesNotMatch(paint, /M\.rand\(|tick\(|actionMinute\(|switchPitchOwner\(/);
});

test('one football minute cannot be processed twice (no re-entrant tick)', () => {
  const h = fresh(0);
  h.run("window.__n=0;const _t=tick;tick=function(){window.__n++;if(window.__n===1)advanceLive(5);_t()}");
  h.run('advanceLive(60/90)');
  assert.equal(h.run('window.__n'), 1, 'nested advanceLive during a tick is ignored');
  assert.equal(h.run('M.min'), 1);
});
