const test=require('node:test'),assert=require('node:assert/strict');
const baseline='e52252adb94b5c9d6399e1bc303a08f7359f158b';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68),world=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let cache;
function capture(h){h.run(`(()=>{let clips=qaClips;Object.defineProperty(window,'qaClips',{get:()=>clips,set:v=>{clips=v;Object.defineProperty(v,'push',{value:function(c){c.distribution=structuredClone(pitchV73.active?.keeperDistribution||null);return Array.prototype.push.call(this,c);}});}});})()`);return h;}
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cache=[1,8800].map(seed=>({seed,before:full(capture(setup(true,baseline)),seed),after:full(capture(setup()),seed)}));}
async function examples(){const a=[];for(const dir of [-1,1]){const preferred=dir<0?8800:1;const matches=[...(await audit())].sort((a,b)=>(a.seed===preferred?-1:1));let selected;for(const m of matches){const c=m.after.clips.find(c=>c.distribution?.kind==='throw'&&Math.sign(c.to[0]-c.from[0])===dir);if(c){selected={seed:m.seed,c,dir,startId:m.after.clips.slice(0,m.after.clips.indexOf(c)).findLast(x=>x.id!=null).id};break;}}assert.ok(selected);a.push(selected);}return a;}
async function frames(x){const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const h=setup();seek(h,x.seed,x.startId??x.c.id);const fs=h.run(`(()=>{const a=[MatchView.read()];let started=false;for(let i=0;i<14000;i++){ManagerStoryLive3D.step(.002,0);a.push(MatchView.read());if(pitchV73.active?.eventId===${x.c.id})started=true;else if(started)break;}return a;})()`);return {h,fs};}
test('short arm presentation preserves engine/RNG/career, approved punts, save chains and field budgets',async()=>{
 for(const m of await audit()){
  assert.equal(m.after.raw,m.before.raw);assert.equal(m.after.career,m.before.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);
  const ids=m.after.clips.flatMap(c=>[...new Set([c.id,...c.linked,c.controlEvent?.eventId])]).filter(x=>x!=null);
  for(const e of m.after.events.filter(e=>['pass','cross','firstTouch','shot','save','looseBall','recovery'].includes(e.type)))assert.equal(ids.filter(x=>x===e.eventId).length,1);
  for(const c of m.after.clips){const old=m.before.clips.find(x=>x.id===c.id&&x.type===c.type);if(c.deliveryTiming)assert.deepEqual(c.deliveryTiming,old.deliveryTiming);if(c.type==='goalKick'||c.distribution?.kind==='punt'||c.result?.type==='save'){assert.equal(c.duration,old.duration);assert.deepEqual(c.from,old.from);assert.deepEqual(c.to,old.to);}}
  console.log(JSON.stringify({seed:m.seed,events:m.after.events.length,engineRngCareerEqual:true}));
 }
});
test('both goal directions keep ball on the moving right hand, then release in the arm direction and recover',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js'),T=await import('../dist/vendor/three/three.module.min.js');global.document={createElement:()=>({getContext:()=>({fillText(){}})})};let maxHandGap=0,paths=0,maxHandStep=0;
 for(const x of await examples()){
  const {fs}=await frames(x),sampler=createLivePoseSampler(),model=createFootballer({id:x.c.fromId,side:x.c.distribution.side,number:1,kit:{primaryColor:'#222222',secondaryColor:'#aaaaaa'},goalkeeper:true});let preEntry,old,first,lastHeld,firstFree,prepared=false,followed=false,idle=false,maxExcursion=0,heldFrames=0;
  for(const f of fs){const P=f.presentation,e=P.activeEvent,s=sampler(f);if(e?.eventId!==x.c.id){const pose=s.poses.find(p=>p.id===x.c.fromId);preEntry={hand:poseFootballer(model,pose).rightHand.toArray(),seconds:P.seconds};continue;}const d=e.keeperDistribution,t=d.handTiming,sec=P.clockProgress*P.duration,pose=s.poses.find(p=>p.id===x.c.fromId),rig=poseFootballer(model,pose),hand=rig.rightHand.toArray(),held=sec<t.releaseAt;
   if(!old&&preEntry)assert.ok(world(preEntry.hand,hand)<.04,'hand must inherit previous carried pose');
   assert.ok(world(pose.position,[(d.root[0]/100-.5)*105,0,(d.root[1]/100-.5)*68])<1e-8,'visible root stays fixed');first??=hand;maxExcursion=Math.max(maxExcursion,world(first,hand));assert.ok(Math.abs(pose.rightWristPitch)<=.120001);
   const b=model.userData.bones,elbow=model.worldToLocal(b.rightElbow.getWorldPosition(new T.Vector3()));assert.ok(elbow.x>.02,'throwing elbow bends outward');
   if(held){assert.ok(P.keeperControl);assert.equal(f.ball.displayOwnerId,x.c.fromId);const gap=world(hand,s.ball);maxHandGap=Math.max(maxHandGap,gap);assert.ok(gap<.08,`moving hand contact ${gap} ${x.seed}/${x.c.id}`);lastHeld={ball:s.ball,hand,sec};heldFrames++;}
   else {assert.equal(P.keeperControl,null);if(P.progress<.76)assert.equal(f.ball.displayOwnerId,null);firstFree??={ball:s.ball,hand,sec};}
   if(d.handMotion.phase==='hand-prepare')prepared=true;if(d.handMotion.phase==='hand-follow')followed=true;if(d.handMotion.phase==='hand-idle')idle=true;
   if(old){const step=world(old.hand,hand);maxHandStep=Math.max(maxHandStep,step);assert.ok(step<.04,`hand continuity ${step}`);if(!held&&old.held){assert.ok(world(old.ball,s.ball)<.10,'no ball jump at release');assert.ok(world(hand,old.hand)<.04,'no hand reset at release');}}
   old={hand,ball:s.ball,held};
  }
  assert.ok(prepared&&followed&&idle&&heldFrames>20&&maxExcursion>.25&&firstFree&&lastHeld);
  const a=firstFree.ball.map((v,i)=>v-lastHeld.ball[i]),d=x.c.to.map((v,i)=>v-x.c.distribution.release[i]),u=[d[0]*1.05,0,d[1]*.68];assert.ok((a[0]*u[0]+a[2]*u[2])/Math.hypot(a[0],a[2])/Math.hypot(u[0],u[2])>.99,'first flight agrees with throw direction');
  paths++;console.log(JSON.stringify({seed:x.seed,event:x.c.id,direction:x.dir,handExcursion:maxExcursion,heldFrames}));
 }console.log(JSON.stringify({handThrowPaths:paths,maxHandGap,maxHandStep}));
});
test('hand release is identical on the common clock with pause/view switches and delayed frames',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let paths=0;
 for(const x of await examples()){
  const a=setup(),b=setup();seek(a,x.seed,x.c.id);seek(b,x.seed,x.c.id);const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.displayBallHeight,pitchV73.carrier,pitchV73.keeperControl,pitchV73.active,pitchV73.progress,M.events,M.rand.state])';
  a.run('pauseLive()');const frozen=a.run(state);a.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(a.run(state),frozen);a.run('resumeLive()');
  for(let i=0;i<100;i++){const dt=i%3===0?.016:.12;a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${dt===.12?2:dt},0)`);assert.equal(a.run(state),b.run(state));}paths++;
 }console.log(JSON.stringify({normalDelayedHandThrows:paths,pauseViewsPreserved:true}));
});
