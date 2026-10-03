#!/usr/bin/env node
/* Phase 2 statistical report. usage: node tools/attribute-report.cjs [matchesPerArm=30] [--json]
   Part A: controlled player pairs, identical seeded scenarios (same functions the engine calls).
   Part B: integrated full-match experiment: whole user squad +12 vs -12 on every skill attribute. */
const { harness, playToEnd } = require('../tests/engine-harness.cjs');
const arm = Number(process.argv[2]) || 30;
const asJson = process.argv.includes('--json');
const NEUTRAL = { pace: 65, acceleration: 65, finishing: 65, passing: 65, dribbling: 65, technique: 65, tackling: 65, positioning: 65,
  vision: 65, offBall: 65, composure: 65, strength: 65, physical: 65, stamina: 70, fitness: 100, age: 26 };
const fresh = (f = 0) => { const h = harness(); h.run(`S=fresh();init();S.fixture=${f};startMatch();resumeLive()`); return h; };
const user = (h, slot, role, a = {}) => {
  const id = h.run(`M.active.filter(id=>M.matchRoles[id]!=='GK')[${slot}]`);
  h.run(`(function(){const p=S.players.find(x=>x.id===${id});Object.assign(p,${JSON.stringify({ ...NEUTRAL, ...a })});p.pos=${JSON.stringify(role)};M.matchRoles[${id}]=${JSON.stringify(role)}})()`);
  return id;
};
const opp = (h, i, a = {}) => { const id = 'o' + i; h.run(`Object.assign(opponentPlayer(${JSON.stringify(id)}),${JSON.stringify({ ...NEUTRAL, shooting: a.finishing ?? 65, ...a })})`); return id; };
const race = (h, a, b, da, db, n = 400, seed = 4100) => h.run(`(function(){let A=0,B=0;for(let t=0;t<${n};t++){M.rand=R(${seed}+t);M.looseBall=null;M.ballOwner=null;M.ballSide='none';
  for(const id of M.active)M.dynamicPositions[String(id)]=[5,8];for(const id of M.oppIds)M.dynamicPositions[String(id)]=[95,92];
  M.dynamicPositions[String(${JSON.stringify(a)})]=[${50 - da},50];M.dynamicPositions[String(${JSON.stringify(b)})]=[${50 + db},50];
  makeLooseBall([50,50],[50,50],'r',null);for(let g=0;M.ballOwner==null&&g<6;g++)resolveLooseBall(8);
  if(M.ballOwner===${JSON.stringify(a)})A++;else if(M.ballOwner===${JSON.stringify(b)})B++}return [A,B]})()`);
const pct = (x, n) => +(100 * x / n).toFixed(1);
const out = { controlled: {}, integrated: {} };

