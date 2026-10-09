const test=require('node:test'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setImmediate(r));
test('opponent 2x and home 1x goals wait for displayed image decode, then hold two real seconds without debt',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');
 for(const [seed,id,speed] of [[8800,224,2],[1,162,1]]){
  const h=setup();seek(h,seed,id);
  h.run(`window.Image=function(){};setMatchSpeed(${speed});for(let i=0;i<2000&&pitchV73.goalPresentation?.stage!=='image';i++){qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000)}if(pitchV73.goalPresentation?.stage!=='image')throw Error('Missing image gate');
   window.qaImage={complete:false,naturalWidth:0,decode(){return new Promise(r=>window.qaDecode=r)}};
   window.qaOverlay={hidden:true,dataset:{},style:{setProperty(){}},querySelector(s){return s==='img'?qaImage:{textContent:''}}};
   paintPitchGoalFeedback(qaOverlay,pitchV73.goalFeedback);
   window.qaHold=JSON.stringify([M.events,pitchV73.queue,pitchV73.positions,pitchV73.ball,ManagerStoryLive3D.time,pitchV73.displayMatchSeconds]);
   qaWall+=3;ManagerStoryLive3D.step(3,qaWall*1000);`);
  assert.equal(h.run('pitchV73.goalFeedback.visible'),false);assert.equal(h.run('pitchV73.goalPresentation.until'),null);
  assert.equal(h.run('JSON.stringify([M.events,pitchV73.queue,pitchV73.positions,pitchV73.ball,ManagerStoryLive3D.time,pitchV73.displayMatchSeconds])'),h.run('qaHold'));
  assert.equal(h.run('qaImage.src'),h.run(`fanPhoto(${speed===2?'M.away':'M.home'})`));
  h.run('qaImage.complete=true;qaImage.naturalWidth=1024;qaImage.onload();qaWall+=3;ManagerStoryLive3D.step(3,qaWall*1000)');
  assert.equal(h.run('pitchV73.goalFeedback.visible'),false);
  h.run('qaDecode()');await tick();
  h.run('qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000);paintPitchGoalFeedback(qaOverlay,pitchV73.goalFeedback)');
  assert.equal(h.run('qaOverlay.hidden'),false);assert.equal(h.run('pitchV73.goalPresentation.until-qaWall*1000'),2000);
  h.run('window.qaTime=ManagerStoryLive3D.time;qaWall+=1.99;ManagerStoryLive3D.step(1.99,qaWall*1000)');assert.equal(h.run('pitchV73.goalFeedback.visible'),true);
  h.run('qaWall+=.011;ManagerStoryLive3D.step(.011,qaWall*1000)');assert.equal(h.run('pitchV73.goalPresentation'),null);assert.equal(h.run('ManagerStoryLive3D.time'),h.run('qaTime'));
  h.run('qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time-qaTime')-.02*speed/2)<1e-8);
 }
});
test('failed team photo uses existing fallback once; stale acknowledgement cannot release another goal',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const h=setup();seek(h,8800,224);
 h.run(`window.Image=function(){};for(let i=0;i<2000&&pitchV73.goalPresentation?.stage!=='image';i++){qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000)}window.qaImage={complete:false,naturalWidth:0};window.qaOverlay={dataset:{},style:{setProperty(){}},querySelector(s){return s==='img'?qaImage:{}}};paintPitchGoalFeedback(qaOverlay,pitchV73.goalFeedback);ManagerStoryLive3D.goalImageReady({},pitchV73.goalFeedback.eventId);`);
 assert.equal(h.run('pitchV73.goalPresentation.imageReady'),undefined);
 h.run('qaImage.onerror()');assert.equal(h.run('qaImage.src'),'assets/atmosphere/fans-neutral.webp');
 h.run('qaImage.onerror();qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000)');assert.equal(h.run('pitchV73.goalPresentation'),null);assert.equal(h.run('pitchV73.goalFeedback.visible'),false);
});
test('two matches preserve motor events RNG career and single result against delivered baseline',async()=>{
 const {setup,full}=await import('../tools/match3d-round2-audit.mjs');for(const seed of [1,8800]){const a=full(setup(true,'198986d829ad64a50d1baeb7b98cfbbfeb3b52dd'),seed),b=full(setup(),seed);assert.equal(b.raw,a.raw);assert.equal(b.career,a.career);assert.equal(b.finished,true);assert.equal(b.pending,false);assert.equal(b.singleResult,true);}
});
