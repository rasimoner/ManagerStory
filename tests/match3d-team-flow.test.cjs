const test=require('node:test'),assert=require('node:assert/strict');
const d=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let cached;
async function matches(){if(cached)return cached;const{setup,full}=await import('../tools/match3d-round2-audit.mjs');return cached=[1,8800].map(seed=>({seed,before:full(setup(true,'02f3dacf4b2cb653945d9ef9903dde1076b016ff'),seed),after:full(setup(),seed)}));}
test('all-field flow preserves real engine, RNG, career and linked actions in different matches',async()=>{
 for(const m of await matches()){assert.equal(m.before.raw,m.after.raw);assert.equal(m.before.career,m.after.career);assert.ok(m.after.finished&&!m.after.pending&&m.after.singleResult);console.log(JSON.stringify({seed:m.seed,events:m.after.events.length,equal:true}));}
});
test('long flight involves both teams beyond actors; roots and native velocity persist across clips, pause and views',async()=>{
 const{setup,seek}=await import('../tools/match3d-round2-audit.mjs');let count=0;
 for(const sign of[-1,1]){let choice;for(const m of (sign===1?[...(await matches())].reverse():await matches())){const c=m.after.clips.find(c=>c.deliveryTiming&&d(c.from,c.to)>38&&Math.sign(c.to[0]-c.from[0])===sign);if(c){choice={m,c};break;}}assert.ok(choice);const{m,c}=choice,h=setup();seek(h,m.seed,c.id);
 const frames=h.run(`(()=>{const a=[],e=pitchV73.active;for(let i=0;i<10000;i++){ManagerStoryLive3D.step(.008,0);const f=MatchView.read();a.push({f,v:structuredClone(pitchV73.flowVelocity||{}),type:pitchV73.active?.type});if(pitchV73.active!==e&&a.length>2)break;}return a})()`);
 const flight=frames.filter(x=>x.f.presentation.activeEvent?.eventId===c.id&&x.f.presentation.progress>.22&&x.f.presentation.progress<.72);assert.ok(flight.length>10);const start=flight[0].f,end=flight.at(-1).f;
 const moved=start.players.filter(p=>p.id!==c.fromId&&p.id!==c.toId&&d(p.displayPosition,end.players.find(q=>q.id===p.id).displayPosition)>.08);
 for(const side of['user','opp'])assert.ok(moved.filter(p=>p.side===side&&p.role!=='GK').length>=5,`${sign} ${side} only ${moved.filter(p=>p.side===side).length}`);
 assert.equal(start.players.length,22);assert.equal(Object.keys(flight[0].v).length,22);
 let maxStep=0,maxDelta=0;for(let i=1;i<frames.length;i++){const old=frames[i-1],now=frames[i],dt=now.f.presentation.seconds-old.f.presentation.seconds;if(!dt)continue;for(const p of now.f.players){const q=old.f.players.find(x=>x.id===p.id);maxStep=Math.max(maxStep,d(p.displayPosition,q.displayPosition));if(p.id!==c.fromId&&p.id!==c.toId&&old.type===now.type)maxDelta=Math.max(maxDelta,Math.hypot(...now.v[String(p.id)].map((x,k)=>x-old.v[String(p.id)][k]))/dt);}}
 assert.ok(maxStep<.20,`jump ${maxStep}`);assert.ok(maxDelta<=10.01,`flow acceleration ${maxDelta}`);
 h.run('pauseLive()');const state='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.flowVelocity,pitchV73.ball,pitchV73.visualOffsets])',paused=h.run(state);h.run('ManagerStoryLive3D.step(2,0);setMatchView("2d");setMatchView("3d")');assert.equal(h.run(state),paused);
 console.log(JSON.stringify({seed:m.seed,id:c.id,direction:sign,movingNonActors:moved.length,maxStep,maxFlowAcceleration:maxDelta}));count++;}assert.equal(count,2);
});
test('real received-ball continuations have bounded first steps, carry boundaries and distance-based gait',async()=>{
 const{setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let controlled=0,boundaries=0,maxSpeed=0,maxAcceleration=0,maxCadence=0;
 for(const id of[256,289]){const h=setup();seek(h,8800,id);const actor=h.run('pitchV73.active.fromId'),sampler=createLivePoseSampler();
 const frames=h.run(`(()=>{const a=[],id=${JSON.stringify(actor)};for(let i=0;i<5000;i++){ManagerStoryLive3D.step(.008,0);if(pitchV73.carrier!==id||pitchV73.active?.contest||pitchV73.active?.heavyTouch||!pitchV73.active?.controlStart)break;a.push(MatchView.read());}return a})()`);assert.ok(frames.length>100);
 let old,velocity;for(const f of frames){const pose=sampler(f).poses.find(p=>p.id===actor);maxCadence=Math.max(maxCadence,pose.gait.cyclesPerSecond);assert.ok(pose.gait.cyclesPerSecond<=4.000001);if(old){const dt=f.presentation.seconds-old.presentation.seconds,a=f.players.find(p=>p.id===actor).displayPosition,b=old.players.find(p=>p.id===actor).displayPosition,v=a.map((x,k)=>(x-b[k])*(k===0?1.05:.68)/dt);maxSpeed=Math.max(maxSpeed,Math.hypot(...v));assert.ok(Math.hypot(...v)<=16.01);if(velocity){const accel=Math.hypot(...v.map((x,k)=>x-velocity[k]))/dt;maxAcceleration=Math.max(maxAcceleration,accel);assert.ok(accel<=24.1,`accel ${accel}`);}if(f.presentation.activeEvent?.eventId!==old.presentation.activeEvent?.eventId)boundaries++;velocity=v;}old=f;controlled++;}
 }assert.ok(boundaries>0);console.log(JSON.stringify({controlledFrames:controlled,carryBoundaries:boundaries,maxSpeed,maxAcceleration,maxCadenceNative:maxCadence}));
});
