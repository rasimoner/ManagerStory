#!/usr/bin/env node
/* V7.9.5 squad-profile report: full matches through the real loop, football numbers per match and who
   does what by position group (does a centre-back score like a striker? does a winger dribble more than
   a stopper?). usage: node tools/squad-report.cjs [matches=34] [first=0] [--json]
   Fixtures run in order from `first`, one per match (fixture = index % 34; each further lap of 34 uses a
   new fixed match salt). */
const { harness, playToEnd } = require('../tests/engine-harness.cjs');
const N = Number(process.argv[2]) || 34, FIRST = Number(process.argv[3]) || 0;
const asJson = process.argv.includes('--json');
const PROBE = `(function(){
 const grp=r=>{r=String(r||'').split('/')[0];return ['CB','LB','RB'].includes(r)?'DEF':r==='GK'?'GK':['LW','RW','ST','CF'].includes(r)?'ATT':'MID'};
 const roleOf=(id,side)=>side==='user'||typeof id==='number'?M.matchRoles?.[id]||S.players.find(p=>p.id===id)?.pos:opponentPlayer(id)?.position;
 const by={};const add=(k,g)=>{by[k]??={GK:0,DEF:0,MID:0,ATT:0};by[k][g]++};
 let shots=0,onT=0,heads=0,crosses=0,drib=0,dribOk=0,goals=[0,0];
 for(const e of M.events){
  if(e.type==='shot'){shots++;if(e.onTarget)onT++;if(e.header)heads++;const g=grp(roleOf(e.playerId??e.fromId,e.fromSide));add('shots',g);if(e.outcome==='goal')add('goals',g)}
  if(e.type==='cross')crosses++;
  if(e.type==='dribble'){drib++;if(e.success)dribOk++;add('dribbles',grp(roleOf(e.playerId??e.fromId,e.fromSide)))}
  if(e.type==='tackle'&&e.defenderId!=null)add('tackles',grp(roleOf(e.defenderId,e.fromSide==='user'?'opp':'user')));
 }
 const st=M.stats,us=M.userHome?0:1,them=1-us;
 return JSON.stringify({score:[M.hg,M.ag],userGoals:us===0?M.hg:M.ag,oppGoals:us===0?M.ag:M.hg,shots,onT,heads,crosses,drib,dribOk,
  passes:st.passes[0]+st.passes[1],done:st.completedPasses[0]+st.completedPasses[1],tackles:st.tackles[0]+st.tackles[1],fouls:st.fouls[0]+st.fouls[1],
  xg:st.xg[0]+st.xg[1],corners:st.corners[0]+st.corners[1],by});
})()`;
const rows = [];
for (let i = FIRST; i < FIRST + N; i++) {
  const h = harness();
  // matches past the first 34 replay the fixtures with another fixed salt (deterministic, but new matches)
  const salt = Math.floor(i / 34) * 100003;
  h.run(`S=fresh();init();S.fixture=${i % 34};${salt ? `newMatchSalt=()=>${salt};S.matchSalt=${salt};` : ''}startMatch();`);
  playToEnd(h);
  rows.push(JSON.parse(h.run(PROBE)));
}
const sum = f => rows.reduce((s, r) => s + f(r), 0), per = f => +(sum(f) / rows.length).toFixed(2);
const share = k => { const t = { GK: 0, DEF: 0, MID: 0, ATT: 0 }; rows.forEach(r => { for (const g in t) t[g] += r.by[k]?.[g] || 0 }); const n = Object.values(t).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(t).map(([g, v]) => [g, +(100 * v / n).toFixed(1)])) };
const out = {
  matches: rows.length, goals: per(r => r.score[0] + r.score[1]), userGoals: per(r => r.userGoals), oppGoals: per(r => r.oppGoals),
  userPoints: per(r => r.userGoals > r.oppGoals ? 3 : r.userGoals === r.oppGoals ? 1 : 0),
  shots: per(r => r.shots), onTargetPct: +(100 * sum(r => r.onT) / Math.max(1, sum(r => r.shots))).toFixed(1), headers: per(r => r.heads),
  crosses: per(r => r.crosses), xg: per(r => r.xg), corners: per(r => r.corners), passes: per(r => r.passes),
  passPct: +(100 * sum(r => r.done) / Math.max(1, sum(r => r.passes))).toFixed(1), dribbles: per(r => r.drib),
  dribblePct: +(100 * sum(r => r.dribOk) / Math.max(1, sum(r => r.drib))).toFixed(1), tackles: per(r => r.tackles), fouls: per(r => r.fouls),
  goalShare: share('goals'), shotShare: share('shots'), dribbleShare: share('dribbles'), tackleShare: share('tackles'),
};
if (asJson) console.log(JSON.stringify({ out, rows }));
else for (const [k, v] of Object.entries(out)) console.log(k.padEnd(13), typeof v === 'object' ? JSON.stringify(v) : v);
