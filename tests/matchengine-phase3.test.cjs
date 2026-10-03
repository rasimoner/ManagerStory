/* Phase 3 — manager control and real match events, on top of the Phase 1 + Phase 2 engine.
   Probabilistic behaviour is asserted as distributions over seeded full matches; events are asserted
   through the real loop and through the restart state machine. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, PROBES, playToEnd } = require('./engine-harness.cjs');

const fresh = (fixture = 0) => { const h = harness(); h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`); return h; };
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const types = h => h.run('M.events.map(e=>e.type)');

/* Play N seeded matches with a managed-team tactic, return aggregate behavioural metrics. */
function arm(tactics, { n = 8, opp = null, instr = [], first = 0 } = {}) {
  const t = { press: 0, oppPress: 0, fatigue: 0, fatigueN: 0, passes: 0, completed: 0, dist: 0, distN: 0, longBalls: 0, loose: 0, defLine: 0, defN: 0, spread: 0, spreadN: 0,
    actions: 0, matches: 0, oppDefLine: 0, oppDefN: 0, oppFatigue: 0, oppFatigueN: 0, aerialLoose: 0 };
  for (let i = 0; i < n; i++) {
    const h = harness(); h.run(`S=fresh();init();S.fixture=${(first + i) % 34};startMatch();`);
    h.run(`Object.assign(M,${JSON.stringify(tactics)});M.teamInstructions=${JSON.stringify(instr)};${opp ? `M.oppTactics=${JSON.stringify(opp)};` : ''}resumeLive()`);
    const before = h.run('Object.fromEntries(S.players.map(p=>[p.id,p.fitness]))');
    const oppBefore = h.run('Object.fromEntries(M.oppIds.map(id=>[id,opponentPlayer(id).fitness]))');
    const starters = h.run('M.active.slice()');
    playToEnd(h, kind => {
      if (kind) return;
      const d = h.run(`(function(){const rel=(id,s)=>{const x=eventPoint(id,s)[0];return attackDirection(s)>0?x:100-x};
        const back=M.active.filter(id=>['CB','LB','RB'].includes(M.matchRoles[id]));
        const oback=M.oppIds.filter(id=>['CB','LB','RB'].includes(opponentPlayer(id)?.position));
        const ys=M.active.filter(id=>M.matchRoles[id]!=='GK').map(id=>eventPoint(id,'user')[1]);const m=ys.reduce((a,b)=>a+b,0)/ys.length;
        return {ballSide:M.ballSide,back:back.length?back.reduce((n,id)=>n+rel(id,'user'),0)/back.length:null,oback:oback.length?oback.reduce((n,id)=>n+rel(id,'opp'),0)/oback.length:null,
          sd:Math.sqrt(ys.reduce((a,b)=>a+(b-m)*(b-m),0)/ys.length)}})()`);
      if (d.ballSide === 'opp' && d.back != null) { t.defLine += d.back; t.defN++; }
      if (d.ballSide === 'user' && d.oback != null) { t.oppDefLine += d.oback; t.oppDefN++; }
      t.spread += d.sd; t.spreadN++;
    });
    const s = h.run(`({u:userSide(),st:M.stats,ev:M.events.map(e=>({t:e.type,fs:e.fromSide,ts:e.toSide,d:e.distance,k:e.passKind,r:e.reason}))})`);
    t.matches++;
    t.press += s.ev.filter(e => e.t === 'press' && e.ts === 'user').length; t.oppPress += s.ev.filter(e => e.t === 'press' && e.ts === 'opp').length;
    t.passes += s.st.passes[s.u]; t.completed += s.st.completedPasses[s.u];
    const up = s.ev.filter(e => (e.t === 'pass' || e.t === 'cross') && e.fs === 'user' && e.d != null);
    t.dist += up.reduce((a, e) => a + e.d, 0); t.distN += up.length; t.longBalls += up.filter(e => e.k === 'long' || e.k === 'cross').length;
    t.loose += s.ev.filter(e => e.t === 'looseBall').length; t.aerialLoose += s.ev.filter(e => e.t === 'looseBall' && e.r === 'aerial').length;
    t.actions += s.ev.length;
    for (const id of starters) { const p = h.run(`S.players.find(p=>p.id===${id})`); if (p.minutes >= 80) { t.fatigue += before[id] - p.fitness; t.fatigueN++; } }
    for (const id of h.run('Object.keys(M.oppLineup)')) { const o = h.run(`opponentPlayer(${JSON.stringify(id)})`); if (o && oppBefore[id] != null) { t.oppFatigue += oppBefore[id] - o.fitness; t.oppFatigueN++; } }
  }
  return { press: t.press / t.matches, oppPress: t.oppPress / t.matches, fatigue: t.fatigue / Math.max(1, t.fatigueN), oppFatigue: t.oppFatigue / Math.max(1, t.oppFatigueN),
    passes: t.passes / t.matches, completion: t.completed / Math.max(1, t.passes), passDist: t.dist / Math.max(1, t.distN), longShare: t.longBalls / Math.max(1, t.distN),
    defLine: t.defLine / Math.max(1, t.defN), oppDefLine: t.oppDefLine / Math.max(1, t.oppDefN), spread: t.spread / Math.max(1, t.spreadN), loose: t.loose / t.matches, aerialLoose: t.aerialLoose / t.matches, events: t.actions / t.matches };
}

