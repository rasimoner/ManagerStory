const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./engine-harness.cjs');let result;async function audit(){return result??=(await import('../tools/match3d-shot-audit.mjs')).audit();}
test('real seed8800 shots link one real result; RNG, events, statistics and score preserved',async()=>{
 const a=await audit(),h=harness();h.run(`S=fresh();init();startMatch();M.rand=R(8800);resumeLive();for(let n=0;n<${a.minute};n++)advanceLive(60/90)`);
 assert.equal(JSON.stringify(a.events),h.run('JSON.stringify(M.events)'));assert.equal(JSON.stringify(a.stats),h.run('JSON.stringify(M.stats)'));assert.equal(a.rng,h.run('M.rand.state'));assert.equal(JSON.stringify(a.score),h.run('JSON.stringify([M.hg,M.ag])'));
 for(const [id,outcome,result] of [[14,'wide',16],[31,'save',33],[49,'save',51],[115,'goal',116]]){const r=a.rows.find(x=>x.eventId===id);assert.equal(r.outcome,outcome);assert.equal(r.resultId,result);}
 assert.ok(a.events.every(e=>!e.shotResult));
});
test('release, real keeper contact, net bounds and score threshold share one clock',async()=>{
 const a=await audit();for(const r of a.rows){assert.ok(r.preContactBallMovement<.001);assert.equal(r.earlyOwnerChanges,0);assert.equal(r.earlyScoreChanges,0);assert.ok(r.peakKeeperSpeed<=6.01);assert.ok(r.endBoundaryStep<=.02,JSON.stringify(r));const contact=r.phases.find(x=>x.threshold===.19);assert.ok(contact.toeBall<=.22);assert.ok(contact.height<.151);
 const end=r.phases.find(x=>x.threshold===.76);if(r.outcome==='save')assert.ok(end.handBall<=.15);if(r.outcome==='goal'){assert.ok(end.ball[0]>100);assert.ok(Math.abs((end.ball[1]-50)*.68)<3.52);assert.deepEqual(end.score,[1,0]);}if(r.outcome==='wide')assert.ok(Math.abs((end.ball[1]-50)*.68)>3.8);}
});
test('pause and speed changes do not restart shot or expose result early',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();h.run('M.rand=R(8800)');let n=0;while(n++<10000){h.run(`ManagerStoryLive3D.step(.02,${n*20})`);if(h.run('pitchV73.shotMotion?.progress>.3'))break;}assert.ok(n<10000);
 assert.equal(h.run('pitchV73.queue.some(e=>e.eventId===pitchV73.active.shotResult.eventId)'),false);
 const held=h.run('JSON.stringify([pitchV73.ball,pitchV73.positions,pitchV73.progress,ManagerStoryLive3D.time])');h.run('M.pause=true;ManagerStoryLive3D.step(4,999999);setMatchSpeed(.5);setMatchSpeed(2);setMatchSpeed(1)');assert.equal(h.run('JSON.stringify([pitchV73.ball,pitchV73.positions,pitchV73.progress,ManagerStoryLive3D.time])'),held);
 const p=h.run('pitchV73.progress'),D=h.run('pitchV73.activeDuration');h.run('M.pause=false;setMatchSpeed(2);ManagerStoryLive3D.step(.01,1000000)');assert.ok(Math.abs(h.run('pitchV73.progress')-p-.005/D)<1e-9);
});