// ---- Part A
{
  const one = (aa, ba, da, db) => { const h = fresh(); const a = user(h, 4, 'CM', aa), b = opp(h, 6, ba); return race(h, a, b, da, db); };
  let r = one({ pace: 90 }, { pace: 50 }, 30, 30); out.controlled['Pace 90 vs 50, 30 units (loose-ball race wins)'] = `${r[0]}/400 vs ${r[1]}/400 (${pct(r[0], 400)}%)`;
  r = one({ pace: 71 }, { pace: 69 }, 30, 30); out.controlled['Pace 71 vs 69, 30 units (close race)'] = `${r[0]}/400 vs ${r[1]}/400 (${pct(r[0], 400)}%)`;
  r = one({ acceleration: 92, pace: 62 }, { acceleration: 45, pace: 62 }, 5, 5); out.controlled['Accel 92 vs 45, 5 units'] = `${r[0]}/400 vs ${r[1]}/400 (${pct(r[0], 400)}%)`;
  r = one({ acceleration: 92, pace: 62 }, { acceleration: 50, pace: 92 }, 5, 5); out.controlled['High-accel/avg-pace vs high-pace/avg-accel, 5 units'] = `${r[0]} vs ${r[1]} of 400`;
  r = one({ acceleration: 92, pace: 62 }, { acceleration: 50, pace: 92 }, 40, 40); out.controlled['  same pair, 40 units'] = `${r[0]} vs ${r[1]} of 400`;
  r = one({ strength: 92 }, { strength: 45 }, 1.2, 1.2); out.controlled['Strength 92 vs 45, dead-heat ball (wins)'] = `${r[0]}/400 vs ${r[1]}/400`;

  const h = fresh();
  const hi = user(h, 2, 'CM', { passing: 90 }), lo = user(h, 3, 'CM', { passing: 50 });
  const rate = (id, sel, pr) => h.run(`(function(){M.rand=R(77);let ok=0,n=5000;for(let i=0;i<n;i++)if(M.rand()<passSuccessProbability(${id},'user',${sel},{pressure:${pr}}))ok++;return ok/n})()`);
  const easy = '{range:12,lane:0,space:{danger:.1}}', hard = '{range:48,lane:.6,space:{danger:.8}}';
  out.controlled['Passing 90 vs 50, easy pass'] = `${pct(rate(hi, easy, .1), 1)}% vs ${pct(rate(lo, easy, .1), 1)}%`;
  out.controlled['Passing 90 vs 50, difficult pass'] = `${pct(rate(hi, hard, .5), 1)}% vs ${pct(rate(lo, hard, .5), 1)}%`;

  const vis = v => { const g = fresh(1); const c = user(g, 3, 'CM', { vision: v }); const others = g.run('M.active.filter(id=>M.matchRoles[id]!=="GK")').filter(i => i !== c);
    const spots = [[40, 56], [41, 44], [70, 35], [72, 52], [68, 65], [30, 50], [32, 30], [32, 70], [20, 50]];
    g.run(`for(const id of M.oppIds)M.dynamicPositions[String(id)]=[92,50];M.dynamicPositions[String(${c})]=[46,50]`);
    others.forEach((id, i) => g.run(`M.dynamicPositions[String(${id})]=${JSON.stringify(spots[i % 9])}`));
    return g.run(`(function(){M.rand=R(2024);let p=0,n=4000;for(let i=0;i<n;i++)if(weightedPitchChoice(passOptions('user',${c},'Normal')).progress>12)p++;return p/n})()`); };
  out.controlled['Vision 92 vs 42, share of progressive pass choices'] = `${pct(vis(92), 1)}% vs ${pct(vis(42), 1)}%`;

  const fh = user(h, 7, 'ST', { finishing: 92 }), fl = user(h, 8, 'ST', { finishing: 48 });
  const conv = (id, c) => h.run(`(function(){M.rand=R(314);let g=0,n=20000,c=${JSON.stringify(c)};for(let i=0;i<n;i++){const s=shotProbabilities(${id},'user',c);if(M.rand()<s.onTarget&&M.rand()<s.goal)g++}return g/n})()`);
  const typical = { distance: 18, angle: 8, pressure: .5, keeper: 70 }, easyC = { distance: 6, angle: 0, pressure: 0, keeper: 70 }, hardC = { distance: 28, angle: 20, pressure: 1, keeper: 70 };
  out.controlled['Finishing 92 vs 48, typical chance conversion'] = `${pct(conv(fh, typical), 1)}% vs ${pct(conv(fl, typical), 1)}%`;
  out.controlled['Finishing 92 vs 48, easy chance conversion'] = `${pct(conv(fh, easyC), 1)}% vs ${pct(conv(fl, easyC), 1)}%`;
  out.controlled['Finishing 92 vs 48, hard chance conversion'] = `${pct(conv(fh, hardC), 1)}% vs ${pct(conv(fl, hardC), 1)}%`;

  const dh = user(h, 5, 'LW', { dribbling: 90, technique: 85 }), dl = user(h, 6, 'LW', { dribbling: 48, technique: 50 });
  const def = opp(h, 5), wall = opp(h, 4, { tackling: 92, positioning: 90, strength: 85, acceleration: 80 });
  const dr = (id, d) => h.run(`(function(){M.rand=R(55);let ok=0,n=5000;for(let i=0;i<n;i++)if(M.rand()<dribbleChance(${id},'user',${JSON.stringify(d)},'opp',{pressure:.5}))ok++;return ok/n})()`);
  out.controlled['Dribbling 90 vs 48 against an average defender (beats him)'] = `${pct(dr(dh, def), 1)}% vs ${pct(dr(dl, def), 1)}%`;
  out.controlled['Dribbling 90 against an elite defender'] = `${pct(dr(dh, wall), 1)}%`;

  const car = user(h, 5, 'LW', { dribbling: 70 }), great = opp(h, 3, { tackling: 90, positioning: 80 }), poor = opp(h, 2, { tackling: 45, positioning: 50 });
  const tk = id => h.run(`(function(){M.rand=R(9);let ok=0,n=5000;for(let i=0;i<n;i++)if(M.rand()<tackleChance(${JSON.stringify(id)},'opp',${car},'user',{distance:6}))ok++;return ok/n})()`);
  out.controlled['Tackling 90 vs 45, duel won cleanly'] = `${pct(tk(great), 1)}% vs ${pct(tk(poor), 1)}%`;

  const fit = h.run('(function(){const out={};for(const f of [100,85,70,50,30]){S.players.find(p=>p.id===' + fh + ').fitness=f;out[f]=[effectiveAttribute(' + fh + ',"user","pace",65).toFixed(1),effectiveAttribute(' + fh + ',"user","passing",65).toFixed(1),effectiveAttribute(' + fh + ',"user","vision",65).toFixed(1)].join("/")}return out})()');
  out.controlled['Effective pace/passing/vision at fitness 100,85,70,50,30 (base 65)'] = JSON.stringify(fit);
}

