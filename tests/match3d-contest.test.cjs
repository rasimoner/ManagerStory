const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./engine-harness.cjs');let result;async function audit(){if(!result){result=(await import('../tools/match3d-contest-audit.mjs')).audit();}return result;}
test('real seed1 chains capture pre-placement defender, coalesce duplicated events and preserve outcomes/statistics',async()=>{
 const a=await audit();assert.deepEqual(a.rows.map(r=>[r.eventId,r.tackleId,r.keepsBall]),[[18,20,true],[21,23,false]]);
 const r=a.rows[1],raw=a.events.find(e=>e.eventId===22);assert.ok(Math.hypot(r.defenderStart[0]-raw.fromPos[0],r.defenderStart[1]-raw.fromPos[1])>1);
 assert.ok(a.events.every(e=>!e.contest));const h=harness();h.run(`S=fresh();init();startMatch();M.rand=R(1);resumeLive();for(let n=0;n<${a.minute};n++)advanceLive(60/90)`);
 assert.equal(JSON.stringify(a.events),h.run('JSON.stringify(M.events)'));assert.equal(JSON.stringify(a.stats),h.run('JSON.stringify(M.stats)'));assert.equal(a.rngState,h.run('M.rand.state'));
});
test('contact geometry, clearance, speed and ownership use the single event clock',async()=>{
 const a=await audit();for(const r of a.rows){assert.ok(r.minClearance>=.619999);assert.ok(r.maxRootSpeed<=6.01);assert.ok(r.maxBallStep<=.10);assert.ok(r.endBoundaryBallStep<=.02);assert.ok(r.minFollowingClearance>=.619999);assert.ok((r.maxFollowingWinnerBallGap||0)<=.02);assert.equal(r.earlyOwnerChanges,0);assert.ok(r.maxWinnerBallGapAfterControl<=.02);
 const contact=r.phases.find(x=>x.threshold===.76);assert.ok(contact.toeBallMetres<=.22);assert.equal(contact.owner,r.keepsBall?'o7':1);
 const settled=r.phases.at(-1);assert.ok(settled.clearance> (r.keepsBall?.619999:.9));}
});
test('pause and .5/1/2 changes preserve linked approach and contact without replaying press/tackle',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();h.run('M.rand=R(1)');let n=0;while(n++<15000){h.run(`ManagerStoryLive3D.step(.01,${n*10})`);if(h.run('pitchV73.contestMotion?.progress>.5&&!pitchV73.contestMotion.independent'))break;}assert.ok(n<15000);
 assert.equal(h.run('pitchV73.queue.some(e=>[19,20].includes(e.eventId))'),false);
 const held=h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.carrier,pitchV73.progress,pitchV73.contestMotion,ManagerStoryLive3D.time])');
 h.run('M.pause=true;ManagerStoryLive3D.step(4,999999);setMatchSpeed(.5);setMatchSpeed(2);setMatchSpeed(1)');
 assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.carrier,pitchV73.progress,pitchV73.contestMotion,ManagerStoryLive3D.time])'),held);
 h.run('M.pause=false;setMatchSpeed(2)');const p=h.run('pitchV73.progress'),D=h.run('pitchV73.activeDuration');h.run('ManagerStoryLive3D.step(.01,1000000)');assert.ok(Math.abs(h.run('pitchV73.progress')-p-.005/D)<1e-9);
});
