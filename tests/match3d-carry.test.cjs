const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./engine-harness.cjs');
test('seed 1 real carry route stays with player, limits speed and preserves engine events and statistics',async()=>{
 const {audit}=await import('../tools/match3d-carry-audit.mjs'),a=audit();assert.ok(a.events.some(e=>e.success===true));assert.ok(a.events.some(e=>e.success===false));
 assert.ok(a.maxCarrySpeed<=6.01);assert.ok(a.maxCarryBoundary<=.02);for(const e of a.events){assert.ok(e.maxRootBall<=.181);assert.ok(e.contacts>=3);}
 const h=harness();h.run(`S=fresh();init();startMatch();M.rand=R(1);resumeLive();for(let i=0;i<${a.minute};i++)advanceLive(60/90)`);
 assert.equal(JSON.stringify(a.engineEvents),h.run('JSON.stringify(M.events)'));assert.equal(JSON.stringify(a.stats),h.run('JSON.stringify(M.stats)'));
});
test('shared carry phase and ball do not restart under pause or speed selection',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();h.run('M.rand=R(1)');let n=0;while(n++<20000){h.run(`ManagerStoryLive3D.step(.01,${n*10})`);if(h.run("pitchV73.carryMotion?.travelMetres>1"))break;}assert.ok(n<20000);
 const held=h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,pitchV73.carryMotion,ManagerStoryLive3D.time])');h.run('M.pause=true;ManagerStoryLive3D.step(2,999999);setMatchSpeed(2);setMatchSpeed(.5);setMatchSpeed(1)');
 assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.progress,pitchV73.carryMotion,ManagerStoryLive3D.time])'),held);
 h.run('M.pause=false;setMatchSpeed(2)');const before=h.run('pitchV73.progress'),D=h.run('pitchV73.activeDuration');h.run('ManagerStoryLive3D.step(.01,1000000)');assert.ok(Math.abs(h.run('pitchV73.progress')-before-.005/D)<1e-9);
});