// ---- Part B: integrated experiment, same fixtures, squad +12 vs -12
function armRun(delta) {
  const tot = { n: 0, goals: 0, conceded: 0, shots: 0, ont: 0, passes: 0, cp: 0, poss: 0, posst: 0, dr: 0, drw: 0, xg: 0, tk: 0 };
  for (let i = 0; i < arm; i++) {
    const h = harness(); h.run(`S=fresh();init();S.fixture=${i % 34};`);
    h.run(`for(const p of S.players)for(const k of ['pace','finishing','passing','dribbling','defending','physical','stamina'])p[k]=Math.max(25,Math.min(99,p[k]+${delta}));startMatch();resumeLive()`);
    playToEnd(h);
    const s = h.run('({hg:M.hg,ag:M.ag,u:userSide(),st:M.stats,sh:M.shots,ont:M.ont,pt:[M.userPossTicks,M.oppPossTicks],dr:Object.values(M.playerStats).reduce((n,s)=>n+s.dribblesAttempted,0),drw:Object.values(M.playerStats).reduce((n,s)=>n+s.dribbles,0)})');
    const u = s.u, o = 1 - u;
    tot.n++; tot.goals += u === 0 ? s.hg : s.ag; tot.conceded += u === 0 ? s.ag : s.hg;
    tot.shots += s.sh[u]; tot.ont += s.ont[u]; tot.passes += s.st.passes[u]; tot.cp += s.st.completedPasses[u];
    tot.poss += s.pt[0]; tot.posst += s.pt[0] + s.pt[1]; tot.dr += s.dr; tot.drw += s.drw; tot.xg += s.st.xg[u]; tot.tk += s.st.tackles[u];
  }
  return { goalsFor: +(tot.goals / tot.n).toFixed(2), goalsAgainst: +(tot.conceded / tot.n).toFixed(2), shots: +(tot.shots / tot.n).toFixed(1), onTarget: +(tot.ont / tot.shots).toFixed(3),
    xg: +(tot.xg / tot.n).toFixed(2), passCompletion: +(tot.cp / tot.passes).toFixed(3), possession: +(tot.poss / tot.posst).toFixed(3), dribbleSuccess: +(tot.drw / Math.max(1, tot.dr)).toFixed(3), tackles: +(tot.tk / tot.n).toFixed(1) };
}
out.integrated[`squad -12 (${arm} matches)`] = armRun(-12);
out.integrated[`squad +12 (${arm} matches)`] = armRun(12);

if (asJson) console.log(JSON.stringify(out)); else { console.log('=== A. Controlled pairs ==='); for (const [k, v] of Object.entries(out.controlled)) console.log(k.padEnd(68), v); console.log('\n=== B. Integrated (user squad, all skill attributes +/-12, same fixtures) ==='); for (const [k, v] of Object.entries(out.integrated)) console.log(k, JSON.stringify(v)); }
