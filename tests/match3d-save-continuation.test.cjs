const test=require('node:test'),assert=require('node:assert/strict');
const baseline='80803f5aafc4a2dfe2f4bb01da1783a9e1e16843';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68),world=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let cache;
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cache=[1,8800].map(seed=>({seed,before:full(setup(true,baseline),seed),after:full(setup(),seed)}));}
async function examples(kind){const a=[];for(const m of await audit())for(const c of m.after.clips.filter(c=>c.result?.saveType===kind)){
 if(kind==='CATCH'){
  let distributed=false;
  for(const next of m.after.clips.slice(m.after.clips.indexOf(c)+1)){
   if(['pass','cross'].includes(next.type)&&next.fromId===c.result.toId){distributed=true;break;}
   if(next.endOwner!==c.result.toId)break;
  }
  // Some real CATCH chains instead lose possession in an engine challenge.
  // They cannot be fabricated into catch->distribution examples.
  if(!distributed)continue;
 }
 const dir=Math.sign(c.to[0]-50);if(!a.some(x=>x.seed===m.seed&&x.dir===dir))a.push({seed:m.seed,dir,c});}for(const seed of [1,8800])for(const dir of [-1,1])assert.ok(a.some(x=>x.seed===seed&&x.dir===dir));return a;}
async function frames(seed,c){const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const h=setup();seek(h,seed,c.id);const snapshots=h.run(`(()=>{const a=[];let recovered=null,tail=0;for(let i=0;i<18000;i++){ManagerStoryLive3D.step(.004,0);a.push(MatchView.read());if(pitchV73.active?.type==='recovery')recovered=pitchV73.active.eventId;if(recovered!=null&&pitchV73.active?.eventId!==recovered&&++tail>10||pitchV73.active?.keeperDistribution&&pitchV73.progress>.4)break;}return a;})()`);return {h,snapshots};}
test('save chains preserve real events/RNG/career, single result and the delivered tempo budgets',async()=>{
 let saves=0;
 for(const m of await audit()){
  assert.equal(m.after.raw,m.before.raw);assert.equal(m.after.career,m.before.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);
  const ids=m.after.clips.flatMap(c=>[...new Set([c.id,...c.linked,c.controlEvent?.eventId])]).filter(x=>x!=null);
  for(const e of m.after.events.filter(e=>['shot','save','looseBall','recovery','pass','cross','firstTouch'].includes(e.type)))assert.equal(ids.filter(x=>x===e.eventId).length,1,`${m.seed}/${e.eventId} exactly once`);
  for(const c of m.after.clips.filter(c=>c.deliveryTiming)){const old=m.before.clips.find(x=>x.id===c.id);assert.deepEqual(c.deliveryTiming,old.deliveryTiming);}
  for(const c of m.after.clips.filter(c=>c.result?.type==='save')){saves++;assert.equal(c.duration,m.before.clips.find(x=>x.id===c.id).duration);}
  console.log(JSON.stringify({seed:m.seed,events:m.after.events.length,engineRngCareerEqual:true,oldSeconds:m.before.wall,newSeconds:m.after.wall}));
 }console.log(JSON.stringify({realSaves:saves,tempoBudgetsUnchanged:true}));
});
test('parry starts leaving at contact and crosses the actual loose event without position/height/pose reset',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');let boundaries=0,maxYawStep=0,maxHandStep=0,maxBallStep=0;
 for(const {seed,c} of await examples('PARRY')){
  const {snapshots}=await frames(seed,c),sampler=createLivePoseSampler();let prev,contact,departed=false,sawLoose=false,sawRecovery=false;
  for(const f of snapshots){const p=f.presentation,e=p.activeEvent,s=sampler(f),pose=s.poses.find(x=>x.id===c.result.toId&&x.side===c.result.toSide);
   if(e?.eventId===c.id&&p.progress>=.76){assert.equal(f.ball.displayOwnerId,null);contact??=[...p.shotMotion.target];if(distance(contact,f.ball.displayPosition)>.1)departed=true;assert.ok(e.parryFlight);}
   if(e?.type==='looseBall'){sawLoose=true;assert.ok(e.parryFlight?.continuation);assert.equal(f.ball.displayOwnerId,null);assert.equal(p.keeperControl,null);}
   if(e?.type==='recovery'){sawRecovery=true;if(p.progress<.76)assert.equal(f.ball.displayOwnerId,null);else assert.equal(f.ball.displayOwnerId,e.toId);}
   if(prev&&(prev.p.activeEvent?.type!==e?.type||prev.p.activeEvent?.eventId!==e?.eventId)){
    const step=world(prev.s.ball,s.ball),rootStep=world(prev.pose.position,pose.position),yaw=Math.abs(Math.atan2(Math.sin(pose.yaw-prev.pose.yaw),Math.cos(pose.yaw-prev.pose.yaw))),hand=world(prev.pose.rightHand,pose.rightHand);
    maxBallStep=Math.max(maxBallStep,step);maxYawStep=Math.max(maxYawStep,yaw);maxHandStep=Math.max(maxHandStep,hand);assert.ok(step<.12&&rootStep<.08&&yaw<.04&&hand<.04,JSON.stringify({seed,id:c.id,step,rootStep,yaw,hand}));boundaries++;
   }if(prev&&p.shotMotion==null){const yaw=Math.abs(Math.atan2(Math.sin(pose.yaw-prev.pose.yaw),Math.cos(pose.yaw-prev.pose.yaw)));assert.ok(yaw<.06,`post-save recovery yaw ${yaw} seed=${seed} shot=${c.id} ${prev.p.activeEvent?.type}/${prev.p.activeEvent?.eventId}->${e?.type}/${e?.eventId} p=${p.progress}`);}prev={p,s,pose};
  }assert.ok(departed&&sawLoose&&sawRecovery);
 }console.log(JSON.stringify({parryBoundaries:boundaries,maxBallStep,maxYawStep,maxHandStep}));
});
test('real catches retain ball and actual rig hand contact until the real distribution release in both directions',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};let held=0,maxHandGap=0,releases=0;
 for(const {seed,c} of await examples('CATCH')){
  const {snapshots}=await frames(seed,c),sampler=createLivePoseSampler(),model=createFootballer({id:c.result.toId,side:c.result.toSide,number:1,kit:{primaryColor:'#222222',secondaryColor:'#aaaaaa'},goalkeeper:true});let old,sawHeld=false;
  for(let i=0;i<snapshots.length;i++){const f=snapshots[i],p=f.presentation,e=p.activeEvent,s=sampler(f),pose=s.poses.find(x=>x.id===c.result.toId&&x.side===c.result.toSide);
   if(p.keeperControl){assert.equal(f.ball.displayOwnerId,c.result.toId);assert.equal(f.ball.presentationHeight,p.activeEvent?.keeperDistribution?.handMotion?.height??1.05);sawHeld=true;held++;
    if(i%10===0&&(!p.shotMotion||p.progress>.94)){const contacts=poseFootballer(model,pose),gap=Math.min(world(contacts.leftHand.toArray(),s.ball),world(contacts.rightHand.toArray(),s.ball));maxHandGap=Math.max(maxHandGap,gap);assert.ok(gap<.15,`actual rig contact ${gap}`);}
   }
   if(e?.keeperDistribution){const held=e.keeperDistribution.timing?p.clockProgress*p.duration<e.keeperDistribution.timing.releaseAt:p.progress<.19;if(held){assert.ok(p.keeperControl);assert.equal(f.ball.displayOwnerId,c.result.toId);}else{assert.equal(p.keeperControl,null);if(p.progress<.76)assert.equal(f.ball.displayOwnerId,null);if(old&&(e.keeperDistribution.timing?old.p.clockProgress*old.p.duration<e.keeperDistribution.timing.releaseAt:old.p.progress<.19))releases++;}}
   if(old&&old.p.activeEvent?.type!==e?.type){assert.ok(world(old.s.ball,s.ball)<.12);assert.ok(world(old.pose.position,pose.position)<.08);}
   old={p,s,pose};
  }assert.ok(sawHeld&&snapshots.some(f=>f.presentation.activeEvent?.keeperDistribution));
 }assert.equal(releases,4);console.log(JSON.stringify({heldFrames:held,actualRigMaxHandGap:maxHandGap,realReleases:releases}));
});
test('pause/view switches and normal/delayed frames retain save-flight/control and the single common clock',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let checked=0,crossings=0;
 for(const kind of ['CATCH','PARRY'])for(const {seed,c} of (await examples(kind)).filter(x=>x.seed===8800)){
  const a=setup(),b=setup();seek(a,seed,c.id);seek(b,seed,c.id);
  a.run('while(pitchV73.active?.eventId==='+c.id+'&&pitchV73.progress<.8)ManagerStoryLive3D.step(.004,0)');b.run('while(pitchV73.active?.eventId==='+c.id+'&&pitchV73.progress<.8)ManagerStoryLive3D.step(.004,0)');
  a.run('pauseLive()');const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.displayBallHeight,pitchV73.carrier,pitchV73.keeperControl,pitchV73.keeperRecovery,pitchV73.active,pitchV73.progress,M.events,M.rand.state])',frozen=a.run(state);
  a.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(a.run(state),frozen);a.run('resumeLive()');
  for(let i=0;i<160;i++){const dt=i%3===0?.016:.12;a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${dt===.12?2:dt},0)`);assert.equal(a.run(state),b.run(state));const takes=a.run('qaFrameTakes');assert.ok(takes.reduce((n,x)=>n+x.take,0)<=dt/2+1e-8);if(takes.length>1)crossings++;}checked++;
 }assert.ok(crossings>0);console.log(JSON.stringify({normalDelayedChains:checked,crossingFrames:crossings,pauseViewsPreserved:true}));
});
