const test=require('node:test'),assert=require('node:assert/strict');
const baseline='f03782ddfb8d1b3bfaf7c86908a1ca21a978b0d9';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
async function restart(type,side){const {setup}=await import('../tools/match3d-round2-audit.mjs');const h=setup();h.run(`pitchV73.active=null;pitchV73.queue=[];pitchV73.batchEnd=null;M.rand=R(42);runRestart('${type}','${side}',[52,50]);`);return h;}
function tick(h,dt=.01){h.run(`qaWall+=${dt};ManagerStoryLive3D.step(${dt},qaWall*1000);`);return h.run('MatchView.read()');}
function find(h,predicate){for(let i=0;i<5000;i++){const s=tick(h);if(predicate(s))return s;}throw Error('missing target phase');}
function at(h,p){h.run(`{let left=(${p}-pitchV73.progress)*pitchV73.activeDuration/matchPlaybackRate();while(left>1e-10){const d=Math.min(.01,left);qaWall+=d;ManagerStoryLive3D.step(d,qaWall*1000);left-=d;}}`);return h.run('MatchView.read()');}
test('free kicks: both teams keep metric clearance, actual taker, stationary ball until toe contact',async()=>{
 const {toeGap}=await import('../tools/match3d-restart-chain-audit.mjs');
 for(const side of ['user','opp']){const h=await restart('FREE_KICK',side);h.run('pitchV73.visualOffsets=Object.fromEntries([...M.active,...M.oppIds].map(id=>[String(id),[.6,.4]]))');const start=find(h,s=>s.presentation.activeEvent?.type==='freeKick'),e=start.presentation.activeEvent;
 for(const p of start.players.filter(x=>x.side!==side))assert.ok(distance(p.displayPosition,e.fromPos)>=9.15-1e-7);
 const before=at(h,.18),contact=at(h,.19),after=at(h,.21);assert.deepEqual(before.ball.displayPosition,e.fromPos);assert.deepEqual(contact.ball.displayPosition,e.fromPos);assert.ok(distance(after.ball.displayPosition,e.fromPos)>0);assert.ok(toeGap(contact,e.fromId)<.23);assert.equal(e.engineFromPos[0],52);
 }
});
test('penalties: 11m spot, line keeper, approach and stationary pre-contact ball in both directions',async()=>{
 const {toeGap}=await import('../tools/match3d-restart-chain-audit.mjs');
 for(const side of ['user','opp']){const h=await restart('PENALTY',side);const s=find(h,s=>s.presentation.activeEvent?.type==='shot'),e=s.presentation.activeEvent,dir=e.toPos[0]>50?1:-1;
 assert.ok(Math.abs(Math.abs((e.fromPos[0]-(dir>0?100:0))*1.05)-11)<1e-8);assert.ok(Math.abs(e.keeperStart[0]-(dir>0?100:0))<1e-8);
 const a=at(h,.05),b=at(h,.18),c=at(h,.19);assert.deepEqual(a.ball.displayPosition,e.fromPos);assert.deepEqual(b.ball.displayPosition,e.fromPos);assert.ok(distance(a.players.find(p=>p.id===e.fromId).displayPosition,b.players.find(p=>p.id===e.fromId).displayPosition)>.5);assert.ok(toeGap(c,e.fromId)<.23);assert.ok(c.presentation.shotMotion.penaltyAttempt);
 }
});
test('stronger net flex follows impact, damps in both directions and leaves goal mouth fixed',async()=>{
 const {netDisplacement}=await import('../dist/match3d-net.js');for(const dir of [-1,1]){const hit={dir,point:[dir*54.8,.15,.2],seconds:3};assert.equal(netDisplacement(hit.point,hit,3,dir),0);assert.ok(Math.abs(netDisplacement(hit.point,hit,3.07,dir))>.15);assert.ok(Math.abs(netDisplacement(hit.point,hit,4,dir))<.01);assert.equal(netDisplacement([dir*52.5,1,.2],hit,3.07,dir),0);assert.equal(netDisplacement(hit.point,hit,3.07,-dir),0);}
});
test('two complete real matches preserve engine, RNG, career and one result application',async()=>{
 const {setup,full}=await import('../tools/match3d-round2-audit.mjs');for(const seed of [1,8800]){const before=full(setup(true,baseline),seed),after=full(setup(),seed);assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.finished&&!after.pending&&after.singleResult);console.log('deterministic',seed,after.events.length);}
});
