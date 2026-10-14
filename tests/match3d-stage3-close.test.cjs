const test=require('node:test'),assert=require('node:assert/strict');let data;async function audit(){return data??=(await import('../tools/match3d-stage3-close-audit.mjs')).audit();}
test('real seed1 gain/failed shield/loose/recovery separates roots without changing motor or ball endpoints',async()=>{
 const a=await audit();assert.equal(a.preserved,true);assert.equal(a.metadataLeak,false);assert.equal(a.earlyOwnerChanges,0);assert.ok(a.maxSpeed<=6);assert.ok(a.minSeparation>=.699999);assert.ok(a.boundaries.every(b=>b.ballStep<=.02&&b.rootStep<=.02));
 for(const id of [3,6,8]){const p=a.phases.find(p=>p.eventId===id&&p.threshold===.76);assert.ok(p.toeBall<=.22);assert.equal(p.owner,id===3?'o10':id===6?null:6);}
 assert.equal(a.phases.find(p=>p.eventId===7&&p.threshold===.76).owner,null);assert.equal(a.visited.filter(id=>[4,5].includes(id)).length,0);assert.equal(a.visited.filter(id=>id===6).length,1);
 assert.ok(a.phases.find(p=>p.eventId===8&&p.threshold===.76).winnerGap<=.02);
});
test('hold/release/recovery offset and shared pose are frozen on pause, rates use one clock',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();h.run('M.rand=R(1);window.wall=0');
 for(const [id,target] of [[6,.65],[6,.85],[7,.5],[8,.65],[8,.85]]){
  h.run(`{let guard=0;while(guard++<20000){if(pitchV73.active?.eventId===${id}&&pitchV73.progress>=${target})break;wall+=.01;ManagerStoryLive3D.step(.01,wall*1000)}if(guard>=20000)throw Error('Missing phase')}`);
  const expr='JSON.stringify([MatchView.read().players,MatchView.read().ball,MatchView.read().presentation.holdMotion,pitchV73.progress,ManagerStoryLive3D.time])',held=h.run(expr);h.run('M.pause=true');for(const speed of [.5,1,2]){h.run(`setMatchSpeed(${speed});ManagerStoryLive3D.step(1,999999)`);assert.equal(h.run(expr),held);}h.run('M.pause=false');
  for(const speed of [.5,1,2]){h.run(`setMatchSpeed(${speed})`);const p=h.run('pitchV73.progress'),D=h.run('pitchV73.activeDuration');h.run('wall+=.001;ManagerStoryLive3D.step(.001,wall*1000)');assert.ok(Math.abs(h.run('pitchV73.progress')-p-.001*speed/8/D)<1e-8);}h.run('setMatchSpeed(1)');
 }
 assert.equal(h.run('M.events.some(e=>e.shield||e.offsetTracks||e.visualOffsets)'),false);
 assert.equal(h.run('Object.isFrozen(MatchView.read().players[0].visualOffset)'),true);
});
