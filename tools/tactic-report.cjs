#!/usr/bin/env node
/* Phase 3 tactic report. usage: node tools/tactic-report.cjs [matchesPerArm=12] [--json]
   Each arm plays the same fixtures with one managed-team tactic changed (opponent left at its default),
   or sets BOTH teams explicitly for the isolation arms. Everything runs through the real loop. */
const { harness, playToEnd } = require('../tests/engine-harness.cjs');
const N = Number(process.argv[2]) || 12;
const asJson = process.argv.includes('--json');

function playArm(label, userTactics, oppTactics, teamInstr) {
  const agg = { matches: 0, userPress: 0, oppPress: 0, won: 0, fatigue: 0, fatigueN: 0, passes: 0, cp: 0, distSum: 0, distN: 0, long: 0, loose: 0, secondBalls: 0,
    defLineSum: 0, defLineN: 0, spreadSum: 0, spreadN: 0, transSum: 0, transN: 0, goals: 0, conceded: 0, shots: 0, xgAgainst: 0, events: 0, oppPassDist: 0, oppPassN: 0, oppDefLine: 0, oppDefN: 0 };
  for (let i = 0; i < N; i++) {
    const h = harness(); h.run(`S=fresh();init();S.fixture=${i % 34};startMatch();`);
    h.run(`Object.assign(M,${JSON.stringify(userTactics)});M.teamInstructions=${JSON.stringify(teamInstr || [])};${oppTactics ? `M.oppTactics=${JSON.stringify(oppTactics)};` : ''}resumeLive()`);
    const before = h.run('Object.fromEntries(S.players.map(p=>[p.id,p.fitness]))');
    const starters = h.run('M.active.slice()');
    playToEnd(h, kind => {
      if (kind) return;
      const d = h.run(`(function(){const out={};const rel=(id,s)=>{const x=eventPoint(id,s)[0];return attackDirection(s)>0?x:100-x};
        const cb=M.active.filter(id=>['CB','LB','RB'].includes(M.matchRoles[id])),ocb=M.oppIds.filter(id=>['CB','LB','RB'].includes(opponentPlayer(id)?.position));
        out.ballSide=M.ballSide;out.cb=cb.length?cb.reduce((n,id)=>n+rel(id,'user'),0)/cb.length:null;out.ocb=ocb.length?ocb.reduce((n,id)=>n+rel(id,'opp'),0)/ocb.length:null;
        const ys=M.active.filter(id=>M.matchRoles[id]!=='GK').map(id=>eventPoint(id,'user')[1]);const m=ys.reduce((a,b)=>a+b,0)/ys.length;
        out.spread=Math.sqrt(ys.reduce((a,b)=>a+(b-m)*(b-m),0)/ys.length);return out})()`);
      if (d.ballSide === 'opp' && d.cb != null) { agg.defLineSum += d.cb; agg.defLineN++; }
      if (d.ballSide === 'user' && d.ocb != null) { agg.oppDefLine += d.ocb; agg.oppDefN++; }
      agg.spreadSum += d.spread; agg.spreadN++;
    });
    const s = h.run(`({u:userSide(),st:M.stats,sh:M.shots,hg:M.hg,ag:M.ag,ev:M.events.map(e=>({t:e.type,fs:e.fromSide,ts:e.toSide,d:e.distance,k:e.passKind,r:e.reason,s:e.gameSecond,ok:e.success,fp:e.fromPos,tp:e.toPos}))})`);
    const u = s.u; agg.matches++;
    agg.userPress += s.ev.filter(e => e.t === 'press' && e.ts === 'user').length;
    agg.oppPress += s.ev.filter(e => e.t === 'press' && e.ts === 'opp').length;
    agg.won += s.st.possessionsWon[u]; agg.passes += s.st.passes[u]; agg.cp += s.st.completedPasses[u];
    agg.goals += u === 0 ? s.hg : s.ag; agg.conceded += u === 0 ? s.ag : s.hg; agg.shots += s.sh[u]; agg.xgAgainst += s.st.xg[1 - u];
    const up = s.ev.filter(e => (e.t === 'pass' || e.t === 'cross') && e.fs === 'user' && e.d != null);
    agg.distSum += up.reduce((n, e) => n + e.d, 0); agg.distN += up.length; agg.long += up.filter(e => e.d > 29).length; // engine long-ball threshold; 'through' passes over 29 are long balls too
    const op = s.ev.filter(e => (e.t === 'pass' || e.t === 'cross') && e.fs === 'opp' && e.d != null);
    agg.oppPassDist += op.reduce((n, e) => n + e.d, 0); agg.oppPassN += op.length;
    for (const e of s.ev) if (e.t === 'looseBall') { agg.loose++; if (['pass', 'aerial'].includes(e.r)) agg.secondBalls++; }
    s.ev.forEach((e, idx) => {
      if (['interception', 'tackle', 'recovery'].includes(e.t) && e.ts === 'user' && e.ok !== false) {
        const nxt = s.ev.slice(idx + 1, idx + 7).find(x => (x.t === 'pass' || x.t === 'cross') && x.fs === 'user' && x.fp && x.tp);
        if (nxt) { const dirSign = nxt.s > 2700 ? -1 : 1; agg.transSum += (nxt.tp[0] - nxt.fp[0]) * dirSign; agg.transN++; }
      }
    });
    for (const id of starters) {
      const p = h.run(`S.players.find(p=>p.id===${id})`);
      if (p.minutes >= 80) { agg.fatigue += before[id] - p.fitness; agg.fatigueN++; }
    }
    agg.events += s.ev.length;
  }
  const f = (x, d = 2) => +x.toFixed(d);
  return { arm: label, pressEngagements: f(agg.userPress / N, 1), oppPressEngagements: f(agg.oppPress / N, 1), possessionsWon: f(agg.won / N, 1), fatiguePerMatch: f(agg.fatigue / Math.max(1, agg.fatigueN), 2),
    passesPerMatch: f(agg.passes / N, 1), completion: f(agg.cp / Math.max(1, agg.passes), 3), passDistance: f(agg.distSum / Math.max(1, agg.distN), 1), oppPassDistance: f(agg.oppPassDist / Math.max(1, agg.oppPassN), 1),
    longBallShare: f(agg.long / Math.max(1, agg.distN), 3), secondBalls: f(agg.secondBalls / N, 1), defLineWhenDefending: f(agg.defLineSum / Math.max(1, agg.defLineN), 1), oppDefLine: f(agg.oppDefLine / Math.max(1, agg.oppDefN), 1),
    teamWidthSd: f(agg.spreadSum / Math.max(1, agg.spreadN), 2), transitionProgress: f(agg.transSum / Math.max(1, agg.transN), 2), goalsFor: f(agg.goals / N), goalsAgainst: f(agg.conceded / N), shots: f(agg.shots / N, 1), xgAgainst: f(agg.xgAgainst / N), eventsPerMatch: f(agg.events / N, 0) };
}

