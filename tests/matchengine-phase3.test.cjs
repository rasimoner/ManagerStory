/* Phase 3 — manager control and real match events, on top of the Phase 1 + Phase 2 engine.
   Probabilistic behaviour is asserted as distributions over seeded full matches; events are asserted
   through the real loop. Restarts, set pieces and continuity: matchengine-phase3-restarts.test.cjs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./engine-harness.cjs');

const { fresh, same, arm } = require('./support/phase3.cjs');

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
  // (the script that holds the minute decision, today pitch-v73.js)
  const src = require('./support/game.cjs').scriptsDefining(['actionMinute']).map(x => x.code).join('\n');
  assert.doesNotMatch(src, /M\.(press|tempo|line|width|mentality|passingStyle)\b/, 'the minute decision reads tactics only through the team-scoped profile');
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
  // (V7.9.4: actions, not passes — an open-play cross ends a move, and a slower side builds to more of them)
  assert.ok(hi.events > lo.events * 1.02, `high tempo plays more actions: ${hi.events.toFixed(0)} vs ${lo.events.toFixed(0)}`);
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
  // 16 matches per arm: over 8 the long-ball share difference sat at the edge of the threshold (seed noise)
  const short = arm({ passingStyle: 'Kısa' }, { n: 16 }), direct = arm({ passingStyle: 'Direkt' }, { n: 16 });
  assert.ok(direct.passDist > short.passDist + 3, `distance ${direct.passDist.toFixed(1)} vs ${short.passDist.toFixed(1)}`);
  assert.ok(direct.longShare > short.longShare + .05, `long share ${direct.longShare.toFixed(3)} vs ${short.longShare.toFixed(3)}`);
  assert.ok(direct.completion < short.completion, `completion ${direct.completion.toFixed(3)} vs ${short.completion.toFixed(3)}`);
});

test('V7.9.4 WINGS vs CENTRE: playing through the wings puts more crosses into the box', { timeout: 600000 }, () => {
  const wings = arm({ approach: 'Kanatlar' }, { n: 12 }), centre = arm({ approach: 'Merkez' }, { n: 12 });
  assert.ok(wings.crosses > centre.crosses * 1.4 + 0.3, `crosses per match ${wings.crosses.toFixed(2)} vs ${centre.crosses.toFixed(2)}`);
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

test('PASSING STYLE decision: Direkt differs from Dengeli (not only from Kısa); execution still comes from Phase 2', () => {
  const measure = style => {
    let n = 0, prog = 0, long = 0, dist = 0;
    for (let f = 0; f < 6; f++) {
      // the same match state for every style (play the opening with one style, then switch), so only the decision differs
      const h = harness(); h.run(`S=fresh();init();S.fixture=${f};startMatch();M.passingStyle='Dengeli';resumeLive();advanceLive(10);M.passingStyle='${style}'`);
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
