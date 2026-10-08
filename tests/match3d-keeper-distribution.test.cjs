const test=require('node:test'),assert=require('node:assert/strict');
const baseline='6b38498298454ee217c84b7a70b59d1a60767679';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68),world=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let cache;
function capture(h){h.run(`(()=>{let clips=qaClips;Object.defineProperty(window,'qaClips',{get:()=>clips,set:v=>{clips=v;Object.defineProperty(v,'push',{value:function(c){c.distribution=structuredClone(pitchV73.active?.keeperDistribution||null);return Array.prototype.push.call(this,c);}});}});})()`);return h;}
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cache=[1,8800].map(seed=>({seed,before:full(capture(setup(true,baseline)),seed),after:full(capture(setup()),seed)}));}
async function examples(){const a=[];for(const m of await audit())for(const c of m.after.clips.filter(c=>c.distribution)){const dir=Math.sign(c.to[0]-c.from[0]),kind=c.distribution.kind;if(!a.some(x=>x.dir===dir&&x.kind===kind))a.push({seed:m.seed,c,dir,kind});}for(const kind of ['throw','punt'])for(const dir of [-1,1])assert.ok(a.some(x=>x.kind===kind&&x.dir===dir),kind+'/'+dir);return a;}
async function frames(x){const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const h=setup();seek(h,x.seed,x.c.id);const fs=h.run(`(()=>{const a=[MatchView.read()];for(let i=0;i<14000;i++){ManagerStoryLive3D.step(.002,0);a.push(MatchView.read());if(pitchV73.active?.eventId!==${x.c.id})break;}return a;})()`);return {h,fs};}
test('held distribution changes no real engine output, event identity, field tempo or grounded goal kick',async()=>{
 for(const m of await audit()){
  assert.equal(m.after.raw,m.before.raw);assert.equal(m.after.career,m.before.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);
  const ids=m.after.clips.flatMap(c=>[...new Set([c.id,...c.linked,c.controlEvent?.eventId])]).filter(x=>x!=null);
  for(const e of m.after.events.filter(e=>['pass','cross','firstTouch','shot','save','looseBall','recovery'].includes(e.type)))assert.equal(ids.filter(x=>x===e.eventId).length,1);
  for(const c of m.after.clips.filter(c=>c.deliveryTiming))assert.deepEqual(c.deliveryTiming,m.before.clips.find(x=>x.id===c.id).deliveryTiming);
  for(const c of m.after.clips.filter(c=>c.type==='goalKick')){const old=m.before.clips.find(x=>x.id===c.id);assert.equal(c.distribution,null);assert.equal(c.duration,old.duration);assert.deepEqual(c.runUp,old.runUp);}
  for(const c of m.after.clips.filter(c=>c.distribution?.kind==='throw')){assert.ok(!c.distribution.timing);assert.equal(c.distribution.height,1.05);}
  console.log(JSON.stringify({seed:m.seed,events:m.after.events.length,engineRngCareerEqual:true,distributions:m.after.clips.filter(c=>c.distribution).length,groundedGoalKicks:m.after.clips.filter(c=>c.type==='goalKick').length}));
 }
});
test('both goals retain short hand release and long hand-drop-boot-flight order with actual model contact',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js');global.document={createElement:()=>({getContext:()=>({fillText(){}})})};let checked=0,maxHandGap=0,maxToeGap=0;
 for(const x of await examples()){
  const {fs}=await frames(x),sampler=createLivePoseSampler(),model=createFootballer({id:x.c.fromId,side:x.c.distribution.side,number:1,kit:{primaryColor:'#222222',secondaryColor:'#aaaaaa'},goalkeeper:true});let sawHold=false,sawDrop=false,sawFlight=false,sawContact=false,dropHeight=1.05;
  for(const f of fs){const P=f.presentation,e=P.activeEvent,s=sampler(f);if(e?.eventId!==x.c.id)continue;const d=e.keeperDistribution,t=d.timing,sec=P.clockProgress*P.duration,held=t?sec<t.releaseAt:P.progress<.19,pose=s.poses.find(p=>p.id===x.c.fromId),rig=poseFootballer(model,pose);
   if(held){assert.ok(P.keeperControl);assert.equal(f.ball.displayOwnerId,x.c.fromId);assert.equal(f.ball.presentationHeight,d.handMotion?.height??1.05);const gap=Math.min(world(rig.leftHand.toArray(),s.ball),world(rig.rightHand.toArray(),s.ball));maxHandGap=Math.max(maxHandGap,gap);assert.ok(gap<.15);sawHold=true;}
   else {assert.equal(P.keeperControl,null);if(P.progress<.76)assert.equal(f.ball.displayOwnerId,null);}
   if(t&&sec>=t.releaseAt&&sec<t.contactAt){assert.ok(distance(f.ball.displayPosition,d.release)<1e-8,'drop must not fly forward');assert.ok(f.ball.presentationHeight<=dropHeight+1e-8);assert.ok(f.ball.presentationHeight>=.24);dropHeight=f.ball.presentationHeight;sawDrop=true;}
   if(t&&Math.abs(sec-t.contactAt)<.002){const gap=world(rig.rightToe.toArray(),s.ball);maxToeGap=Math.max(maxToeGap,gap);assert.ok(gap<.16,`boot contact ${gap}`);sawContact=true;}
   if(P.progress>.20&&P.progress<.76){assert.ok(distance(f.ball.displayPosition,d.release)>.01);sawFlight=true;if(t&&P.progress>.30&&P.progress<.60)assert.ok(f.ball.presentationHeight>1.2);}
   if(t&&sec>t.contactAt+t.kickFollow+.01&&P.progress<.70){assert.equal(pose.keeperMotion.phase,'punt-recovered');assert.ok(Math.abs(pose.rightFoot[1]-.09)<1e-8,'kick foot has recovered while ball is flying');}
  }
  assert.ok(sawHold&&sawFlight);if(x.kind==='punt')assert.ok(sawDrop&&sawContact);checked++;console.log(JSON.stringify({seed:x.seed,event:x.c.id,kind:x.kind,direction:x.dir}));
 }console.log(JSON.stringify({distributionPaths:checked,maxHandGap,maxToeGap}));
});
test('punt release/drop remains attached to the single clock across pause, view switches and delayed frames',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let checked=0,crossings=0;
 for(const x of (await examples()).filter(x=>x.kind==='punt')){
  const a=setup(),b=setup();seek(a,x.seed,x.c.id);seek(b,x.seed,x.c.id);
  const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.displayBallHeight,pitchV73.carrier,pitchV73.keeperControl,pitchV73.active,pitchV73.progress,M.events,M.rand.state])';
  a.run('while(pitchV73.active.keeperDistribution&&pitchV73.progress*pitchV73.activeDuration<.3)ManagerStoryLive3D.step(.002,0)');b.run('while(pitchV73.active.keeperDistribution&&pitchV73.progress*pitchV73.activeDuration<.3)ManagerStoryLive3D.step(.002,0)');
  a.run('pauseLive()');const frozen=a.run(state);a.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(a.run(state),frozen);a.run('resumeLive()');
  for(let i=0;i<300;i++){const dt=i%3===0?.016:.12,before=a.run('ManagerStoryLive3D.time');a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${dt===.12?2:dt},0)`);assert.equal(a.run(state),b.run(state));const takes=a.run('qaFrameTakes');if(a.run('ManagerStoryLive3D.time')>before)assert.ok(takes.reduce((n,x)=>n+x.take,0)<=dt/2+1e-8);if(takes.length>1)crossings++;}checked++;
 }assert.ok(crossings>0);console.log(JSON.stringify({normalDelayedPunts:checked,crossingFrames:crossings}));
});
