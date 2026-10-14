const test=require('node:test'),assert=require('node:assert/strict');
const baseline='d5919c923060c49368bddc36adc630a62a37ba4c';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let cache;
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cache=[1,8800].map(seed=>({seed,before:full(setup(true,baseline),seed),after:full(setup(),seed)}));}
async function cases(){const selected=[];for(const m of await audit())for(const c of m.after.clips.filter(c=>c.deliveryTiming)){
 const raw=m.after.events.find(e=>e.eventId===c.id),d=distance(c.from,c.to),key=`${d>55?'very-long':d>30?'medium':'short'}/${Math.sign(c.to[0]-c.from[0])}`;
 if(raw.travelType==='aerial'&&!selected.some(x=>x.key===key))selected.push({seed:m.seed,c,key});
 }for(const kind of ['medium','very-long'])for(const dir of [-1,1])assert.ok(selected.some(x=>x.key===`${kind}/${dir}`));return selected;}
test('real matches preserve engine/RNG/career and each control; short deliveries retain their phase budgets',async()=>{
 let short=0,linked=0,long=0;
 for(const m of await audit()){
  assert.equal(m.after.raw,m.before.raw);assert.equal(m.after.career,m.before.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);
  const ids=m.after.clips.flatMap(c=>[...new Set([c.id,...c.linked,c.controlEvent?.eventId])]).filter(x=>x!=null);
  for(const e of m.after.events.filter(e=>['pass','cross','firstTouch','dribble','ballCarry','press','tackle','interception','shot','save'].includes(e.type)))assert.equal(ids.filter(id=>id===e.eventId).length,1,`${m.seed}/${e.eventId}`);
  for(const c of m.after.clips.filter(c=>c.deliveryTiming)){
   const old=m.before.clips.find(x=>x.id===c.id),d=distance(c.from,c.to),raw=m.after.events.find(e=>e.eventId===c.id);
   if(raw.travelType!=='aerial'||d<=22){assert.deepEqual([c.deliveryTiming.preparation,c.deliveryTiming.flight,c.deliveryTiming.control],[old.deliveryTiming.preparation,old.deliveryTiming.flight,old.deliveryTiming.control]);short++;}
   if(raw.travelType==='aerial'&&d>38){assert.ok(c.deliveryTiming.flight<old.deliveryTiming.flight);long++;}
   if(c.controlEvent){linked++;assert.equal(c.controlEvent.toId,c.toId);assert.deepEqual(c.controlEvent.toPos,c.to);}
  }
  console.log(JSON.stringify({seed:m.seed,engineRngCareerEqual:true,events:m.after.events.length,oldSeconds:m.before.wall,newSeconds:m.after.wall}));
 }assert.ok(short&&long&&linked);console.log(JSON.stringify({shortPhaseBudgets:short,longFlights:long,linkedControls:linked}));
});
test('medium/very-long aerial flights in both directions have independent kick timing and concurrent approach',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let checked=0,maxFlight=0;
 for(const {seed,c,key} of await cases()){
  if(key.startsWith('short'))continue;
  const h=setup();seek(h,seed,c.id);const sampler=createLivePoseSampler();
  const frames=h.run(`(()=>{const e=pitchV73.active,a=[];for(let i=0;i<20000&&pitchV73.active===e;i++){ManagerStoryLive3D.step(.004,0);if(pitchV73.active===e)a.push(MatchView.read());}return a;})()`);
  const t=c.deliveryTiming,at=sec=>frames.reduce((a,b)=>Math.abs(a.presentation.clockProgress*a.presentation.duration-sec)<Math.abs(b.presentation.clockProgress*b.presentation.duration-sec)?a:b),release=t.preparation,contact=release+t.flight;
  assert.equal(t.kickPreparation,.12);assert.equal(t.kickFollow,.18);
  const v1=at(release+t.flight*.45),v2=at(release+t.flight*.55),speed=distance(v1.ball.displayPosition,v2.ball.displayPosition)/((v2.presentation.clockProgress-v1.presentation.clockProgress)*t.total);
  assert.ok(speed>19.13&&speed<=60.001,`${seed}/${c.id} cruise ${speed}`);maxFlight=Math.max(maxFlight,t.flight);
  assert.equal(at(contact-.004).ball.displayOwnerId,null);assert.equal(at(contact+.004).ball.displayOwnerId,c.toId);
  assert.ok(distance(at(contact+.004).ball.displayPosition,c.to)<1e-8);
  const source=frame=>sampler(frame).poses.find(x=>x.id===c.fromId);
  const early=source(at(release+.09)),late=source(at(release+.25));
  assert.ok(Math.abs(early.lean)>.05);assert.ok(Math.abs(late.lean)<1e-8,'follow-through finishes while long ball is airborne');
  const receiver=id=>at(id).players.find(x=>x.id===c.toId).displayPosition;
  if(distance(c.startPositions[String(c.toId)],c.endPositions[String(c.toId)])>.01)assert.ok(distance(receiver(release),receiver(contact-.05))>.001);
  checked++;
 }console.log(JSON.stringify({twoDirectionsExamples:checked,maxNativeFlightSeconds:maxFlight,kickPreparation:.12,kickFollow:.18}));
});
test('receiver profile survives several steps and the next carry boundary; gait follows world distance',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let maxAcceleration=0,maxCadence=0,steps=0,boundaries=0;
 for(const m of await audit()){
  // Pick recorded same-owner chains, rather than a synthetic pass/run sequence.
  const chosen=m.after.clips.filter((c,i,a)=>c.deliveryTiming&&a.slice(i+1,i+8).some((x,j,b)=>x.carryFromControl&&b[j+1]?.carryFromControl));
  for(const c of chosen.slice(0,2)){
   const h=setup();seek(h,m.seed,c.id);const sampler=createLivePoseSampler();
   const frames=h.run(`(()=>{const id=${JSON.stringify(c.toId)},a=[];let following=false;for(let i=0;i<12000;i++){ManagerStoryLive3D.step(.004,0);if(pitchV73.active?.eventId!==${c.id})following=true;if(following&&(pitchV73.carrier!==id||pitchV73.active?.contest||pitchV73.active?.heavyTouch))break;a.push(MatchView.read());}return a;})()`);
   let prev,velocity,prevControlled=false;
   for(const f of frames){const pose=sampler(f).poses.find(x=>x.id===c.toId);assert.ok(pose.gait.cyclesPerSecond<=6.000001);maxCadence=Math.max(maxCadence,pose.gait.cyclesPerSecond);
    const controlled=!!f.presentation.activeEvent?.controlStart;
    if(prev){const dt=f.presentation.seconds-prev.presentation.seconds,root=f.players.find(x=>x.id===c.toId).displayPosition,old=prev.players.find(x=>x.id===c.toId).displayPosition,v=root.map((x,k)=>(x-old[k])*(k===0?1.05:.68)/dt);
     if(controlled&&prevControlled){assert.ok(Math.hypot(...v)<=24.01);if(velocity){const a=Math.hypot(...v.map((x,k)=>x-velocity[k]))/dt;maxAcceleration=Math.max(maxAcceleration,a);assert.ok(a<=48.1,`acceleration ${a}`);}}
     if(f.presentation.activeEvent?.eventId!==prev.presentation.activeEvent?.eventId&&controlled&&prevControlled)boundaries++;
     velocity=v;
    }prev=f;prevControlled=controlled;if(controlled)steps++;
   }
  }
 }assert.ok(steps>100&&boundaries>0);console.log(JSON.stringify({controlledFrames:steps,carryBoundaries:boundaries,maxAcceleration,maxCadenceNative:maxCadence}));
});
test('normal/delayed frames preserve one delta through flight/control/next clips; camera cannot alter world roots',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let crossings=0,cameraTravel=0,worldTravel=0;
 for(const {seed,c} of (await cases()).filter(x=>!x.key.startsWith('short')).slice(0,4)){
  const a=setup(),b=setup();seek(a,seed,c.id);seek(b,seed,c.id);const sampler=createLivePoseSampler();let old;
  for(let i=0;i<160;i++){const dt=i%3===0?.016:.12;a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${dt===.12?2:dt},0)`);
   const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.carrier,pitchV73.active?.eventId,pitchV73.progress,M.events,M.rand.state])';assert.equal(a.run(state),b.run(state));const takes=a.run('qaFrameTakes');if(takes.length>1)crossings++;assert.ok(takes.reduce((n,x)=>n+x.take,0)<=dt/2+1e-8);
   const f=a.run('MatchView.read()'),roots=JSON.stringify(f.players.map(x=>x.displayPosition)),s=sampler(f);assert.equal(JSON.stringify(f.players.map(x=>x.displayPosition)),roots);
   if(old){worldTravel+=Math.hypot(s.ball[0]-old.ball[0],s.ball[2]-old.ball[2]);cameraTravel+=Math.hypot(s.camera.focus[0]-old.camera.focus[0],s.camera.focus[2]-old.camera.focus[2]);}old=s;
  }
  a.run('pauseLive()');const frozen=a.run('JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball])');a.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(a.run('JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball])'),frozen);
 }assert.ok(crossings>0);console.log(JSON.stringify({crossingFrames:crossings,cameraTravel,worldTravel}));
});
