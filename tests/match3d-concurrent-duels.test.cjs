const test=require('node:test'),assert=require('node:assert/strict');
const baseline='9610d53b78ab866d52e2dd76f65677713cccd0d5';
const dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
const visible=(clip,stage,id)=>clip[stage+'Positions'][id].map((v,i)=>v+(clip[stage+'Offsets']?.[id]?.[i]||0));
let cache;
async function audit(){
 if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');
 cache=[1,8800].map(seed=>{const old=setup(true,baseline),h=setup();h.run('window.qaMatchRef=M');const before=full(old,seed),after=full(h,seed);h.run('M=qaMatchRef');return {seed,h,before,after};});return cache;
}
test('real successes/failures in both attack directions combine preceding carrier motion with challenge; no source arrival replay',async()=>{
 const coverage=new Set();let folded=0,duels=0,movingFolded=0;
 for(const {seed,h,after} of await audit())for(let i=0;i<after.clips.length;i++){
  const clip=after.clips[i],c=clip.contest;if(!c)continue;duels++;
  const direction=(c.attackerSide==='user'?1:-1)*(c.press.minute>45?-1:1),result=c.attackerKeepsBall?'keeps':'gain',kind=c.independent?'independent':'dribble';coverage.add(`${kind}/${result}/${direction}`);
  const prev=after.clips[i-1];assert.equal(clip.contestStartSource,'visible-roots; shared-approach-clock');
  for(const [id,start] of [[c.attackerId,c.attackerStart],[c.defenderId,c.defenderStart]]){assert.ok(dist(start,visible(clip,'start',String(id)))<1e-8);if(prev&&clip.type!=='kickoff')assert.ok(dist(start,visible(prev,'end',String(id)))<1e-8,`${seed}/${clip.id} visible start`);}
  if(clip.approachSample){folded++;if(dist(c.attackerStart,c.point)>.001)movingFolded++;assert.ok(!prev||prev.gameSecond!==c.press.gameSecond||prev.movementSource!=='derived-between-minute-position-samples'||prev.contest,`${seed}/${clip.id} preceding motion not replayed`);}
 }
 for(const kind of ['independent','dribble'])for(const result of ['keeps','gain'])for(const direction of [-1,1])assert.ok(coverage.has(`${kind}/${result}/${direction}`),`missing ${kind}/${result}/${direction}`);
 assert.ok(folded>0&&movingFolded>0);console.log(JSON.stringify({duels,foldedCarrierSamples:folded,movingFoldedSamples:movingFolded,coverage:[...coverage].sort()}));
});
test('whole approach/contact/recovery has concurrent roots, bounded speed and clearance; genuine stationary sources stay still',async()=>{
 let moving=0,stationary=0,maxSpeed=0,minGap=Infinity;
 for(const {seed,h,after} of await audit())for(const clip of after.clips.filter(c=>c.contest)){
  const c=clip.contest;h.run(`M.secondHalf=${c.press.minute>45};window.qaEvent=${JSON.stringify({contest:c})}`);
  const r=h.run(`(()=>{const e=qaEvent,t=ManagerStoryLive3D.contestTiming(e),D=${clip.duration},distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68),moving=distance(e.contest.attackerStart,e.contest.point)>1e-8;let max=0,min=Infinity,joint=0,zero=0;
   for(let k=1;k<t.boundaries.length;k++){const pose=t.poseBoundaries;let old=ManagerStoryLive3D.contestFrame(e,pose[k-1]);for(let i=1;i<=250;i++){const f=ManagerStoryLive3D.contestFrame(e,pose[k-1]+(pose[k]-pose[k-1])*i/250),dt=(t.boundaries[k]-t.boundaries[k-1])*D/250,va=distance(old.attacker,f.attacker)/dt,vd=distance(old.defender,f.defender)/dt;max=Math.max(max,va,vd);min=Math.min(min,f.clearance);if(k<=3){if(va>.001&&vd>.001)joint++;if(moving&&va<=1e-7)zero++;}old=f;}}
   return {max,min,joint,zero,moving,start:ManagerStoryLive3D.contestFrame(e,0),contact:ManagerStoryLive3D.contestFrame(e,.76),end:ManagerStoryLive3D.contestFrame(e,1)};})()`);
  assert.ok(r.max<=6.003,`${seed}/${clip.id} root speed ${r.max}`);maxSpeed=Math.max(maxSpeed,r.max);minGap=Math.min(minGap,r.min);
  assert.ok(r.min>=Math.min(.61999,r.start.clearance)-1e-7,`${seed}/${clip.id} clearance ${r.min}/${r.start.clearance}`);
  assert.ok(dist(r.contact.attacker,c.point)<1e-8);assert.ok(r.end.clearance>=.61999);
  if(r.moving){moving++;assert.equal(r.zero,0,`${seed}/${clip.id} carrier waits within moving approach`);assert.ok(r.joint>=730,`${seed}/${clip.id} concurrent samples ${r.joint}`);}else {stationary++;assert.ok(dist(r.start.attacker,r.contact.attacker)<1e-8);}
  if(!c.attackerKeepsBall)assert.ok(dist(r.end.defender,c.defenderEnd)<1e-8);
 }
 console.log(JSON.stringify({moving,stationary,maxClipRootSpeed:maxSpeed,minClearance:minGap}));assert.ok(moving>0);
});
test('winner ownership changes at visible contact and both actors continue from the same displayed endpoint; engine/RNG/career unchanged',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const cases=[];
 for(const {seed,before,after} of await audit()){
  assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.finished&&!after.pending&&after.singleResult);assert.equal(after.events.filter(e=>e.type==='end').length,1);
  const ids=after.clips.flatMap(c=>[...new Set([c.id,...c.linked])]).filter(id=>id!=null);for(const e of after.events.filter(e=>['dribble','press','tackle','interception'].includes(e.type)))assert.equal(ids.filter(id=>id===e.eventId).length,1,`${seed}/${e.eventId} represented once`);
  for(let i=0;i<after.clips.length-1;i++){const a=after.clips[i],b=after.clips[i+1];if(!a.contest||b.type==='kickoff')continue;assert.ok(dist(a.endBall,b.startBall)<1e-8);for(const id of [a.contest.attackerId,a.contest.defenderId])assert.ok(dist(visible(a,'end',String(id)),visible(b,'start',String(id)))<1e-8,`${seed}/${a.id} next visible root`);assert.equal(a.endOwner,a.contest.attackerKeepsBall?a.contest.attackerId:a.contest.defenderId);
   const key=[a.contest.independent?'independent':'dribble',a.contest.attackerKeepsBall?'keeps':'gain',a.contest.press.minute>45?'second':'first'].join('/');if(!cases.some(x=>x.key===key))cases.push({seed,id:a.id,key});
  }
  console.log(JSON.stringify({seed,engineEvents:after.events.length,engineRngStatsCareerEqual:true,oneResult:true,beforeSeconds:before.wall,afterSeconds:after.wall}));
 }
 for(const {seed,id} of cases){const h=setup();seek(h,seed,id);const c=h.run('structuredClone(pitchV73.active.contest)');for(const target of [.75999,.76,.91]){h.run(`for(let i=0;i<20000&&pitchV73.active?.eventId===${id}&&pitchV73.contestMotion.progress<${target}-1e-10;i++){const clock=ManagerStoryLive3D.contestTiming(pitchV73.active),pose=clock.poseBoundaries;let want=1;for(let k=1;k<pose.length;k++)if(${target}<=pose[k]){want=clock.boundaries[k-1]+(${target}-pose[k-1])/(pose[k]-pose[k-1])*(clock.boundaries[k]-clock.boundaries[k-1]);break;}ManagerStoryLive3D.step(Math.min(.01,(want-pitchV73.progress)*pitchV73.activeDuration/matchPlaybackRate()),0);}`);assert.equal(h.run('pitchV73.carrier'),target<.76||c.attackerKeepsBall?c.attackerId:c.defenderId);}}
});
test('pause/view switches and all UI speeds retain the same shared roots, ball and half-rate delta during approach/contact/recovery',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),examples=(await audit()).flatMap(m=>m.after.clips.filter(c=>c.contest).map(c=>({seed:m.seed,id:c.id,keeps:c.contest.attackerKeepsBall}))),chosen=[examples.find(c=>c.keeps),examples.find(c=>!c.keeps)];
 for(const e of chosen)for(const speed of [.5,1,2]){const h=setup();seek(h,e.seed,e.id);h.run(`setMatchSpeed(${speed})`);for(const stage of [.3,.8,.95]){h.run(`for(let i=0;i<20000&&pitchV73.active?.eventId===${e.id}&&pitchV73.contestMotion.progress<${stage};i++)ManagerStoryLive3D.step(.002,0);pauseLive()`);const frozen=h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,M.events,M.rand.state,ManagerStoryLive3D.time])');h.run('setMatchView("2d");ManagerStoryLive3D.step(.12,0);setMatchView("3d")');assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,M.events,M.rand.state,ManagerStoryLive3D.time])'),frozen);h.run('resumeLive()');const t=h.run('ManagerStoryLive3D.time');h.run('ManagerStoryLive3D.step(.001,0)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-t-.001*speed/2)<1e-9);}}
});

