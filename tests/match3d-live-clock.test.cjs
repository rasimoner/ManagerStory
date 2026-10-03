const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {harness,playToEnd}=require('./engine-harness.cjs');
function setup(live=false){const h=harness();h.run(fs.readFileSync('dist/match3d-live-clock.js','utf8'));h.run(fs.readFileSync('dist/match-view-adapter.js','utf8'));h.run('S=fresh();init();'+(live?'ManagerStoryLive3D.enable();':'')+'startMatch();resumeLive()');return h;}
test('common scheduler uses speed once and freezes clock, positions, ball and event phase on pause',()=>{
 const h=setup(true);h.run('ManagerStoryLive3D.step(.1,100)');assert.equal(h.run('ManagerStoryLive3D.time'),.025);
 h.run('setMatchSpeed(2);ManagerStoryLive3D.step(.1,200)');assert.equal(h.run('ManagerStoryLive3D.time'),.07500000000000001);
 const D=h.run('pitchV73.activeDuration');h.run('setMatchSpeed(.5);ManagerStoryLive3D.step(.1,300)');assert.equal(h.run('pitchV73.activeDuration'),D);
 h.run('M.pause=true');const before=h.run('JSON.stringify([M,pitchV73,ManagerStoryLive3D.time])');h.run('ManagerStoryLive3D.step(2,2300)');assert.equal(h.run('JSON.stringify([M,pitchV73,ManagerStoryLive3D.time])'),before);
});
test('one engine minute drains before another is generated; real snapshots do not enter saved events',()=>{
 const h=setup(true);h.run('for(let i=0;i<2700;i++)ManagerStoryLive3D.step(1/60,i*1000/60)');
 const logs=h.run('ManagerStoryLive3D.logs');assert.ok(logs.length>=5);assert.ok(logs.some(e=>!e.success));assert.ok(logs.some(e=>e.metres>25));assert.ok(logs.every(e=>e.actualScreenDuration>=e.duration*4-.03));
 assert.equal(h.run('M.events.some(e=>e.enginePositions!=null)'),false);
 assert.ok(h.run('pitchV73.queue.every(e=>e.gameSecond===M.min*60)'));
});
test('readable tempo and speed preserve the same seeded decisions and scores through a complete match',()=>{
 const base=setup();playToEnd(base);
 const live=setup(true);let guard=0;
 while(!live.run('M.finished')&&guard++<180000){
  live.run(`M.speed=${guard%300<100?.5:guard%300<200?1:2};ManagerStoryLive3D.step(.1,0)`);
  if(live.run('M.pause')&&!live.run('M.finished')){
   if(live.run('M.reason')==='half')live.run('startSecondHalf()');
   else if(live.run('M.reason')==='injury'){
    const literal=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = ('[^\n]+');/)[1];
    live.run(require('node:vm').runInNewContext(literal));
   }else live.run('resumeLive()');
  }
 }
 assert.ok(live.run('M.finished'));
 assert.equal(live.run('JSON.stringify([M.events,M.hg,M.ag,M.stats])'),base.run('JSON.stringify([M.events,M.hg,M.ag,M.stats])'));
});
test('live poses keep real adapter roots and reuse identical pose/camera while paused',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');const sample=createLivePoseSampler(),h=setup(true);
 h.run('ManagerStoryLive3D.step(.1,100)');sample(h.run('MatchView.read()'));
 h.run('ManagerStoryLive3D.step(.1,200)');const snapshot=h.run('MatchView.read()'),pose=sample(snapshot);
 for(const p of snapshot.players){const v=pose.poses.find(x=>x.id===p.id&&x.side===p.side),xy=p.displayPosition||p.enginePosition;assert.ok(Math.abs(v.position[0]-(xy[0]/100-.5)*105)<1e-9);assert.ok(Math.abs(v.position[2]-(xy[1]/100-.5)*68)<1e-9);}
 assert.equal(sample(snapshot),pose);
});

test('joining an already active legacy event preserves progress and stays finite',()=>{
 const h=setup(false);h.run('pitchFrameState(.1,100);ManagerStoryLive3D.enable()');const p=h.run('pitchV73.progress');h.run('ManagerStoryLive3D.step(.1,200)');assert.ok(h.run('Number.isFinite(pitchV73.progress)'));assert.ok(h.run('pitchV73.progress')>=p);
});
test('presentation score/statistics are real event snapshots, without changing the atomic engine result',()=>{
 const h=setup(true);h.run('for(let i=0;i<2800;i++)ManagerStoryLive3D.step(1/60,i*1000/60)');
 assert.ok(h.run('pitchV73.eventScore[0]<=M.hg'));assert.equal(h.run('M.events.some(e=>e.engineStatistics)'),false);
 assert.ok(h.run('pitchV73.eventStatistics.shots[0]<=M.shots[0]'));
});

test('actual recipient faces the incoming ball by arrival, without a synthetic root trajectory',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');const h=setup(true);h.run('advanceLive(60/90)');const s=structuredClone(h.run('MatchView.read()')),e=h.run("M.events.find(e=>e.type==='pass')");s.presentation={activeEvent:e,progress:.19,seconds:1};const sampler=createLivePoseSampler();sampler(s);s.presentation.progress=.76;s.presentation.seconds=2;const v=sampler(s).poses.find(p=>p.id===e.toId&&p.side===e.toSide),dx=(e.toPos[0]-e.fromPos[0])*1.05,dz=(e.toPos[1]-e.fromPos[1])*.68;assert.ok(Math.abs(Math.atan2(Math.sin(v.yaw-Math.atan2(-dx,-dz)),Math.cos(v.yaw-Math.atan2(-dx,-dz))))<1e-9);
});
