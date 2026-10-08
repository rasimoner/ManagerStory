const test=require('node:test'),assert=require('node:assert/strict');
const baseline='97bebc69f553b8a625af4da0c8b311be7812a3c4';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68),world=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let cache;
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cache=[1,8800].map(seed=>({seed,before:full(setup(true,baseline),seed),after:full(setup(),seed)}));}
async function examples(){const a=[];for(const m of await audit())for(const shot of m.after.clips.filter(c=>c.result?.saveType==='PARRY')){
 const i=m.after.clips.indexOf(shot),r=m.after.clips.slice(i+1).find(c=>c.type==='recovery'),keeper=r.toId===0||r.toId==='o0',dir=Math.sign(shot.to[0]-50);
 if(!a.some(x=>x.seed===m.seed&&x.keeper===keeper&&x.dir===dir))a.push({seed:m.seed,shot,r,keeper,dir});
 }for(const keeper of [true,false])for(const dir of [-1,1])assert.ok(a.some(x=>x.keeper===keeper&&x.dir===dir));return a;}
async function frames(seed,shot){const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const h=setup();seek(h,seed,shot.id);return {h,frames:h.run(`(()=>{const a=[];let recovered=null,tail=0;for(let i=0;i<22000;i++){ManagerStoryLive3D.step(.004,0);a.push(MatchView.read());if(pitchV73.active?.type==='recovery')recovered=pitchV73.active.eventId;if(${shot.result.saveType==='PARRY'}&&recovered!=null&&pitchV73.active?.eventId!==recovered&&++tail>180||pitchV73.active?.keeperDistribution&&pitchV73.progress>.4)break;}return a;})()`)};}
test('actual engine outcomes/RNG/career and event identity remain equal to the delivery baseline',async()=>{
 for(const m of await audit()){
  assert.equal(m.after.raw,m.before.raw);assert.equal(m.after.career,m.before.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);
  const ids=m.after.clips.flatMap(c=>[...new Set([c.id,...c.linked,c.controlEvent?.eventId])]).filter(x=>x!=null);
  for(const e of m.after.events.filter(e=>['shot','save','looseBall','recovery','pass','cross','firstTouch'].includes(e.type)))assert.equal(ids.filter(x=>x===e.eventId).length,1);
  for(const c of m.after.clips.filter(c=>c.deliveryTiming))assert.deepEqual(c.deliveryTiming,m.before.clips.find(x=>x.id===c.id).deliveryTiming);
  for(const c of m.after.clips.filter(c=>c.result?.type==='save'))assert.equal(c.duration,m.before.clips.find(x=>x.id===c.id).duration);
  console.log(JSON.stringify({seed:m.seed,events:m.after.events.length,engineRngCareerEqual:true}));
 }
});
test('parry winners approach the loose landing; ownership and hand attachment start only at visible contact',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};let chains=0,unowned=0,maxRigGap=0;
 for(const {seed,shot,r,keeper,dir} of await examples()){
  const {frames:fs}=await frames(seed,shot),sampler=createLivePoseSampler(),model=createFootballer({id:r.toId,side:shot.result.toSide,number:1,kit:{primaryColor:'#222222',secondaryColor:'#aaaaaa'},goalkeeper:keeper});let start,land,contact=false,prev;
  for(const f of fs){const p=f.presentation,e=p.activeEvent,s=sampler(f),winner=f.players.find(x=>x.id===r.toId),pose=s.poses.find(x=>x.id===r.toId);
   if(e?.type==='looseBall'){assert.equal(p.keeperControl,null);assert.equal(f.ball.displayOwnerId,null);land=f.ball.displayPosition;}
   if(e?.eventId===r.id){assert.ok(e.looseCollection);start??=winner.displayPosition;
    assert.ok(distance(f.ball.displayPosition,e.looseCollection.land)<1e-8,'unowned ball must not be drawn back to the winner');
    if(p.progress<.76){assert.equal(f.ball.displayOwnerId,null);assert.equal(p.keeperControl,null);assert.equal(f.ball.presentationHeight,.15);unowned++;}
    else {assert.equal(f.ball.displayOwnerId,r.toId);assert.ok(distance(winner.displayPosition,e.looseCollection.root)<1e-8);
     if(!contact){assert.ok(distance(start,winner.displayPosition)>.1);assert.ok(distance(winner.displayPosition,f.ball.displayPosition)<.4);contact=true;}
     if(keeper){assert.equal(p.keeperControl.eventId,r.id);assert.ok(f.ball.presentationHeight>=.15&&f.ball.presentationHeight<=1.05);const rig=poseFootballer(model,pose),gap=Math.min(world(rig.leftHand.toArray(),s.ball),world(rig.rightHand.toArray(),s.ball));maxRigGap=Math.max(maxRigGap,gap);assert.ok(gap<.16,`keeper rig contact ${gap} ${seed}/${r.id} p=${p.progress}`);}
    }
   }
   if(prev&&prev.p.activeEvent?.eventId!==e?.eventId){assert.ok(world(prev.s.ball,s.ball)<.12,`ball clip boundary ${seed}/${r.id}`);assert.ok(world(prev.pose.position,pose.position)<.08,'winner root continuity');if(keeper){const yaw=Math.abs(Math.atan2(Math.sin(pose.yaw-prev.pose.yaw),Math.cos(pose.yaw-prev.pose.yaw)));assert.ok(yaw<.04&&world(prev.pose.rightHand,pose.rightHand)<.04,`collection pose boundary ${seed}/${r.id} yaw=${yaw}`);}}
   prev={p,s,pose};
  }assert.ok(contact);chains++;console.log(JSON.stringify({seed,recovery:r.id,keeper,dir,approachMetres:distance(start,r.endPositions[String(r.toId)])}));
 }console.log(JSON.stringify({causalChains:chains,unownedFrames:unowned,maxRigGap}));
});
test('direct catches still retain the ball until actual distribution in both goals',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');let checked=0;
 for(const m of await audit())for(const dir of [-1,1]){
  const shot=m.after.clips.find(c=>{if(c.result?.saveType!=='CATCH'||Math.sign(c.to[0]-50)!==dir)return false;for(const x of m.after.clips.slice(m.after.clips.indexOf(c)+1)){if(['pass','cross'].includes(x.type)&&x.fromId===c.result.toId)return true;if(x.endOwner!==c.result.toId)return false;}return false;});
  assert.ok(shot);const {frames:fs}=await frames(m.seed,shot),sampler=createLivePoseSampler();let release=false;
  for(const f of fs){const p=f.presentation,e=p.activeEvent;sampler(f);if(p.keeperControl){assert.equal(f.ball.displayOwnerId,shot.result.toId);assert.equal(f.ball.presentationHeight,p.activeEvent?.keeperDistribution?.handMotion?.height??1.05);}if(e?.keeperDistribution&&p.progress>=.19){assert.equal(p.keeperControl,null);assert.equal(f.ball.displayOwnerId,null);release=true;}}
  assert.ok(release);checked++;
 }console.log(JSON.stringify({directCatchDistributionChains:checked}));
});
test('normal/delayed frames and paused 2D/3D preserve the same contact and one clock',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let checked=0,crossings=0;
 for(const x of (await examples()).filter(x=>x.keeper)){
  const a=setup(),b=setup();seek(a,x.seed,x.r.id);seek(b,x.seed,x.r.id);
  const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.displayBallHeight,pitchV73.carrier,pitchV73.keeperControl,pitchV73.active,pitchV73.progress,M.events,M.rand.state])';
  a.run('pauseLive()');const frozen=a.run(state);a.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(a.run(state),frozen);a.run('resumeLive()');
  for(let i=0;i<160;i++){const dt=i%3===0?.016:.12;const before=a.run('ManagerStoryLive3D.time');a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${dt===.12?2:dt},0)`);assert.equal(a.run(state),b.run(state));const takes=a.run('qaFrameTakes');if(a.run('ManagerStoryLive3D.time')>before)assert.ok(takes.reduce((n,x)=>n+x.take,0)<=dt/2+1e-8);if(takes.length>1)crossings++;}checked++;
 }assert.ok(crossings>0);console.log(JSON.stringify({normalDelayedChains:checked,crossingFrames:crossings}));
});
