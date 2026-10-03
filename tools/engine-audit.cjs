#!/usr/bin/env node
/* Deterministic MatchEngine audit. usage: node tools/engine-audit.cjs [matches=100] [--json]
   Drives the real game loop (advanceLive -> tick) one game minute at a time. */
const { harness, PROBES, playToEnd } = require('../tests/engine-harness.cjs');
const N = Number(process.argv[2]) || 100;
const asJson = process.argv.includes('--json');
const COMBOS = process.argv.includes('--combos');
// Phase 3: rotate managed-team tactics AND explicit opponent tactics across the matches
const COMBO_LIST = [
  [{}, null, []],
  [{ press: 'Yüksek', line: 'Önde' }, { press: 'Düşük', line: 'Geride' }, []],
  [{ passingStyle: 'Direkt', tempo: 'Yüksek' }, { passingStyle: 'Kısa' }, ['quick']],
  [{ width: 'Geniş', approach: 'Kanatlar' }, { width: 'Dar' }, []],
  [{ tempo: 'Düşük', passingStyle: 'Kısa' }, { tempo: 'Yüksek', press: 'Yüksek' }, ['patience']],
  [{ mentality: 'Cesur', press: 'Yüksek' }, { mentality: 'Temkinli', line: 'Geride' }, []],
  [{ mentality: 'Temkinli', line: 'Geride', width: 'Dar' }, { mentality: 'Cesur', line: 'Önde' }, ['compact']],
  [{ approach: 'Kontra', press: 'Düşük' }, { press: 'Yüksek', passingStyle: 'Direkt' }, ['quick']],
  [{ press: 'Yüksek', tempo: 'Yüksek', line: 'Önde', mentality: 'Cesur' }, { press: 'Yüksek', tempo: 'Yüksek', line: 'Önde', mentality: 'Cesur' }, []],
  [{ press: 'Düşük', tempo: 'Düşük', line: 'Geride', mentality: 'Temkinli' }, { press: 'Düşük', tempo: 'Düşük', line: 'Geride', mentality: 'Temkinli' }, ['compact', 'patience']],
];

