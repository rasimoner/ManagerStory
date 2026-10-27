/* Helpers shared by the Phase 3 tests (matchengine-phase3*.test.cjs). */
const assert = require('node:assert/strict');
const { harness, playToEnd } = require('../engine-harness.cjs');

const fresh = (fixture = 0) => { const h = harness(); h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`); return h; };
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const types = h => h.run('M.events.map(e=>e.type)');

/* Play N seeded matches with a managed-team tactic, return aggregate behavioural metrics. */
function arm(tactics, { n = 8, opp = null, instr = [], first = 0 } = {}) {
  const t = { press: 0, oppPress: 0, fatigue: 0, fatigueN: 0, passes: 0, completed: 0, dist: 0, distN: 0, longBalls: 0, loose: 0, defLine: 0, defN: 0, spread: 0, spreadN: 0,
    actions: 0, matches: 0, oppDefLine: 0, oppDefN: 0, oppFatigue: 0, oppFatigueN: 0, aerialLoose: 0, crosses: 0 };
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
    t.dist += up.reduce((a, e) => a + e.d, 0); t.distN += up.length; t.longBalls += up.filter(e => e.d > 29).length;   // (V7.9.3: by length — 'cross' is now only a ball into the box, a long ball forward is labelled 'through')
    t.loose += s.ev.filter(e => e.t === 'looseBall').length; t.aerialLoose += s.ev.filter(e => e.t === 'looseBall' && e.r === 'aerial').length;
    t.actions += s.ev.length; t.crosses += s.ev.filter(e => e.t === 'cross' && e.fs === 'user').length;
    for (const id of starters) { const p = h.run(`S.players.find(p=>p.id===${id})`); if (p.minutes >= 80) { t.fatigue += before[id] - p.fitness; t.fatigueN++; } }
    for (const id of h.run('Object.keys(M.oppLineup)')) { const o = h.run(`opponentPlayer(${JSON.stringify(id)})`); if (o && oppBefore[id] != null) { t.oppFatigue += oppBefore[id] - o.fitness; t.oppFatigueN++; } }
  }
  return { press: t.press / t.matches, oppPress: t.oppPress / t.matches, fatigue: t.fatigue / Math.max(1, t.fatigueN), oppFatigue: t.oppFatigue / Math.max(1, t.oppFatigueN),
    passes: t.passes / t.matches, completion: t.completed / Math.max(1, t.passes), passDist: t.dist / Math.max(1, t.distN), longShare: t.longBalls / Math.max(1, t.distN),
    defLine: t.defLine / Math.max(1, t.defN), oppDefLine: t.oppDefLine / Math.max(1, t.oppDefN), spread: t.spread / Math.max(1, t.spreadN), loose: t.loose / t.matches, aerialLoose: t.aerialLoose / t.matches, events: t.actions / t.matches, crosses: t.crosses / t.matches };
}

module.exports = { fresh, same, types, arm };