const arms = [
  ['baseline (all Normal, opp default)', {}, null, []],
  ['press HIGH', { press: 'Yüksek' }, null, []], ['press LOW', { press: 'Düşük' }, null, []],
  ['tempo HIGH', { tempo: 'Yüksek' }, null, []], ['tempo LOW', { tempo: 'Düşük' }, null, []],
  ['line HIGH', { line: 'Önde' }, null, []], ['line LOW', { line: 'Geride' }, null, []],
  ['passing SHORT', { passingStyle: 'Kısa' }, null, []], ['passing DIRECT', { passingStyle: 'Direkt' }, null, []],
  ['width WIDE', { width: 'Geniş' }, null, []], ['width NARROW', { width: 'Dar' }, null, []],
  ['mentality ATTACK', { mentality: 'Cesur' }, null, []], ['mentality CAUTIOUS', { mentality: 'Temkinli' }, null, []],
  ['fast transition ON', {}, null, ['quick']], ['patience ON (topu dolaştır)', {}, null, ['patience']], ['compact ON (alanı daralt)', {}, null, ['compact']],
  ['ISOLATION A: user HIGH press / opp LOW press', { press: 'Yüksek' }, { press: 'Düşük' }, []],
  ['ISOLATION B: user LOW press / opp HIGH press', { press: 'Düşük' }, { press: 'Yüksek' }, []],
  ['ISOLATION C: both Normal press (explicit)', { press: 'Normal' }, { press: 'Normal' }, []],
];
const rows = arms.map(([l, u, o, i]) => playArm(l, u, o, i));
if (asJson) console.log(JSON.stringify(rows));
else for (const r of rows) console.log(JSON.stringify(r));
