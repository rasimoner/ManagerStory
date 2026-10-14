const test=require('node:test'),assert=require('node:assert/strict');
const base='c4b2073944579405f4940b91930b20ad309bd874';
test('wide shots in both directions retain preparation/flight, bounded out tail and no settlement before real restart',async()=>{
 const{setup,seek}=await import('../tools/match3d-round2-audit.mjs');
 for(const[seed,id]of[[8800,14],[1,103]]){
  const old=setup(true,base);seek(old,seed,id);const h=setup();seek(h,seed,id);
  const d=old.run('pitchV73.activeDuration'),t=h.run('pitchV73.active.wideTiming');assert.ok(t.originalDuration>0);assert.ok(Math.abs(t.arrivalAt-t.originalDuration*.76)<1e-8);assert.equal(t.follow,.12);
  // Match phases at the same elapsed seconds; exclude separately initialized first seek frame.
  for(const phase of [.19,.4,.7]){
   for(const x of[old,h])x.run(`(()=>{const goal=${(x===old?d:t.originalDuration)*phase},elapsed=pitchV73.progress*pitchV73.activeDuration;let left=(goal-elapsed)/matchPlaybackRate();while(left>1e-10){const dt=Math.min(.02,left);qaWall+=dt;ManagerStoryLive3D.step(dt,qaWall*1000);left-=dt}})()`);
   assert.ok(Math.abs(old.run('pitchV73.actionProgress')-h.run('pitchV73.actionProgress'))<1e-8);for(const key of ['ball']){const a=old.run('pitchV73.'+key),b=h.run('pitchV73.'+key);for(const k of Object.keys(a)){const aa=Array.isArray(a)?a[k]:a[k],bb=b[k];if(Array.isArray(aa))assert.ok(Math.hypot(...aa.map((v,i)=>v-bb[i]))<1e-8);else assert.ok(Math.abs(aa-bb)<1e-8);}}
  }
  h.run(`window.qaOut=[];for(let i=0;i<2000;i++){qaWall+=.01;ManagerStoryLive3D.step(.01,qaWall*1000);qaOut.push({time:ManagerStoryLive3D.time,type:pitchV73.active?.type,p:pitchV73.actionProgress,ball:[...pitchV73.ball],positions:JSON.stringify(pitchV73.positions),owner:pitchV73.carrier});if(pitchV73.active?.type==='restartPosition'&&pitchV73.actionProgress*pitchV73.activeDuration>.15)break}`);
  const frames=h.run('qaOut'),shotEnd=frames.find(x=>x.type==='shot'&&x.p>=.76),placed=frames.at(-1);assert.ok(shotEnd);assert.equal(placed.type,'restartPosition');assert.ok(placed.time-shotEnd.time<=.37,'no seconds of out-endpoint holding');
  assert.equal(frames.some(x=>x.type==='enginePositionGap'),false);const out=frames.filter(x=>x.type==='ballOut');assert.ok(out.length>0);assert.ok(out.every(x=>x.owner===null&&x.positions===out[0].positions));
  h.run('pauseLive()');const held=h.run('JSON.stringify(MatchView.read())');h.run('ManagerStoryLive3D.step(2,999999)');assert.equal(h.run('JSON.stringify(MatchView.read())'),held);h.run('resumeLive();window.qaBefore=ManagerStoryLive3D.time;qaWall+=2;ManagerStoryLive3D.step(2,qaWall*1000)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time-qaBefore')-.06)<1e-8);h.run('window.qaBefore=ManagerStoryLive3D.time;qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time-qaBefore')-.01)<1e-8);
 }
});
test('normal and delayed frames preserve actual out/restart IDs and motor RNG career, half/final drain',async()=>{
 const{setup,full}=await import('../tools/match3d-round2-audit.mjs');
 for(const seed of[1,8800]){const a=full(setup(true,base),seed),b=full(setup(),seed);assert.equal(b.raw,a.raw);assert.equal(b.career,a.career);assert.equal(b.singleResult,true);assert.equal(b.pending,false);
  for(const e of b.events.filter(e=>['ballOut','restartPosition','restartPlayers','restartWait','goalKick'].includes(e.type)))assert.equal(b.clips.filter(c=>c.id===e.eventId).length,1);
 }
 const h=setup();h.run('M.rand=R(8800);window.qaOutIds=[]');let n=0;for(;n<16000;n++){h.run(`qaWall+=2;ManagerStoryLive3D.step(2,qaWall*1000);if(M.reason==='half'&&!ManagerStoryLive3D.halfPending)startSecondHalf();else if(M.reason==='injury')resumeLive()`);if(h.run('M.finished&&!ManagerStoryLive3D.finishing'))break;if(h.run('M.reason==="injury"'))break;}
 assert.ok(n<16000);assert.ok(h.run('ManagerStoryLive3D.time')<=h.run('qaWall')*.5,'delayed time is capped, not repaid');
});