function playOne(index) {
  const h = harness();
  h.run(`S=fresh();init();S.fixture=${index % 34};startMatch();`);
  let combo = null;
  if (COMBOS) { combo = COMBO_LIST[index % COMBO_LIST.length]; h.run(`Object.assign(M,${JSON.stringify(combo[0])});M.teamInstructions=${JSON.stringify(combo[2])};${combo[1] ? `M.oppTactics=${JSON.stringify(combo[1])};` : ''}`); }
  const tacticsBefore = h.run('JSON.stringify([M.mentality,M.press,M.tempo,M.line,M.approach,M.passingStyle,M.width,M.teamInstructions,M.oppTactics||null])');
  const r = {
    index, problems: {}, ticks: 0, minPair: 99, collapse: 0, samples: 0, afterFullTime: 0, finalizations: 0,
    gkPasses: 0, passes: 0, pingPong: 0, looseTeleports: 0, secondHalfShapeInverted: null, crash: null, result: null,
    events: 0,
  };
  const note = p => { for (const x of p.problems) r.problems[x] = (r.problems[x] || 0) + 1; r.minPair = Math.min(r.minPair, p.minPair); };
  try {
    h.run('resumeLive()');
    playToEnd(h, kind => {
      const p = h.run(PROBES);
      if (kind === 'secondHalf') { r.secondHalfShapeInverted = h.run("(function(){const gk=M.active.find(id=>M.matchRoles[id]==='GK');const back=M.active.filter(id=>['CB','LB','RB'].includes(M.matchRoles[id]));const bx=back.length?back.reduce((n,id)=>n+eventPoint(id,'user')[0],0)/back.length:50;return (gk!=null&&eventPoint(gk,'user')[0]<50)||bx<50})()"); return; }
      r.ticks++; r.samples++; note(p);
      if (!p.setPiece && Math.max(p.nearUser, p.nearOpp) >= 7) r.collapse++;
    });
    const ev = h.run('M.events.map(e=>({t:e.type,f:e.fromId,to:e.toId,fs:e.fromSide,ts:e.toSide,s:e.gameSecond,succ:e.success,k:e.passKind,rt:e.restartType,rs:e.reason,cs:e.chaseSeconds,sd:e.startDistance}))');
    r.events = ev.length;
    const pass = ev.filter(e => e.t === 'pass' && e.succ !== false && e.fs === e.ts);
    r.passes = pass.length;
    r.gkPasses = pass.filter(e => (typeof e.to === 'string' ? e.to === 'o0' : h.run(`M.matchRoles[${JSON.stringify(e.to)}]==='GK'`)) && e.f !== e.to).length;
    for (let i = 2; i < pass.length; i++) if (pass[i].f === pass[i - 2].f && pass[i].to === pass[i - 2].to && pass[i].f !== pass[i].to && pass[i].f === pass[i-1].to) r.pingPong++;
    // strict ping-pong: A->B, B->A, A->B (the loose metric above also counts A->B, X->A, A->B)
    for (let i = 2; i < pass.length; i++) if (pass[i].f === pass[i - 2].f && pass[i].to === pass[i - 2].to && pass[i - 1].f === pass[i].to && pass[i - 1].to === pass[i].f) r.strictPingPong = (r.strictPingPong || 0) + 1;
    for (const e of ev) if (e.t === 'recovery' && e.sd != null) { r.recoveries = (r.recoveries || 0) + 1; if (e.sd > 2.2 && e.cs > 0) r.chased = (r.chased || 0) + 1; else r.atBall = (r.atBall || 0) + 1; r.chaseSum = (r.chaseSum || 0) + e.cs; }
    r.finalizations = ev.filter(e => e.t === 'end').length;
    const endIndex = ev.findIndex(e => e.t === 'end');
    r.afterFullTime = endIndex >= 0 ? ev.length - endIndex - 1 : 0;
    r.result = h.run('[M.hg,M.ag]');
    r.tacticsContaminated = h.run('JSON.stringify([M.mentality,M.press,M.tempo,M.line,M.approach,M.passingStyle,M.width,M.teamInstructions,M.oppTactics||null])') !== tacticsBefore;
    r.restartIncomplete = h.run("!!(M.restart&&M.restart.restartPhase&&M.restart.restartPhase!=='LIVE')");
    r.dupEvents = h.run("M.events.filter((e,i,a)=>i>0&&e.type===a[i-1].type&&e.fromId===a[i-1].fromId&&e.toId===a[i-1].toId&&e.gameSecond===a[i-1].gameSecond&&e.outcome===a[i-1].outcome&&e.success===a[i-1].success&&e.xg===a[i-1].xg&&!(e.type==='hold'&&e.minute===a[i-1].minute)&&JSON.stringify(e.fromPos)===JSON.stringify(a[i-1].fromPos)&&JSON.stringify(e.toPos)===JSON.stringify(a[i-1].toPos)&&!['restartWait','restartPlayers','restartPosition','ballOut','tactic','order'].includes(e.type)).length");
    r.kinds = h.run("(function(){const c={};for(const e of M.events){const k=e.type+(e.restartType&&e.type!=='kickoff'?'':'');c[k]=(c[k]||0)+1}return c})()");
    r.netGoals = h.run("M.events.filter(e=>e.type==='goal'&&e.inNet).length"); r.goals = h.run("M.events.filter(e=>e.type==='goal').length");
    r.penaltyShots = h.run("M.events.filter(e=>e.type==='shot'&&e.penalty).length"); r.penaltyGoals = h.run("M.events.filter(e=>e.type==='goal'&&e.penalty).length");
    r.headers = h.run("M.events.filter(e=>e.type==='shot'&&e.header).length"); r.frames = h.run("M.events.filter(e=>e.type==='post'&&e.hitFrame).length");
    r.aerialLoose = h.run("M.events.filter(e=>e.type==='looseBall'&&e.reason==='aerial').length");
    r.longGoalKicks = h.run("M.events.filter(e=>e.type==='goalKick'&&e.passKind==='long').length");
    r.fatigue = h.run('(function(){const a=S.players.filter(p=>p.minutes>=80);return a.length?a.reduce((n,p)=>n+p.fitness,0)/a.length:null})()');
    r.stats = h.run('({p:M.stats.passes,cp:M.stats.completedPasses,sh:M.shots,ont:M.ont,xg:M.stats.xg,pos:[M.userPossTicks,M.oppPossTicks],tk:M.stats.tackles,pw:M.stats.possessionsWon,dr:Object.values(M.playerStats).reduce((n,s)=>n+s.dribblesAttempted,0),drw:Object.values(M.playerStats).reduce((n,s)=>n+s.dribbles,0)})');
    r.loose = ev.filter(e => e.t === 'looseBall').length;
  } catch (e) { r.crash = String(e.stack || e).split('\n').slice(0, 3).join(' | '); }
  return r;
}

