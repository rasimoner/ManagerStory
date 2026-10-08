const test=require('node:test'),assert=require('node:assert/strict');
const baseline='9cdf6823de93b5a4fb034361cfecdb4821718ce3';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let cache;
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');cache=[1,8800].map(seed=>({seed,before:full(setup(true,baseline),seed),after:full(setup(),seed)}));return cache;}
async function examples(){const cases=[],coverage=new Set();for(const m of await audit())for(const c of m.after.clips.filter(c=>c.deliveryTiming)){const raw=m.after.events.find(e=>e.eventId===c.id),dir=c.to[0]>=c.from[0]?1:-1;for(const kind of [raw.travelType,distance(c.from,c.to)<22?'short':'long']){const key=`${kind}/${dir}`;coverage.add(key);if(!cases.some(x=>x.keys.includes(key))){cases.push({seed:m.seed,clip:c,raw,keys:[`${raw.travelType}/${dir}`,`${distance(c.from,c.to)<22?'short':'long'}/${dir}`]});}}}for(const kind of ['ground','aerial','short','long'])for(const dir of [-1,1])assert.ok(coverage.has(`${kind}/${dir}`));return cases;}
test('two real matches preserve raw events/results/RNG/career, single result and each linked firstTouch exactly once',async()=>{
 let linked=0,deliveries=0;for(const {seed,before,after} of await audit()){
  assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.finished&&!after.pending&&after.singleResult);
  const ids=after.clips.flatMap(c=>[...new Set([c.id,...c.linked,c.controlEvent?.eventId])]).filter(x=>x!=null);
  for(const e of after.events.filter(e=>e.eventId!=null&&['pass','cross','firstTouch','dribble','ballCarry','press','tackle','interception','shot','save'].includes(e.type)))assert.equal(ids.filter(id=>id===e.eventId).length,1,`${seed}/${e.eventId} once`);
  for(const c of after.clips.filter(c=>c.deliveryTiming)){deliveries++;assert.equal(c.deliveryTiming.control,.12);assert.ok(c.duration===c.deliveryTiming.total);if(c.controlEvent){linked++;assert.equal(c.controlEvent.toId,c.toId);assert.ok(!after.clips.some(x=>x.id===c.controlEvent.eventId));}}
  console.log(JSON.stringify({seed,equalEngineRngStatsCareer:true,events:after.events.length,beforeSeconds:before.wall,afterSeconds:after.wall}));
 }assert.ok(linked>0);console.log(JSON.stringify({deliveries,linkedFirstTouches:linked}));
});
test('flight is steady outside a brief contact brake; receiver approach overlaps flight and phase boundaries keep ownership/positions',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let checked=0,minCruiseRatio=Infinity;
 for(const {seed,clip} of await examples()){
  const h=setup();seek(h,seed,clip.id);h.run(`window.qaDeliveryId=${clip.id};window.qaReceiver=${JSON.stringify(clip.toId)}`);
  const frames=h.run(`(()=>{const a=[];for(let i=0;i<30000&&pitchV73.active?.eventId===qaDeliveryId;i++){ManagerStoryLive3D.step(.001,0);if(pitchV73.active?.eventId!==qaDeliveryId)break;a.push({sec:pitchV73.progress*pitchV73.activeDuration,p:pitchV73.actionProgress,ball:[...pitchV73.ball],root:[...pitchV73.positions[String(qaReceiver)]],owner:pitchV73.carrier});}return a;})()`);
  const t=clip.deliveryTiming,release=t.preparation,contact=release+t.flight;
  const near=sec=>frames.reduce((a,b)=>Math.abs(a.sec-sec)<Math.abs(b.sec-sec)?a:b);
  const velocity=sec=>{const a=near(sec-.001),b=near(sec+.001);return distance(a.ball,b.ball)/(b.sec-a.sec);};
  const cruise=velocity(release+t.flight*.5),late=velocity(release+t.flight*.7);minCruiseRatio=Math.min(minCruiseRatio,late/cruise);assert.ok(late/cruise>.999&&late/cruise<1.001);
  assert.ok(velocity(contact-.0006)<.4,`${seed}/${clip.id} contact velocity`);assert.ok(cruise<=22.00001);
  const before=near(contact-.001),at=near(contact+.001);assert.equal(before.owner,null);assert.equal(at.owner,clip.toId);assert.ok(distance(at.ball,clip.to)<1e-8);assert.ok(distance(at.root,clip.endPositions[String(clip.toId)])<1e-8);
  assert.ok(distance(before.ball,at.ball)<.001);assert.ok(clip.deliveryTiming.control<.13);checked++;
  if(distance(clip.startPositions[String(clip.toId)],clip.endPositions[String(clip.toId)])>.01){assert.ok(distance(near(release).root,near(contact-.1*t.flight).root)>.001);}
 }console.log(JSON.stringify({examples:checked,minCruiseRatio,contactBrakeSecondsMax:.08,controlSeconds:.12}));
});
test('actual control-to-first movement is continuous, has no preparation hold and bounds acceleration separately from speed',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');let checked=0,maxAcceleration=0;
 const chosen=[];for(const m of await audit())for(const c of m.after.clips.filter(c=>c.controlStart)){const type=c.carryFromControl?'carry':'gap';if(!chosen.some(x=>x.type===type))chosen.push({seed:m.seed,clip:c,type});}
 for(const {seed,clip,type} of chosen){const h=setup();if(clip.id==null){const prev=(await audit()).find(x=>x.seed===seed).after.clips;const index=prev.indexOf(clip);let p=index-1;while(p>=0&&!prev[p].deliveryTiming)p--;seek(h,seed,prev[p].id);h.run(`for(let i=0;i<20000&&!pitchV73.active?.controlStart;i++)ManagerStoryLive3D.step(.001,0)`);}else seek(h,seed,clip.id);
  const r=h.run(`(()=>{const e=pitchV73.active,id=String(e.controlStart.id),D=pitchV73.activeDuration,old=[...pitchV73.positions[id]],a=[];for(let i=0;i<30000&&pitchV73.active===e;i++){ManagerStoryLive3D.step(.001,0);if(pitchV73.active===e)a.push({q:pitchV73.progress,root:[...pitchV73.positions[id]],ball:[...pitchV73.ball],time:ManagerStoryLive3D.time});}return {start:old,D,frames:a};})()`);
  const motion=distance(r.start,r.frames.at(-1).root);if(motion>.001){assert.ok(distance(r.start,r.frames[Math.min(20,r.frames.length-1)].root)>0);let prevV;
   for(let i=1;i<r.frames.length;i++){const a=r.frames[i-1],b=r.frames[i],dt=b.time-a.time,v=b.root.map((x,k)=>(x-a.root[k])*(k===0?1.05:.68)/dt);assert.ok(Math.hypot(...v)<=24.001);if(prevV){const accel=Math.hypot(...v.map((x,k)=>x-prevV[k]))/dt;maxAcceleration=Math.max(maxAcceleration,accel);assert.ok(accel<=48.01,`${type} acceleration ${accel}`);}prevV=v;}
  }if(type==='carry')assert.ok(clip.carryFromControl);checked++;
 }assert.equal(checked,2);console.log(JSON.stringify({firstMovementKinds:checked,maxAcceleration}));
});
test('normal/delayed frames across delivery/control/first step use identical capped delta; camera reads common world motion',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let crossing=0,cameraTravel=0,worldTravel=0;
 for(const {seed,clip} of (await examples()).slice(0,3)){const a=setup(),b=setup();seek(a,seed,clip.id);seek(b,seed,clip.id);const sampler=createLivePoseSampler();let old;
  for(let i=0;i<90;i++){const dt=i%3===0?.016:.12;a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${dt===.12?2:dt},0)`);
   const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.carrier,pitchV73.active?.eventId,pitchV73.progress,M.events,M.rand.state])';assert.equal(a.run(state),b.run(state));const takes=a.run('qaFrameTakes');if(takes.length>1)crossing++;assert.ok(takes.reduce((n,x)=>n+x.take,0)<=dt/2+1e-8);
   const s=sampler(a.run('MatchView.read()'));if(old){worldTravel+=Math.hypot(s.ball[0]-old.ball[0],s.ball[2]-old.ball[2]);cameraTravel+=Math.hypot(s.camera.focus[0]-old.camera.focus[0],s.camera.focus[2]-old.camera.focus[2]);}old=s;
  }
  a.run('pauseLive()');const frozen=a.run('JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball])');a.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(a.run('JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball])'),frozen);
 }assert.ok(crossing>0&&cameraTravel>0&&worldTravel>0);console.log(JSON.stringify({crossingFrames:crossing,cameraTravel,worldTravel,cameraHasNoIndependentClock:true}));
});