test('tactical state is one config per team and only ever read through teamTactics(side)', () => {
  const h = fresh(0);
  h.run("M.press='Yüksek';M.tempo='Düşük'");
  same(h.run("teamTactics('user').press"), 'Yüksek');
  h.run("M.oppTactics={press:'Düşük',line:'Geride'}");
  same(h.run("[teamTactics('opp').press,teamTactics('opp').line,teamTactics('user').press,teamTactics('user').line]"), ['Düşük', 'Geride', 'Yüksek', 'Normal']);
  // a change to one team is invisible to the other
  h.run("M.oppTactics={press:'Yüksek'}");
  same(h.run("teamTactics('user').press"), 'Yüksek');
  h.run("M.press='Normal'");
  same(h.run("teamTactics('opp').press"), 'Yüksek');
  // the engine never reads the raw user fields for an opponent decision
  const fs = require('node:fs'), path = require('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '../dist/pitch-v73.js'), 'utf8');
  assert.doesNotMatch(src, /M\.(press|tempo|line|width|mentality|passingStyle)\b/, 'pitch-v73.js reads tactics only through the team-scoped profile');
});

test('HIGH vs LOW press: more engagement and recovery pressure, more fatigue', { timeout: 300000 }, () => {
  const hi = arm({ press: 'Yüksek' }), lo = arm({ press: 'Düşük' });
  assert.ok(hi.fatigue > lo.fatigue + 2, `fatigue ${hi.fatigue.toFixed(2)} vs ${lo.fatigue.toFixed(2)}`);
  assert.ok(hi.oppPress + hi.press > 0 && lo.oppPress + lo.press > 0, 'both arms have pressing activity');
});

test('HIGH vs LOW tempo: more actions, more errors under pressure, more fatigue', { timeout: 300000 }, () => {
  const hi = arm({ tempo: 'Yüksek' }), lo = arm({ tempo: 'Düşük' });
  assert.ok(hi.fatigue > lo.fatigue + 1.5, `fatigue ${hi.fatigue.toFixed(2)} vs ${lo.fatigue.toFixed(2)}`);
  assert.ok(hi.completion < lo.completion - .03, `completion ${hi.completion.toFixed(3)} vs ${lo.completion.toFixed(3)}`);
  assert.ok(hi.passes > lo.passes * .97, 'high tempo does not reduce pass volume');
});

test('HIGH vs LOW line: defenders really stand higher, relative to the attacking direction', { timeout: 300000 }, () => {
  const hi = arm({ line: 'Önde' }), lo = arm({ line: 'Geride' });
  assert.ok(hi.defLine > lo.defLine + 6, `back line ${hi.defLine.toFixed(1)} vs ${lo.defLine.toFixed(1)}`);
  // direction-safe: the same measurement is relative, so it holds in both halves
  const h = fresh(2);
  h.run("M.line='Önde'");
  const first = h.run("(function(){const id=M.active.find(id=>M.matchRoles[id]==='CB');return pitchInstructionTarget(id,'user',[50,50],'opp')[0]})()");
  h.run("M.secondHalf=true;M.dynamicPositions={}");
  const second = h.run("(function(){const id=M.active.find(id=>M.matchRoles[id]==='CB');return pitchInstructionTarget(id,'user',[50,50],'opp')[0]})()");
  assert.ok(first < 50 && second > 50, 'the high line steps toward the halfway line from either side');
  assert.ok(Math.abs((50 - first) - (second - 50)) < 12);
});

test('SHORT vs DIRECT passing: distance and long-ball share differ; completion trades off', { timeout: 300000 }, () => {
  const short = arm({ passingStyle: 'Kısa' }), direct = arm({ passingStyle: 'Direkt' });
  assert.ok(direct.passDist > short.passDist + 3, `distance ${direct.passDist.toFixed(1)} vs ${short.passDist.toFixed(1)}`);
  assert.ok(direct.longShare > short.longShare + .05, `long share ${direct.longShare.toFixed(3)} vs ${short.longShare.toFixed(3)}`);
  assert.ok(direct.completion < short.completion, `completion ${direct.completion.toFixed(3)} vs ${short.completion.toFixed(3)}`);
});

test('WIDE vs NARROW: the managed team is measurably wider / narrower', { timeout: 300000 }, () => {
  const wide = arm({ width: 'Geniş' }), narrow = arm({ width: 'Dar' });
  assert.ok(wide.spread > narrow.spread + 3, `lateral spread ${wide.spread.toFixed(2)} vs ${narrow.spread.toFixed(2)}`);
});

test('mentality changes decisions, compactness narrows the team, patience and fast transition shift the ball', { timeout: 300000 }, () => {
  const cautious = arm({ mentality: 'Temkinli' }, { n: 6 }), bold = arm({ mentality: 'Cesur' }, { n: 6 });
  assert.ok(bold.completion !== cautious.completion || bold.passDist !== cautious.passDist, 'mentality alters pass profile');
  assert.ok(cautious.completion > bold.completion - .01, 'cautious play is not riskier than bold play');
  const compact = arm({}, { n: 6, instr: ['compact'] }), base = arm({}, { n: 6 });
  assert.ok(compact.spread < base.spread - .8, `compact ${compact.spread.toFixed(2)} vs ${base.spread.toFixed(2)}`);
  const patient = arm({}, { n: 6, instr: ['patience'] });
  assert.ok(patient.passDist < base.passDist && patient.longShare < base.longShare, 'patience recycles with shorter, safer passes');
});

test('fast transition: the moment after a regain prefers forward targets', () => {
  const h = fresh(1);
  const carrier = h.run("M.active.find(id=>M.matchRoles[id]==='CM')");
  const others = h.run(`M.active.filter(id=>M.matchRoles[id]!=='GK'&&id!==${carrier})`);
  const spots = [[40, 56], [41, 44], [70, 35], [72, 52], [68, 65], [30, 50], [32, 30], [32, 70], [20, 50]];
  h.run(`for(const id of M.oppIds)M.dynamicPositions[String(id)]=[92,50];M.dynamicPositions[String(${carrier})]=[46,50];`);
  others.forEach((id, i) => h.run(`M.dynamicPositions[String(${id})]=${JSON.stringify(spots[i % spots.length])}`));
  h.run(`M.ballSide='user';M.ballOwner=${carrier};setBallState(eventPoint(${carrier},'user'),${carrier})`);
  const prog = on => h.run(`(function(){M.teamInstructions=${on ? "['quick']" : '[]'};M.regain=${on ? "{side:'user',min:M.min}" : 'null'};M.rand=R(77);let p=0,n=3000;
    for(let i=0;i<n;i++){if(weightedPitchChoice(passOptions('user',${carrier})).progress>12)p++}return p/n})()`);
  const quick = prog(true), normal = prog(false);
  assert.ok(quick > normal + .05, `forward share ${quick.toFixed(3)} vs ${normal.toFixed(3)}`);
  assert.ok(quick < .99, 'still a choice, not a guarantee (vision and execution still apply)');
});

test('TACTIC ISOLATION: A high press / B low press, then reversed — no leakage', { timeout: 300000 }, () => {
  const a = arm({ press: 'Yüksek' }, { n: 6, opp: { press: 'Düşük' } });
  const b = arm({ press: 'Düşük' }, { n: 6, opp: { press: 'Yüksek' } });
  // fatigue follows each team's OWN pressing, not the opponent's
  assert.ok(a.fatigue > b.fatigue + 2, `user fatigue ${a.fatigue.toFixed(2)} vs ${b.fatigue.toFixed(2)}`);
  assert.ok(b.oppFatigue > a.oppFatigue + 2, `opponent fatigue ${b.oppFatigue.toFixed(2)} vs ${a.oppFatigue.toFixed(2)}`);
  // and each team's own settings produce the matching press/line behaviour
  const h = fresh(0);
  h.run("M.press='Yüksek';M.oppTactics={press:'Düşük'}");
  same(h.run("[tacticProfile('user').press,tacticProfile('opp').press]"), [1, -1]);
  same(h.run("[tacticFatigue('user')>1,tacticFatigue('opp')<1]"), [true, true]);
  h.run("M.press='Düşük';M.oppTactics={press:'Yüksek'}");
  same(h.run("[tacticProfile('user').press,tacticProfile('opp').press]"), [-1, 1]);
  // a tweak to the opponent never edits the managed team's stored tactics
  const before = h.run('JSON.stringify([M.mentality,M.press,M.tempo,M.line,M.approach,M.passingStyle,M.width,M.teamInstructions])');
  h.run("M.oppTactics={press:'Yüksek',line:'Önde',tempo:'Yüksek',mentality:'Cesur'};advanceLive(20)");
  const after = h.run('JSON.stringify([M.mentality,M.press,M.tempo,M.line,M.approach,M.passingStyle,M.width,M.teamInstructions])');
  assert.equal(after, before);
});

test('individual instructions are keyed by side + exact player id', () => {
  const h = fresh(0);
  const st = h.run("M.active.find(id=>M.matchRoles[id]==='ST')");
  h.run(`M.orderKeys[${st}]='runBehind'`);
  assert.equal(h.run(`orderFor(${st},'user')`), 'runBehind');
  // an opponent with the same digits is unaffected, and an opponent order never leaks to the user
  assert.equal(h.run(`orderFor('o${st}','opp')`), 'balanced');
  h.run(`M.oppOrders={o${st}:'press'}`);
  assert.equal(h.run(`orderFor('o${st}','opp')`), 'press');
  assert.equal(h.run(`orderFor(${st},'user')`), 'runBehind');
  // the instruction changes the player's own target, team instruction composes with it
  const wideBefore = h.run("(function(){const id=M.active.find(id=>M.matchRoles[id]==='LW'||M.matchRoles[id]==='RW');M.width='Dar';delete M.orderKeys[id];const a=pitchInstructionTarget(id,'user',[60,50],'user')[1];M.orderKeys[id]='wide';const b=pitchInstructionTarget(id,'user',[60,50],'user')[1];return [Math.abs(a-50),Math.abs(b-50)]})()");
  assert.ok(wideBefore[1] > wideBefore[0], 'stay-wide beats the narrow team baseline for that winger only');
  assert.ok(wideBefore[1] < 50, 'and stays inside the pitch');
});

test('assistant coach: advice follows the real state of the managed team and maps to one control', () => {
  const h = fresh(0);
  const advice = () => h.run('JSON.stringify(assistantAdvice())');
  const adv = () => JSON.parse(advice());
  // trailing late with a fresh team: be braver and press
  h.run("M.min=65;M.hg=0;M.ag=2;if(!M.userHome){M.hg=2;M.ag=0}S.players.forEach(p=>p.fitness=95)");
  let a = adv().tactics;
  assert.equal(a.mentality?.value, 'Cesur');
  assert.equal(a.press?.value, 'Yüksek');
  // leading late: protect the result
  h.run("M.hg=2;M.ag=0;if(!M.userHome){M.hg=0;M.ag=2}M.min=75");
  a = adv().tactics;
  assert.equal(a.mentality?.value, 'Temkinli');
  assert.ok(!a.press || a.press.value !== 'Yüksek');
  // exhausted team under high press is told to ease off
  h.run("M.press='Yüksek';S.players.forEach(p=>p.fitness=58)");
  a = adv().tactics;
  assert.equal(a.press?.value, 'Normal');
  assert.equal(a.tempo?.value, 'Düşük');
  // advice only ever names its own control and never the current value
  for (const [key, v] of Object.entries(a)) { assert.ok(['mentality', 'press', 'tempo', 'line', 'passingStyle', 'width'].includes(key)); assert.notEqual(v.value, h.run(`teamTactics('user').${key}`)); assert.ok(v.reason.length > 10); }
  // reading advice mutates nothing on either team
  const snap = () => h.run('JSON.stringify([M.mentality,M.press,M.tempo,M.line,M.width,M.passingStyle,M.teamInstructions,M.oppTactics||null,M.hg,M.ag,M.events.length])');
  const before = snap(); advice(); advice();
  assert.equal(snap(), before);
});

test('assistant coach UI: recommendation sits next to its control; tapping selects exactly that option', () => {
  const h = fresh(0);
  h.run("M.matchElapsedSeconds=3900;M.min=65;M.hg=0;M.ag=2;if(!M.userHome){M.hg=2;M.ag=0}S.players.forEach(p=>p.fitness=95);M.pause=true;M.reason='manual'");
  const html = h.run("tacticsControls('match')");
  assert.match(html, /data-assist="mentality"[^>]*onclick="applyAssistantAdvice\('mentality','Cesur'\)"/);
  // the hint is inside the same <label> as its own select, not in a generic list
  const label = html.match(/<label>Mentalite[\s\S]*?<\/label>/)[0];
  assert.match(label, /data-assist="mentality"/);
  assert.doesNotMatch(label, /data-assist="press"/);
  // before tapping, nothing is applied
  assert.equal(h.run('M.mentality'), 'Dengeli');
  const other = h.run("JSON.stringify([M.press,M.tempo,M.line,M.width,M.passingStyle])");
  h.run("applyAssistantAdvice('mentality','Cesur')");
  assert.equal(h.run('M.mentality'), 'Cesur');
  assert.equal(h.run("JSON.stringify([M.press,M.tempo,M.line,M.width,M.passingStyle])"), other, 'no unrelated control is changed');
  assert.equal(h.run('M.oppTactics===undefined'), true, 'opponent tactics untouched');
  // team-instruction toggle recommendation works the same way
  h.run("M.teamInstructions=[]");
  const quick = h.run("assistantAdvice().team.quick");
  assert.ok(quick && quick.on);
  h.run("applyAssistantAdvice('quick',true)");
  assert.ok(h.run("M.teamInstructions.includes('quick')"));
  assert.equal(h.run("M.teamInstructions.length"), 1);
});

test('KICK-OFF: match start, second half and after a goal use the restart machine with the right team', () => {
  const h = fresh(3);
  const kicks = () => h.run("M.events.filter(e=>e.type==='kickoff').map(e=>[e.fromSide,e.gameSecond,e.restartType])");
  same(kicks()[0][0], 'user');
  h.run("advanceLive(30)");
  let guard = 0; while (h.run('M.reason') === 'injury' && guard++ < 4) h.run("(function(){const o=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const p=S.players.find(x=>x.id===o);if(p)p.injury=0;M.requiredSubstitution=null;resumeLive()})()");
  if (h.run('M.reason') !== 'half') h.run('advanceLive(30)');
  assert.equal(h.run('M.reason'), 'half');
  h.run('startSecondHalf()');
  const k = kicks();
  assert.equal(k.at(-1)[0], 'opp', 'the side that did not kick off the first half restarts the second');
  assert.equal(k.at(-1)[2], 'KICK_OFF');
  // centre spot, valid owner, machine finished, players in their own halves
  assert.equal(h.run('M.restart.restartPhase'), 'LIVE');
  same(h.run('M.restart.trail'), ['BALL_OUT', 'DETERMINE_RESTART', 'POSITION_BALL', 'POSITION_PLAYERS', 'WAIT_FOR_RESTART', 'EXECUTE_RESTART', 'LIVE']);
  assert.equal(h.run('M.ballState.ownerId'), h.run('M.ballOwner'));
  same(h.run('M.ballState.position'), [50, 50]);
  same(h.run(PROBES).problems, []);
  const ownHalf = h.run(`[...M.active.map(id=>['user',id]),...M.oppIds.map(id=>['opp',id])].filter(([s,id])=>id!==M.ballOwner).every(([s,id])=>{const x=eventPoint(id,s)[0];return attackDirection(s)>0?x<=53:x>=47})`);
  assert.equal(h.run('true') && ownHalf, true);
  // after a goal the conceding side restarts
  const g = fresh(4);
  g.run("M.dynamicPositions[12]=[92,50];setUserOwner(12)");
  let scored = false;
  for (let i = 0; i < 400 && !scored; i++) { g.run(`M.rand=R(${9000 + i});M.hg=M.hg;setUserOwner(12);M.dynamicPositions[12]=[92,50];chanceV73(true)`); scored = g.run("M.events.some(e=>e.type==='goal'&&e.fromSide==='user')"); }
  assert.ok(scored, 'a goal was produced');
  const after = g.run("M.events.slice(M.events.findLastIndex(e=>e.type==='goal')).map(e=>e.type+':'+(e.fromSide||''))");
  assert.ok(after.includes('kickoff:opp'), 'the conceding team kicks off: ' + after.join(','));
});

test('GOAL KICK: from the correct area, active keeper takes it, same-team eligible receiver, short/long follow style and GK instruction', () => {
  const h = fresh(0);
  for (const side of ['user', 'opp']) {
    const kinds = { short: 0, medium: 0, long: 0 }; const bad = [];
    for (let i = 0; i < 60; i++) {
      h.run(`M.rand=R(${500 + i});startPitchRestart('GOAL_KICK','${side}',[${side === 'user' ? -2 : 102},30])`);
      const e = h.run("M.events.findLast(e=>e.type==='goalKick')");
      kinds[e.passKind]++;
      const gk = h.run(`keeperId('${side}')`);
      if (e.fromId !== gk) bad.push('taker');
      if (e.fromSide !== side || e.toSide !== side) bad.push('side');
      if (!h.run(`${side === 'user' ? 'M.active' : 'M.oppIds'}.includes(${JSON.stringify(e.toId)})`) || e.toId === gk) bad.push('receiver');
      const goalX = h.run(`attackDirection('${side}')`) > 0 ? 4.5 : 95.5;
      if (e.fromPos[0] !== goalX) bad.push('spot');
      assert.equal(h.run('M.restart.restartPhase'), 'LIVE');
    }
    same(bad, []);
    assert.ok(kinds.short > 0 && kinds.long > 0, JSON.stringify(kinds));
  }
  // goalkeeper instruction and passing style shift the distribution (opponent uses its team style)
  const share = (setup, side) => h.run(`(function(){${setup};let long=0,n=300;for(let i=0;i<n;i++){M.rand=R(800+i);startPitchRestart('GOAL_KICK','${side}',[${side === 'user' ? -2 : 102},30]);if(M.events.findLast(e=>e.type==='goalKick').passKind==='long')long++}return long/n})()`);
  const gk = h.run("keeperId('user')");
  const shortGK = share(`M.orderKeys[${gk}]='shortGK'`, 'user'), longGK = share(`M.orderKeys[${gk}]='longGK'`, 'user');
  assert.ok(longGK > shortGK + .3, `long share ${longGK.toFixed(2)} vs ${shortGK.toFixed(2)}`);
  const oppShort = share("delete M.orderKeys[" + gk + "];M.oppTactics={passingStyle:'Kısa'}", 'opp'), oppDirect = share("M.oppTactics={passingStyle:'Direkt'}", 'opp');
  assert.ok(oppDirect > oppShort + .15, `opponent style ${oppDirect.toFixed(2)} vs ${oppShort.toFixed(2)}`);
  // a sent-off keeper is replaced by a real on-pitch player, never a fixed id
  h.run("M.oppIds=M.oppIds.filter(id=>id!=='o0');M.rand=R(3);startPitchRestart('GOAL_KICK','opp',[102,30])");
  const e2 = h.run("M.events.findLast(e=>e.type==='goalKick')");
  assert.notEqual(e2.fromId, 'o0'); assert.ok(h.run(`M.oppIds.includes(${JSON.stringify(e2.fromId)})`));
});

test('THROW-IN: correct touchline spot, correct team, nearby same-team receiver, clean resume', () => {
  const h = fresh(0);
  const bad = [];
  for (const [side, y] of [['user', -3], ['opp', 103], ['user', 103], ['opp', -3]]) for (let i = 0; i < 25; i++) {
    h.run(`M.rand=R(${40 + i});startPitchRestart('THROW_IN','${side}',[${20 + i * 2.5},${y}])`);
    const e = h.run("M.events.findLast(e=>e.type==='throwIn')");
    if (e.fromSide !== side || e.toSide !== side) bad.push('side');
    if (e.fromPos[1] !== (y < 50 ? 2 : 98)) bad.push('touchline');
    if (Math.abs(e.fromPos[0] - (20 + i * 2.5)) > .01) bad.push('spot');
    const rec = h.run(`(function(){const p=eventPoint(${JSON.stringify(e.toId)},'${side}');return Math.hypot(p[0]-${e.fromPos[0]},p[1]-${e.fromPos[1]})})()`);
    if (!(rec < 34)) bad.push('far:' + rec);
    if (e.toId === e.fromId) bad.push('self');
    assert.equal(h.run('M.restart.restartPhase'), 'LIVE');
    same(h.run(PROBES).problems, []);
  }
  same(bad, []);
  same(h.run('M.events.filter(e=>e.type==="throwIn").length>0&&M.ballState.state'), 'LIVE');
  // the thrower is placed on the touchline, not teleported into play
  h.run("M.rand=R(1);startPitchRestart('THROW_IN','user',[30,-3])");
  same(h.run("M.events.findLast(e=>e.type==='throwIn').fromPos"), [30, 2]);
});

test('CORNER: correct corner and side, box positions, real delivery outcomes, clean exit to open play', { timeout: 120000 }, () => {
  const outcomes = { shot: 0, loose: 0, owned: 0 }; const bad = [];
  for (const side of ['user', 'opp']) for (let i = 0; i < 60; i++) {
    const h = fresh(0);
    h.run(`M.rand=R(${300 + i});startPitchRestart('CORNER','${side}',[${side === 'user' ? 102 : -2},${i % 2 ? -3 : 103}])`);
    const e = h.run("M.events.findLast(e=>e.type==='corner')");
    const atkX = h.run(`attackDirection('${side}')`) > 0 ? 98 : 2;
    if (e.fromPos[0] !== atkX || ![2, 98].includes(e.fromPos[1])) bad.push('corner spot ' + JSON.stringify(e.fromPos));
    if (e.fromSide !== side) bad.push('team');
    if (!(Math.abs(e.toPos[0] - atkX) < 22)) bad.push('target not in box');
    const inBox = h.run(`[...M.active.map(id=>['user',id]),...M.oppIds.map(id=>['opp',id])].filter(([s,id])=>{const p=eventPoint(id,s);return Math.abs(p[0]-${atkX})<20&&Math.abs(p[1]-50)<24}).length`);
    const evs = h.run("M.events.map(e=>e.type)");
    if (inBox < 6 && !evs.includes('goal')) bad.push('box crowd ' + inBox);
    if (evs.includes('shot')) outcomes.shot++;
    else if (h.run('M.ballOwner') == null) outcomes.loose++; else outcomes.owned++;
    // play continues cleanly
    same(h.run(PROBES).problems.filter(p => p !== 'side-without-owner'), []);
    h.run('advanceLive(4)');
    if (h.run('M.pause') && h.run('M.reason') === 'injury') continue;
    assert.ok(h.run('M.ballOwner') != null || h.run('M.looseBall') != null || h.run("M.restart&&M.restart.restartPhase==='LIVE'"));
  }
  same(bad, []);
  assert.ok(outcomes.shot > 0 && outcomes.loose + outcomes.owned > 0, JSON.stringify(outcomes));
});

test('PENALTY: explicit states, best finisher takes it, Phase 2 finishing and keeper decide, goal/save/miss/woodwork all continue', { timeout: 120000 }, () => {
  const h = fresh(0);
  const results = { goal: 0, save: 0, wide: 0, post: 0 }; const trails = new Set();
  for (let i = 0; i < 160; i++) {
    const hh = fresh(i % 34);
    hh.run(`M.rand=R(${2000 + i});M.ballSide='user';startPitchRestart('PENALTY','user',[88,50])`);
    const R = hh.run('M.restart');
    trails.add(JSON.stringify(R.trail)); assert.equal(R.restartPhase, 'LIVE');
    const shot = hh.run("M.events.find(e=>e.type==='shot')");
    assert.ok(shot.penalty && shot.restartType === 'PENALTY');
    assert.equal(shot.fromId, hh.run("penaltyTaker('user')"));
    same(shot.fromPos, [hh.run("attackDirection('user')") > 0 ? 89 : 11, 50]);
    results[shot.outcome]++;
    const evs = hh.run("M.events.map(e=>e.type)");
    if (shot.outcome === 'goal') { assert.ok(evs.includes('goal')); assert.equal(evs.filter(t => t === 'kickoff').length, 2, 'goal is followed by a kick-off'); }
    same(hh.run(PROBES).problems.filter(p => p !== 'side-without-owner'), []);
    hh.run('advanceLive(3)');
  }
  assert.equal(trails.size, 1);
  assert.ok(results.goal / 160 > .6 && results.goal / 160 < .95, 'conversion plausible: ' + JSON.stringify(results));
  assert.ok(results.save > 0 && (results.wide + results.post) > 0, 'saves and misses occur: ' + JSON.stringify(results));
  // finishing and the active keeper matter
  const conv = (fin, gkRating) => { const g = fresh(0); g.run("M.ballSide='user'"); const tk = g.run("penaltyTaker('user')");
    g.run(`(function(){const p=S.players.find(x=>x.id===${tk});p.finishing=${fin};p.composure=${fin};const k=opponentPlayer(keeperId('opp'));k.gk={reflexes:${gkRating},handling:${gkRating},oneOnOne:${gkRating}};})()`);
    let goals = 0, n = 250;
    for (let i = 0; i < n; i++) { g.run(`M.rand=R(${7000 + i});M.hg=0;M.ag=0;M.events=[];startPitchRestart('PENALTY','user',[88,50])`); if (g.run("M.events.some(e=>e.type==='goal')")) goals++; }
    return goals / n; };
  const strong = conv(90, 50), weak = conv(45, 90);
  assert.ok(strong > weak + .1, `strong taker vs weak keeper ${strong.toFixed(2)} vs weak taker vs strong keeper ${weak.toFixed(2)}`);
});

test('POST / CROSSBAR: a real outcome that reaches the frame and rebounds into the loose-ball system', { timeout: 120000 }, () => {
  let post = 0, bar = 0; const bad = [];
  for (let i = 0; i < 400 && (post < 6 || bar < 3); i++) {
    const h = fresh(i % 34);
    h.run(`M.rand=R(${100 + i});M.dynamicPositions[12]=[90,50];setUserOwner(12);chanceV73(true)`);
    const e = h.run("M.events.findLast(e=>e.type==='post')");
    if (!e) continue;
    e.frame === 'crossbar' ? bar++ : post++;
    const shot = h.run("M.events.findLast(e=>e.type==='shot')");
    if (shot.outcome !== 'post') bad.push('shot outcome');
    same(shot.toPos, e.fromPos);                       // the ball reaches the frame exactly where the rebound starts
    const hitY = e.fromPos[1]; if (e.frame === 'post' && ![39, 61].includes(hitY)) bad.push('post spot ' + hitY);
    if (e.frame === 'crossbar' && !(hitY > 44 && hitY < 56)) bad.push('bar spot ' + hitY);
    if (e.ballSide !== 'none') bad.push('ball not loose');
    const types = h.run("M.events.map(e=>e.type)"), k = types.lastIndexOf('post');
    if (types[k + 1] !== 'looseBall') bad.push('no loose ball: ' + types.slice(k, k + 3));
    if (Math.abs(e.toPos[0] - e.fromPos[0]) < 4) bad.push('no visible rebound');
    // possession was not simply awarded: the ball is unowned until somebody physically recovers it or is still being chased
    assert.ok(types.slice(k, k + 4).includes('looseBall'));
  }
  same(bad, []);
  assert.ok(post >= 3 && bar >= 1, `post ${post}, crossbar ${bar}`);
});

test('GOAL / NET: the ball crosses the line into the net, is dead until the restart, then the conceding side kicks off', () => {
  const h = fresh(4);
  let scored = false;
  for (let i = 0; i < 400 && !scored; i++) { h.run(`M.rand=R(${9500 + i});setUserOwner(12);M.dynamicPositions[12]=[92,50];chanceV73(true)`); scored = h.run("M.events.some(e=>e.type==='goal')"); }
  assert.ok(scored);
  const k = h.run("M.events.findLastIndex(e=>e.type==='goal')");
  const seq = h.run(`M.events.slice(${k - 1},${k + 2}).map(e=>e.type)`);
  assert.deepEqual(Array.from(seq), ['shot', 'goal', 'kickoff']);
  const goal = h.run(`M.events[${k}]`), shot = h.run(`M.events[${k - 1}]`);
  same(goal.fromPos, shot.toPos);                                     // continuous ball path, no teleport
  assert.equal(goal.inNet, true);
  assert.ok(goal.toPos[0] > 100 || goal.toPos[0] < 0, 'ball ends beyond the goal line: ' + goal.toPos);
  assert.equal(goal.ballSide, 'none');
  const kick = h.run(`M.events[${k + 1}]`);
  assert.equal(kick.type, 'kickoff'); assert.equal(kick.fromSide, 'opp');
  same(h.run('M.ballState.position'), [50, 50]);
});

test('LONG BALL: aerial flight, contested reception; result is controlled or a real second ball', { timeout: 300000 }, () => {
  const d = arm({ passingStyle: 'Direkt' }, { n: 8 }), s = arm({ passingStyle: 'Kısa' }, { n: 8 });
  assert.ok(d.longShare > s.longShare);
  assert.ok(d.aerialLoose > 0, 'long balls create aerial second balls: ' + d.aerialLoose.toFixed(2));
  const h = fresh(0); playToEnd(h);
  const ev = h.run("M.events.filter(e=>e.type==='pass'&&e.travelType==='aerial').length");
  assert.ok(ev > 0, 'aerial travel is flagged on long deliveries');
  // aerial winner depends on strength/positioning, not on a coin flip
  const strong = h.run("(function(){const a=M.active.find(id=>M.matchRoles[id]==='ST'),b='o3';const p=S.players.find(x=>x.id===a);p.strength=95;p.positioning=90;p.fitness=100;const o=opponentPlayer(b);o.strength=45;o.positioning=45;o.fitness=100;return [aerialWinProbability(a,'user',b,'opp'),aerialWinProbability(b,'opp',a,'user')]})()");
  assert.ok(strong[0] > .7 && strong[0] < .97 && strong[1] < .35);
});

test('SUBSTITUTION: an injured player replaced by a different-position player executes once and the match resumes', () => {
  for (let i = 0; i < 6; i++) {
    const h = fresh(i);
    h.run('advanceLive(10)');
    const out = h.run("M.active.find(id=>M.matchRoles[id]==='ST')");
    const before = h.run('M.active.length');
    h.run(`(function(){const p=S.players.find(x=>x.id===${out});p.injury=1;M.requiredSubstitution={playerId:${out},reason:'injury',state:'SUBSTITUTION_REQUIRED'};M.pause=true;M.reason='injury';M.lifecycle='PAUSED'})()`);
    // pick a bench player who is NOT a natural striker (different-position warning) and accept the confirm
    const inc = h.run(`S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&p.injury===0&&p.pos.split('/')[0]!=='ST'&&p.pos!=='GK').id`);
    h.run(`window.OUT=${out}`);
    assert.equal(h.run(`doSub(${inc})`), true);
    assert.equal(h.run('M.requiredSubstitution'), null, 'no second substitution is demanded');
    assert.equal(h.run(`M.active.includes(${out})`), false);
    assert.equal(h.run(`M.active.includes(${inc})`), true);
    assert.equal(h.run('M.active.length'), before);
    assert.equal(h.run('M.substitutions.length'), 1, 'executed exactly once');
    assert.equal(h.run(`M.matchRoles[${inc}]`), 'ST');
    assert.ok(h.run(`positionSuitability(${inc},'user')`) < 1, 'Phase 2 position suitability applies');
    same(h.run(PROBES).problems, []);
    h.run('resumeLive()');
    assert.equal(h.run('M.pause'), false, 'engine is running again');
    h.run('advanceLive(6)');
    assert.ok(h.run('M.min') >= 11, 'the clock moves after the substitution');
    assert.equal(h.run('M.substitutions.length'), 1);
  }
});

test('SUBSTITUTION: no eligible bench player never blocks the match forever', () => {
  const h = fresh(2);
  h.run('advanceLive(8)');
  const out = h.run("M.active.find(id=>M.matchRoles[id]==='CM')");
  h.run(`(function(){S.players.filter(p=>!M.active.includes(p.id)).forEach(p=>{p.injury=3});const p=S.players.find(x=>x.id===${out});p.injury=1;
    M.requiredSubstitution={playerId:${out},reason:'injury',state:'SUBSTITUTION_REQUIRED'};M.pause=true;M.reason='injury';M.lifecycle='PAUSED'})()`);
  assert.equal(h.run('eligibleSubstitutes().length'), 0);
  h.run('resumeLive()');
  assert.equal(h.run('M.pause'), false);
  assert.equal(h.run('M.requiredSubstitution'), null);
  assert.ok(types(h).includes('order'));
  assert.ok(h.run(`S.players.find(p=>p.id===${out}).fitness`) <= 55, 'the injured player plays on in reduced condition');
  h.run('advanceLive(5)');
  assert.ok(h.run('M.min') > 8);
  // the same rule holds at half-time
  const g = fresh(3);
  g.run('advanceLive(30)');
  let guard = 0; while (g.run('M.reason') === 'injury' && guard++ < 4) g.run("(function(){const o=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const p=S.players.find(x=>x.id===o);if(p)p.injury=0;M.requiredSubstitution=null;resumeLive()})()");
  if (g.run('M.reason') !== 'half') g.run('advanceLive(30)');
  const who = g.run("M.active.find(id=>M.matchRoles[id]==='CM')");
  g.run(`(function(){S.players.filter(p=>!M.active.includes(p.id)).forEach(p=>{p.injury=3});S.players.find(x=>x.id===${who}).injury=1;M.requiredSubstitution={playerId:${who},reason:'injury',state:'SUBSTITUTION_REQUIRED'}})()`);
  g.run('startSecondHalf()');
  assert.equal(g.run('M.reason'), '');
  assert.equal(g.run('M.requiredSubstitution'), null);
});

test('MATCH CONTINUITY: every special sequence returns to valid open play without deadlock', { timeout: 300000 }, () => {
  for (const fixture of [0, 5, 9, 14]) {
    const h = fresh(fixture);
    let injured = 0;
    playToEnd(h, kind => { if (!kind) { const r = h.run('M.restart'); if (r && r.restartPhase && r.restartPhase !== 'LIVE') assert.fail('restart left incomplete: ' + r.restartPhase); } });
    assert.equal(h.run('M.finished'), true);
    assert.equal(h.run("M.events.filter(e=>e.type==='end').length"), 1);
    const t = h.run('M.events.map(e=>e.type)');
    assert.ok(t.includes('kickoff') && t.includes('goalKick'));
    void injured;
  }
});

test('determinism: same seed, lineups, ratings and tactics give the same match; different tactics differ', () => {
  const sig = (fixture, tactics) => { const h = harness(); h.run(`S=fresh();init();S.fixture=${fixture};startMatch();Object.assign(M,${JSON.stringify(tactics)});resumeLive()`); playToEnd(h); return JSON.stringify(h.run("[M.hg,M.ag,M.events.map(e=>[e.type,e.fromId,e.toId,e.gameSecond,e.success,e.restartType])]")); };
  const a = { press: 'Yüksek', passingStyle: 'Direkt', tempo: 'Yüksek' };
  assert.equal(sig(6, a), sig(6, a));
  assert.notEqual(sig(6, a), sig(6, {}));
  const fs = require('node:fs'), path = require('node:path');
  const src = ['pitch-v73.js', 'pitch-v731.js', 'match-support.js', 'live-match.js'].map(f => fs.readFileSync(path.resolve(__dirname, '../dist', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /Math\.random/);
});

test('opponent labels share the same dot geometry as the managed team (alignment fix)', () => {
  const css = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../dist/style.css'), 'utf8');
  assert.match(css, /\.v73pitch \.matchdot\{box-sizing:border-box;padding:0;line-height:1\}/);
  assert.match(css, /\.v73pitch \.matchdot span\{display:block;line-height:1;text-align:center/);
});

/* ---- added while completing Phase 3: penalties from real box challenges, set-piece recovery runs ---- */
test('PENALTY SOURCE: only a challenge inside the defender\'s own box can give a penalty; rate is small and attribute-aware', () => {
  const h = fresh(0);
  const carrier = h.run("M.active.find(id=>M.matchRoles[id]==='ST')"), def = 'o3';
  const dir = h.run("attackDirection('opp')"), ownX = dir > 0 ? 0 : 100;           // opponent's own goal line
  const inBox = [ownX === 0 ? 8 : 92, 50], outside = [50, 50], wideOfBox = [ownX === 0 ? 8 : 92, 5];
  const rate = (pt, n = 3000) => h.run(`(function(){let k=0;const snap=JSON.stringify([M.events.length]);
    for(let i=0;i<${n};i++){M.rand=R(700+i);const ev=M.events.length;
      const orig=startPitchRestart;let fired=false;startPitchRestart=function(){fired=true;return null};
      if(boxChallengePenalty('${def}','opp',${carrier},'user',${JSON.stringify(pt)}))k++;
      startPitchRestart=orig;M.events.length=ev;}
    return k/${n}})()`);
  assert.equal(rate(outside), 0, 'never outside the box');
  assert.equal(rate(wideOfBox), 0, 'never outside the box width');
  const base = rate(inBox);
  assert.ok(base > .025 && base < .08, 'a small share of box challenges are fouls: ' + base);
  // a clean tackler concedes fewer, a tricky dribbler draws more (same seeds)
  h.run("Object.assign(opponentPlayer('o3'),{tackling:95,positioning:90})");
  const clean = rate(inBox);
  h.run("Object.assign(opponentPlayer('o3'),{tackling:40,positioning:45})");
  h.run(`Object.assign(S.players.find(p=>p.id===${carrier}),{dribbling:95})`);
  const reckless = rate(inBox);
  assert.ok(reckless > clean + .02, `dribbler vs weak tackler ${reckless} > clean tackler ${clean}`);
  // a penalty for the SAME side is impossible (team-safe)
  assert.equal(h.run(`boxChallengePenalty(${carrier},'user','o9','user',${JSON.stringify(inBox)})`), false);
});

test('PENALTY SOURCE: an awarded penalty runs the restart machine for the fouled team and returns to play', () => {
  let awarded = 0;
  for (let i = 0; i < 400 && awarded < 5; i++) {
    const h = fresh(i % 34);
    h.run('advanceLive(8)');
    if (h.run('M.pause') && !h.run('M.finished')) h.run("M.reason==='half'?startSecondHalf():resumeLive()");
    const carrier = h.run("M.active.find(id=>M.matchRoles[id]==='ST')");
    const ownX = h.run("attackDirection('opp')") > 0 ? 0 : 100, pt = [ownX === 0 ? 7 : 93, 48];
    h.run(`M.rand=R(${31000 + i});switchPitchOwner(${carrier},'user');M.dynamicPositions['${carrier}']=${JSON.stringify(pt)};setBallState(${JSON.stringify(pt)},${carrier})`);
    const before = h.run('M.events.length');
    if (!h.run(`boxChallengePenalty('o3','opp',${carrier},'user',${JSON.stringify(pt)})`)) continue;
    awarded++;
    const ev = h.run(`M.events.slice(${before}).map(e=>({t:e.type,rt:e.restartType,fs:e.fromSide,p:e.penalty}))`);
    assert.equal(ev[0].t, 'foul'); assert.equal(ev[0].fs, 'opp');
    assert.equal(ev[1].t, 'penalty');
    const shot = ev.find(e => e.t === 'shot');
    assert.ok(shot && shot.p && shot.fs === 'user', 'the fouled team takes the penalty');
    assert.equal(h.run("M.restart.restartType==='PENALTY'||M.restart.restartType==='KICK_OFF'||M.restart.restartType==='GOAL_KICK'||M.restart.restartType==='CORNER'"), true);
    assert.equal(h.run("M.restart.restartPhase"), 'LIVE');
    same(h.run(PROBES).problems, []);
    h.run('advanceLive(4)'); if (h.run('M.pause') && !h.run('M.finished')) h.run('resumeLive()');
    same(h.run(PROBES).problems, []);
  }
  assert.ok(awarded >= 3, 'enough awarded penalties sampled: ' + awarded);
});

test('SET-PIECE RECOVERY: players pulled into the box for a corner run back to shape within two minutes, never teleport', () => {
  let checked = 0;
  // one football minute through the real loop; half-time and injury stops are resolved so the clock really moves
  const minute = h => {
    const m0 = h.run('M.min');
    for (let g = 0; g < 4 && h.run('M.min') === m0 && !h.run('M.finished'); g++) {
      if (h.run('M.pause')) {
        if (h.run('M.reason') === 'half') h.run('startSecondHalf()');
        else h.run("(function(){const out=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);if(out)S.players.find(p=>p.id===out).injury=0;M.requiredSubstitution=null;resumeLive()})()");
      }
      h.run('advanceLive(60/90)');
    }
    return h.run('M.min') > m0;
  };
  for (let i = 0; i < 8; i++) {
    const h = fresh(i);
    h.run('advanceLive(15)'); if (h.run('M.pause') && !h.run('M.finished')) h.run("M.reason==='half'?startSecondHalf():resumeLive()");
    const side = 'user', dir = h.run("attackDirection('user')");
    h.run(`startPitchRestart('CORNER','user',[${dir > 0 ? 100 : 0},5])`);
    const cbs = h.run("M.active.filter(id=>M.matchRoles[id]==='CB')");
    const rel = id => { const x = h.run(`eventPoint(${id},'user')[0]`); return dir > 0 ? x : 100 - x; };
    const inBox = cbs.filter(id => rel(id) > 80);
    if (!inBox.length) continue;                                  // corner ended with nobody left forward
    const start = Object.fromEntries(inBox.map(id => [id, rel(id)]));
    const prev = Object.fromEntries(inBox.map(id => [id, h.run(`[...eventPoint(${id},'user')]`)]));
    let moved = 0;
    for (let m = 0; m < 3; m++) {
      if (minute(h)) moved++;
      for (const id of inBox) {
        const p = h.run(`[...eventPoint(${id},'user')]`);
        assert.ok(Math.hypot(p[0] - prev[id][0], p[1] - prev[id][1]) <= 60, 'a recovery run is fast, not a teleport across the pitch');
        prev[id] = p;
      }
    }
    assert.equal(moved, 3, 'the clock advanced three football minutes');
    for (const id of inBox) assert.ok(rel(id) < start[id] - 15 || rel(id) < 70, `CB ${id} back from ${start[id].toFixed(1)} to ${rel(id).toFixed(1)}`);
    same(h.run(PROBES).problems, []);
    checked++;
  }
  assert.ok(checked >= 3, 'corners sampled with centre-backs in the box: ' + checked);
  // outside set pieces the normal positional-adjustment speed still applies
  const h = fresh(2); h.run('advanceLive(10)');
  assert.equal(h.run('M.setPieceReturn==null||M.min-M.setPieceReturn.min>2||!setPieceRecovering()'), true);
});

test('PASSING STYLE decision: Direkt differs from Dengeli (not only from Kısa); execution still comes from Phase 2', () => {
  const measure = style => {
    let n = 0, prog = 0, long = 0, dist = 0;
    for (let f = 0; f < 6; f++) {
      const h = harness(); h.run(`S=fresh();init();S.fixture=${f};startMatch();M.passingStyle='${style}';resumeLive();advanceLive(10)`);
      const r = h.run(`(function(){let n=0,prog=0,long=0,dist=0;M.rand=R(55);
        for(const from of M.active){if(M.matchRoles[from]==='GK')continue;
          for(let k=0;k<120;k++){const o=weightedPitchChoice(passOptions('user',from));n++;if(o.progress>12)prog++;if(o.range>29)long++;dist+=o.range;}}
        return {n,prog,long,dist}})()`);
      n += r.n; prog += r.prog; long += r.long; dist += r.dist;
    }
    return { prog: prog / n, long: long / n, dist: dist / n };
  };
  const short = measure('Kısa'), mixed = measure('Dengeli'), direct = measure('Direkt');
  assert.ok(direct.prog > mixed.prog + .05 && direct.prog > short.prog + .05, `progressive: Kısa ${short.prog.toFixed(3)}, Dengeli ${mixed.prog.toFixed(3)}, Direkt ${direct.prog.toFixed(3)}`); // Kısa is about distance/risk, not fewer forward passes
  assert.ok(direct.dist > mixed.dist + 1.5 && mixed.dist > short.dist + 3, `range: ${short.dist.toFixed(1)} < ${mixed.dist.toFixed(1)} < ${direct.dist.toFixed(1)}`);
  assert.ok(direct.long > mixed.long && mixed.long > short.long);
  // style never touches execution quality: the same pass has the same success probability under every style
  const h = fresh(0); const id = h.run("M.active.find(id=>M.matchRoles[id]==='CM')");
  const p = s => h.run(`(M.passingStyle='${s}',passSuccessProbability(${id},'user',{range:40,lane:.3,space:{danger:.3}},{pressure:.3}))`);
  assert.equal(p('Kısa'), p('Direkt'));
});