const runs = []; for (let i = 0; i < N; i++) runs.push(playOne(i));
const sum = f => runs.reduce((n, r) => n + f(r), 0);
const agg = {
  matches: N, crashes: runs.filter(r => r.crash).length,
  problems: runs.reduce((o, r) => { for (const [k, v] of Object.entries(r.problems)) o[k] = (o[k] || 0) + v; return o; }, {}),
  ticks: sum(r => r.ticks), minPairDistance: Math.min(...runs.map(r => r.minPair)),
  collapseSamples: sum(r => r.collapse), samples: sum(r => r.samples),
  gkPassShare: +(sum(r => r.gkPasses) / Math.max(1, sum(r => r.passes))).toFixed(3),
  pingPongLoops: sum(r => r.pingPong), strictPingPong: sum(r => r.strictPingPong || 0), looseBalls: sum(r => r.loose || 0), recoveries: sum(r => r.recoveries || 0), recoveriesAfterRealChase: sum(r => r.chased || 0), meanChaseSeconds: +(sum(r => r.chaseSum || 0) / Math.max(1, sum(r => r.recoveries || 0))).toFixed(2),
  secondHalfInverted: runs.filter(r => r.secondHalfShapeInverted).length,
  eventsAfterFullTime: sum(r => r.afterFullTime), matchesWithBadFinalization: runs.filter(r => r.finalizations !== 1).length,
  goalsPerMatch: +(sum(r => (r.result || [0, 0])[0] + (r.result || [0, 0])[1]) / N).toFixed(2),
  passCompletion: +(sum(r => (r.stats ? r.stats.cp[0] + r.stats.cp[1] : 0)) / Math.max(1, sum(r => (r.stats ? r.stats.p[0] + r.stats.p[1] : 0)))).toFixed(3),
  passesPerMatch: +(sum(r => (r.stats ? r.stats.p[0] + r.stats.p[1] : 0)) / N).toFixed(1),
  shotsPerMatch: +(sum(r => (r.stats ? r.stats.sh[0] + r.stats.sh[1] : 0)) / N).toFixed(2),
  onTargetShare: +(sum(r => (r.stats ? r.stats.ont[0] + r.stats.ont[1] : 0)) / Math.max(1, sum(r => (r.stats ? r.stats.sh[0] + r.stats.sh[1] : 0)))).toFixed(3),
  xgPerMatch: +(sum(r => (r.stats ? r.stats.xg[0] + r.stats.xg[1] : 0)) / N).toFixed(2),
  userPossession: +(sum(r => (r.stats ? r.stats.pos[0] : 0)) / Math.max(1, sum(r => (r.stats ? r.stats.pos[0] + r.stats.pos[1] : 0)))).toFixed(3),
  dribbleSuccess: +(sum(r => (r.stats ? r.stats.drw : 0)) / Math.max(1, sum(r => (r.stats ? r.stats.dr : 0)))).toFixed(3),
  restartsIncomplete: runs.filter(r => r.restartIncomplete).length,
  tacticContamination: runs.filter(r => r.tacticsContaminated).length,
  duplicateEvents: sum(r => r.dupEvents || 0),
  corners: +(sum(r => (r.kinds && r.kinds.corner) || 0) / N).toFixed(2),
  throwIns: +(sum(r => (r.kinds && r.kinds.throwIn) || 0) / N).toFixed(2),
  goalKicks: +(sum(r => (r.kinds && r.kinds.goalKick) || 0) / N).toFixed(2),
  freeKicks: +(sum(r => (r.kinds && r.kinds.freeKick) || 0) / N).toFixed(2),
  kickoffs: +(sum(r => (r.kinds && r.kinds.kickoff) || 0) / N).toFixed(2),
  penaltyShots: sum(r => r.penaltyShots || 0), penaltyGoals: sum(r => r.penaltyGoals || 0),
  headerShots: +(sum(r => r.headers || 0) / N).toFixed(2), woodwork: +(sum(r => r.frames || 0) / N).toFixed(2),
  goalsEnteringNet: sum(r => r.netGoals || 0), goalsTotal: sum(r => r.goals || 0),
  aerialSecondBalls: +(sum(r => r.aerialLoose || 0) / N).toFixed(2), longGoalKickShare: +(sum(r => r.longGoalKicks || 0) / Math.max(1, sum(r => (r.kinds && r.kinds.goalKick) || 0))).toFixed(3),
  endFitness: +(sum(r => r.fatigue || 0) / N).toFixed(1),
  firstCrash: (runs.find(r => r.crash) || {}).crash || null,
};
if (asJson) console.log(JSON.stringify(agg)); else console.log(agg);
