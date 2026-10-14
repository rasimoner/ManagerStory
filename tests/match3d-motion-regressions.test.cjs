const test=require('node:test'),assert=require('node:assert/strict');
// The verified base tree is the same locally and on GitHub.
const baseline='e0e112f00c351a8904133339d09eeb021e66764e';let cached;
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
async function matches(){if(cached)return cached;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cached=[1,8800].map(seed=>({seed,before:full(setup(true,baseline),seed),after:full(setup(),seed)}));}
test('motion changes preserve actual engine, RNG, career and half/final completion in two matches',async()=>{
 for(const m of await matches()){assert.equal(m.before.raw,m.after.raw);assert.equal(m.before.career,m.after.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);console.log(JSON.stringify({seed:m.seed,events:m.after.events.length,motorRngCareerEqual:true}));}
});
test('real contact velocity passes to off-ball motion instead of interim interpolation; invalid targets remain finite',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let peak=0,steps=0;
 for(const [seed,id] of [[1,15],[8800,26]]){const h=setup();seek(h,seed,id);
 const rows=h.run(`(()=>{const rows=[];for(let i=0;i<250;i++){ManagerStoryLive3D.step(.04,0);rows.push({t:ManagerStoryLive3D.time,p:structuredClone(pitchV73.positions),v:structuredClone(pitchV73.flowVelocity),f:MatchView.read()});}return rows})()`);
 for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],dt=b.t-a.t;if(dt<=0)continue;for(const [key,p] of Object.entries(b.p)){assert.ok(p.every(Number.isFinite));const speed=distance(a.p[key],p)/dt;peak=Math.max(peak,speed);assert.ok(speed<24.05,`${seed}/${id}/${key} velocity ${speed}`);const player=b.f.players.find(p=>String(p.id)===key);assert.ok(player);assert.ok(player.displayPosition.every(Number.isFinite));steps++;}}
 const invalid=h.run(`(()=>{const e=pitchV73.active,key=Object.keys(e.enginePositions).find(k=>k!==String(e.fromId)&&k!==String(e.toId));e.enginePositions[key]=[NaN,undefined];ManagerStoryLive3D.step(.016,0);return Object.values(pitchV73.positions).every(p=>p.every(Number.isFinite))})()`);assert.ok(invalid);
 h.run('pauseLive()');const before=h.run('JSON.stringify([pitchV73.positions,pitchV73.flowVelocity,pitchV73.ball,ManagerStoryLive3D.time])');h.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.flowVelocity,pitchV73.ball,ManagerStoryLive3D.time])'),before);
 }console.log(JSON.stringify({positionSteps:steps,peakSpeed:peak}));
});
test('contest time depends on real contact path, not unrelated settlement; normal carry starts without phase wait',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let directions=new Set(),carries=0;
 for(const m of await matches()){
 for(const sign of[-1,1]){const clip=m.after.clips.find(c=>c.contest&&Math.sign(c.contest.point[0]-c.contest.attackerStart[0])===sign);if(!clip)continue;const h=setup();seek(h,m.seed,clip.id);const timing=h.run('({actual:pitchV73.activeDuration,contact:ManagerStoryLive3D.contestTiming(pitchV73.active).total})');assert.ok(Math.abs(timing.actual-timing.contact)<1e-9);directions.add(sign);}
 const clip=m.after.clips.find(c=>['dribble','ballCarry','run'].includes(c.type)&&!c.contest&&!c.controlStart&&distance(c.from,c.to)>.5);assert.ok(clip);const h=setup();seek(h,m.seed,clip.id);const early=h.run(`(()=>{const e=pitchV73.active;while(pitchV73.active===e&&pitchV73.progress<.12)ManagerStoryLive3D.step(.008,0);return {from:e.fromPos,ball:pitchV73.ball,p:pitchV73.progress}})()`);assert.ok(distance(early.from,early.ball)>.001);carries++;
 for(const speed of [.5,1,2]){h.run(`setMatchSpeed(${speed})`);const before=h.run('ManagerStoryLive3D.time');h.run('ManagerStoryLive3D.step(.016,0)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-before-.016*speed/2)<1e-9);}
 }assert.equal(directions.size,2);console.log(JSON.stringify({directions:[...directions],normalCarries:carries,commonClockRatesPreserved:true}));
});
