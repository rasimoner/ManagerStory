const test=require('node:test'),assert=require('node:assert/strict');
let result;
async function get(){if(!result){const {audit}=await import('../tools/match3d-continuity-audit.mjs');result={before:audit(true),after:audit(false)};}return result;}
test('seed 8800: selected real pass #11 and six consecutive passes meet root/contact/arrival tolerances',async()=>{
 const {before,after}=await get();assert.equal(after.seed,8800);assert.equal(after.passes.length,6);
 const old=before.passes.find(p=>p.eventId===11),fixed=after.passes.find(p=>p.eventId===11);assert.ok(old.rawRootGap>9.5);assert.equal(fixed.rawRootGap,0);
 for(const p of after.passes){assert.ok(p.rawRootGap<=.02);assert.ok(p.boundaryBallStepMetres<=.02);assert.ok(p.contact.rootGapMetres<=.02);assert.ok(p.contact.toeBallMetres<=.22);assert.ok(p.arrival.rootGapMetres<=.02);assert.ok(p.arrival.toeBallMetres<=.22);assert.ok(p.maxPreparationRootSpeed<=6+.001);assert.equal(p.contact.owner,null);assert.equal(p.arrival.owner,p.event.toId);}
 assert.deepEqual(JSON.parse(JSON.stringify(after.events)),JSON.parse(JSON.stringify(before.events)));
});
test('derived transition moves actual roots with the owned ball and has a bounded peak speed at /4',async()=>{
 const {after}=await get();const selected=after.passes.find(p=>p.eventId===11),t=after.transitions.find(t=>t.event.toPos[0]===selected.event.fromPos[0]);
 assert.equal(t.event.carryId,selected.event.fromId);assert.equal(t.event.endOwner,selected.event.fromId);assert.ok(t.event.maxMovementMetres*1.5/(t.event.presentationDuration*4)<=6+.001);
 const {setup}=await import('../tools/match3d-continuity-audit.mjs');const h=setup();let checked=false;
 for(let n=0;n<9000;n++){h.run(`ManagerStoryLive3D.step(.01,${n*10})`);if(h.run("pitchV73.active?.type==='enginePositionGap'&&pitchV73.active.carryId==='o7'")){
 const gap=h.run("Math.hypot((pitchV73.ball[0]-pitchV73.positions.o7[0])*1.05,(pitchV73.ball[1]-pitchV73.positions.o7[1])*.68)");assert.ok(gap<=.02);checked=true;break;}}
 assert.ok(checked);
});
test('event queue owns its point arrays; pause and speed changes do not restart a transition',async()=>{
 const {setup}=await import('../tools/match3d-continuity-audit.mjs');const h=setup();h.run('advanceLive(60/90)');
 const before=h.run("JSON.stringify(pitchV73.queue.find(e=>e.type==='pass'))");h.run("const queuedPass=pitchV73.queue.find(e=>e.type==='pass');const originalPass=M.events.find(e=>e.eventId===queuedPass.eventId);originalPass.fromPos[0]+=100;originalPass.toPos[1]+=100;");assert.equal(h.run("JSON.stringify(pitchV73.queue.find(e=>e.type==='pass'))"),before);
 const clean=setup();for(let n=0;n<9000;n++){clean.run(`ManagerStoryLive3D.step(.01,${n*10})`);if(clean.run("pitchV73.active?.type==='enginePositionGap'"))break;}
 clean.run('M.pause=true');const held=clean.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,ManagerStoryLive3D.time])');clean.run('ManagerStoryLive3D.step(1,90000)');assert.equal(clean.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,ManagerStoryLive3D.time])'),held);
 clean.run('M.pause=false;setMatchSpeed(2);setMatchSpeed(.5);setMatchSpeed(1)');assert.equal(clean.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,ManagerStoryLive3D.time])'),held);
});