test('first gap and real pass/run after a duel use visible distance budgets without catch-up acceleration',async()=>{
 let continuations=0,maxSpeed=0;const kinds=new Set();
 for(const {seed,after} of await audit())for(const clip of after.clips.filter(c=>c.duelContinuationIds)){
  continuations++;kinds.add(clip.type);for(const id of clip.duelContinuationIds){const key=String(id);if(!clip.startPositions[key]||!clip.endPositions[key])continue;
   const fraction=['dribble','ballCarry','run'].includes(clip.type)&&id===clip.fromId ? .57 : ['pass','cross'].includes(clip.type)&&id===clip.fromId ? .19 : ['pass','cross'].includes(clip.type)&&id===clip.toId ? .76 : 1;
   const peak=dist(visible(clip,'start',key),visible(clip,'end',key))*1.5/clip.duration/fraction;maxSpeed=Math.max(maxSpeed,peak);assert.ok(peak<=6.003,`${seed}/${clip.id} ${clip.type} next-root speed ${peak}`);
  }
 }assert.ok(continuations>0&&kinds.has('enginePositionGap')&&kinds.has('pass')&&kinds.has('ballCarry'));console.log(JSON.stringify({continuations,kinds:[...kinds],maxContinuationClipSpeed:maxSpeed}));
});
