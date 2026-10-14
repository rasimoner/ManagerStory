const test=require('node:test'),assert=require('node:assert/strict');
const d=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
test('long real passes with close teammates and opponents keep local spacing and receiver continuation, shared rates and shot contacts',async()=>{
 const{setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let nearby=0,movingNear=0,continued=0,maxSpeed=0;
 for(const[seed,id]of[[1,26],[1,85],[8800,44]]){const h=setup();seek(h,seed,id);const e=h.run('pitchV73.active');assert.ok(e.deliveryTiming&&d(e.fromPos,e.toPos)>30);const frames=h.run(`(()=>{const e=pitchV73.active,a=[];let tail=0;for(let i=0;i<14000;i++){ManagerStoryLive3D.step(.004,0);a.push(MatchView.read());if(pitchV73.active!==e&&++tail>100)break;}return a})()`),pass=frames.filter(f=>f.presentation.activeEvent?.eventId===id),sampler=createLivePoseSampler();
  const near=frames[0].players.filter(p=>p.id!==e.toId&&d(p.enginePosition,e.toPos)<4.5&&p.role!=='GK');assert.ok(near.length);for(const p of near){const a=pass[0].players.find(q=>q.id===p.id),b=pass.at(-1).players.find(q=>q.id===p.id);if(d(a.displayPosition,b.displayPosition)>.01)movingNear++;if(d(a.displayPosition,e.toPos)<.62)assert.ok(d(b.displayPosition,e.toPos)>d(a.displayPosition,e.toPos)+.3,'overlapping non-receiver opens contact space');nearby++;}
  for(const f of frames){const v=sampler(f);for(const p of v.poses){maxSpeed=Math.max(maxSpeed,p.gait.speed);assert.ok(p.gait.cyclesPerSecond<=6.000001);}if(f.presentation.activeEvent?.controlStart){assert.equal(f.ball.displayOwnerId,e.toId);continued++;}}
  
  h.run('pauseLive()');const expression='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.visualOffsets,pitchV73.progress,M.events,M.rand.state])',frozen=h.run(expression);for(const speed of[.5,1,2]){h.run(`setMatchSpeed(${speed});setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")`);assert.equal(h.run(expression),frozen);}h.run('setMatchSpeed(1);resumeLive()');const t=h.run('ManagerStoryLive3D.time');h.run('ManagerStoryLive3D.step(.002,0)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-t-.001)<1e-9);
 }
 assert.ok(continued>0&&movingNear>0);
 // Release-relative strike ends while a real long flight is still in progress.
 const h=setup();seek(h,1,103);const sample=createLivePoseSampler(),e=h.run('pitchV73.active'),D=h.run('pitchV73.activeDuration'),prep=e.shotKickTiming.preparation;
 for(const sec of[prep,prep+.09,prep+.20]){h.run(`(()=>{let left=${sec}-pitchV73.progress*pitchV73.activeDuration;while(left>1e-9){const dt=Math.min(.004,left/matchPlaybackRate());ManagerStoryLive3D.step(dt,0);left-=dt*matchPlaybackRate();}})()`);const f=h.run('MatchView.read()'),v=sample(f),p=v.poses.find(p=>p.id===e.fromId);assert.equal(f.ball.displayState.height,v.ball[1]);if(sec===prep)assert.ok(d(f.ball.displayPosition,e.fromPos)<1e-8);if(sec===prep+.20)assert.ok(Math.abs(p.lean)<1e-8,'strike finishes independently of flight');}
 console.log(JSON.stringify({nearBodies:nearby,movingNear,controlledFrames:continued,maxNativeGaitSpeed:maxSpeed,shotRelease:prep,shotDuration:D}));
});
