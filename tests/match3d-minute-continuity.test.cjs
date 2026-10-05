const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./engine-harness.cjs');
let data;async function results(){if(!data){const {audit}=await import('../tools/match3d-minute-audit.mjs');data={before:audit(true),after:audit(false)};}return data;}
test('seed 8800: kickoff plus four minute boundaries and six passes remove idle and endpoint jumps without changing results',async()=>{
 const {before,after}=await results();assert.deepEqual(after.passes.map(p=>p.eventId),[3,5,7,9,11,12]);assert.ok(after.minutes.length>=2);
 assert.ok(before.technicalIdleSeconds>10);assert.ok(after.technicalIdleSeconds<.1);assert.ok(Math.abs(before.maxBoundaryJumpMetres-3.15)<1e-9);assert.ok(after.maxBoundaryJumpMetres<=.02);assert.ok(after.maxRootSpeed<=6.01);assert.ok(after.maxOwnedBallRootGapMetres<=.02);
 assert.ok(after.minutes.every(m=>m.rawLead<=60&&m.rawLead>=0));assert.ok(after.maxEngineLeadGameSeconds<=60);assert.ok(after.maxQueueAgeSeconds<14);assert.equal(after.maxQueue,before.maxQueue);
 assert.deepEqual(after.events,before.events);assert.deepEqual(after.finalStats,before.finalStats);
 const waiting=after.kickoff.filter(k=>k.type==='kickoff'&&k.progress<.19);assert.ok(waiting.length>0);assert.ok(waiting.every(k=>Math.hypot(k.ball[0]-50,k.ball[1]-50)<1e-9));assert.ok(after.kickoff.every(k=>Math.hypot(k.ball[0]-50,k.ball[1]-50)<1e-9));
});
test('minute sample has an explicit before/after interval; pause and speed preserve the joint phase',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();for(let n=1;n<2000;n++){h.run(`ManagerStoryLive3D.step(.01,${n*10})`);if(h.run("pitchV73.active?.sampleInterval?.phase==='after-position-update-before-action-decisions'"))break;}
 const s=h.run('MatchView.read()');assert.equal(s.presentation.positionSamples.fromGameSecond,0);assert.equal(s.presentation.positionSamples.toGameSecond,60);assert.equal(s.presentation.positionSamples.phase,'after-position-update-before-action-decisions');assert.ok(s.presentation.matchSeconds>=0&&s.presentation.matchSeconds<60);
 const held=h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,pitchV73.displayMatchSeconds,ManagerStoryLive3D.time])');h.run('M.pause=true;ManagerStoryLive3D.step(3,6000)');assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,pitchV73.displayMatchSeconds,ManagerStoryLive3D.time])'),held);
 h.run('M.pause=false;setMatchSpeed(2);setMatchSpeed(.5);setMatchSpeed(1)');assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,pitchV73.displayMatchSeconds,ManagerStoryLive3D.time])'),held);
 const p=h.run('pitchV73.progress'),D=h.run('pitchV73.activeDuration');h.run('setMatchSpeed(2);ManagerStoryLive3D.step(.01,6010)');assert.ok(Math.abs(h.run('pitchV73.progress')-p-.005/D)<1e-9);assert.equal(h.run('M.min'),1);
});
test('no future minute prefetch: an input received during the committed batch is read by the next uncomputed minute',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();let now=0;while(h.run('M.min')<1){now+=10;h.run(`ManagerStoryLive3D.step(.01,${now})`);}
 const committed=h.run('JSON.stringify(M.events)');h.run('M.mentality=2');assert.equal(h.run('JSON.stringify(M.events)'),committed);
 const baseline=harness();baseline.run('S=fresh();init();startMatch();resumeLive();advanceLive(60/90);M.mentality=2;advanceLive(60/90)');
 let guard=0;while(h.run('M.min')<2&&guard++<4000){now+=10;h.run(`ManagerStoryLive3D.step(.01,${now})`);}
 assert.equal(h.run('M.min'),2);assert.equal(h.run('JSON.stringify([M.events,M.hg,M.ag,M.stats])'),baseline.run('JSON.stringify([M.events,M.hg,M.ag,M.stats])'));
});
