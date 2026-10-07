const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./engine-harness.cjs');
const baseline='37c04c37ad43c1eada3a43309fbf7da9ac087f86';
const files=['match-support.js','career-events.js','live-match.js','opponents-v731.js','pitch-v73.js','pitch-v731.js','app.js'];
function setup(old=false){
 const read=f=>old?execFileSync('git',['show',`${baseline}:dist/${f}`],{encoding:'utf8'}):fs.readFileSync('dist/'+f,'utf8');
 const h=harness(new Map(),files.map(read));let clock=read('match3d-live-clock.js');clock=clock.replace('state.shotPreStatistics=structuredClone(state.eventStatistics);','qaClips.push({id:state.active.eventId,type:state.active.type,linked:[state.active.shotResult?.eventId,state.active.contest?.press?.eventId,state.active.contest?.tackle?.eventId],startBall:structuredClone(state.ball),startPositions:structuredClone(state.positions),owner:state.carrier});state.shotPreStatistics=structuredClone(state.eventStatistics);').replace('if(clockProgress>=1-1e-8){','if(clockProgress>=1-1e-8){Object.assign(qaClips.at(-1),{endBall:structuredClone(state.ball),endPositions:structuredClone(state.positions),endOwner:state.carrier,duration:D});');h.run('window.qaClips=[]');h.run(clock);h.run(read('match-view-adapter.js'));h.run('S=fresh();init();startMatch();resumeLive();setMatchView("3d")');return h;
}
const state='JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress,pitchV73.ball,pitchV73.positions,ManagerStoryLive3D.time])';
test('three UI rates use exactly half the former common-clock delta in both views, delayed frames and pause',()=>{
 for(const speed of [.5,1,2])for(const view of ['2d','3d']){
  const old=setup(true),now=setup();for(const h of [old,now])h.run(`setMatchSpeed(${speed});setMatchView('${view}')`);
  for(const dt of [.01,.08,.12,2]){old.run(`ManagerStoryLive3D.step(${Math.min(.12,dt)/2},0)`);now.run(`ManagerStoryLive3D.step(${dt},0)`);assert.equal(now.run(state),old.run(state));}
  const before=now.run(state);now.run('pauseLive();setMatchSpeed(2);setMatchView("3d");ManagerStoryLive3D.step(2,0)');assert.equal(now.run(state),before);
  assert.equal(now.run('M.speed'),2);assert.equal(now.run('matchPlaybackRate()'),1);
 }
});
test('legacy RAF clock also runs at half the former wall rate without changing deterministic advanceLive API',()=>{
 for(const speed of [.5,1,2]){const h=harness();h.run(`window.requestAnimationFrame=()=>1;S=fresh();init();startMatch();resumeLive();setMatchSpeed(${speed});liveLastFrame=1000;liveFrameStep(1100)`);assert.ok(Math.abs(h.run('matchSecond()')-4.5*speed)<1e-8);}
});
test('two full slowed matches retain exact engine, RNG, career, final drain and single result',async()=>{
 const {full}=await import('../tools/match3d-round2-audit.mjs');
 for(const seed of [1,8800]){
  const old=setup(true),now=setup();
  // Run the exact prior source at half its supported 1x rate for a frame-for-frame reference.
  old.run('setMatchSpeed(.5)');const before=full(old,seed),after=full(now,seed);
  assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.wall>0);assert.ok(after.clips.length>400);
  assert.equal(after.finished,true);assert.equal(after.pending,false);assert.equal(after.singleResult,true);
  assert.equal(after.events.filter(e=>e.type==='end').length,1);
 }
 // Current motion changes have their own QA record; retain the historical speed summary.
});
