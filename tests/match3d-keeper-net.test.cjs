const test=require('node:test'),assert=require('node:assert/strict');
test('real save49→51 keeps captured ball at hand height until real pass53 release',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js'),T=await import('../dist/vendor/three/three.module.min.js');
 const h=setup();h.run('M.rand=R(8800);ManagerStoryLive3D.setTempo(1);for(let i=0;i<20000;i++){ManagerStoryLive3D.step(.01,0);if(pitchV73.active?.eventId===53)break;}if(pitchV73.active?.eventId!==53)throw Error("No real goalkeeper pass53");ManagerStoryLive3D.step((.19-pitchV73.progress)*pitchV73.activeDuration,0);');
 const s=h.run('MatchView.read()'),e=s.presentation.activeEvent,v=createLivePoseSampler()(s),p=v.poses.find(p=>p.id===e.fromId&&p.side===e.fromSide);assert.equal(s.players.find(x=>x.id===e.fromId&&x.side===e.fromSide).role,'GK');
 global.document={createElement:()=>({width:256,height:256,getContext:()=>({fillText(){}})})};const m=createFootballer({id:p.id,side:p.side,number:1,kit:s.teams.home,goalkeeper:true});assert.ok(s.presentation.keeperDistribution);assert.equal(s.presentation.keeperDistribution.height,1.05);assert.ok(p.keeperMotion);assert.ok(poseFootballer(m,p).rightHand.distanceTo(new T.Vector3(...v.ball))<.20);
});
test('keeper clothing honors supplied kit or deterministically contrasts with both field kits',async()=>{
 const {keeperKit}=await import('../dist/match3d-keeper.js');const kit={primaryColor:'#ffff00',secondaryColor:'#cc0022'},other={primaryColor:'#22aa44',secondaryColor:'#ffffff'};
 const a=keeperKit(kit,other);assert.deepEqual(a,keeperKit(kit,other));assert.ok(![...Object.values(kit),...Object.values(other)].includes(a.primaryColor));
 assert.equal(keeperKit({...kit,goalkeeperKit:{primaryColor:'#8899ff',secondaryColor:'#112233'}},other).primaryColor,'#8899ff');
});
test('both goal directions use actual engine saves and fixed anatomical bones, not rear-facing hands',async()=>{
 const {audit}=await import('../tools/match3d-keeper-net-audit.mjs');const a=audit(),saves=a.examples.filter(x=>x.outcome==='save'&&Math.abs(x.p-.76)<1e-7);
 assert.ok(saves.some(x=>x.seed===8800&&x.id===49&&x.resultId===51));assert.deepEqual([...new Set(saves.map(x=>x.goalDirection))].sort(),[-1,1]);
 for(const s of saves){assert.equal(s.height,1.05);assert.ok(s.contactGap<.2,JSON.stringify(s));for(const arm of s.limbs){assert.ok(Math.abs(arm.upper-.285)<1e-8);assert.ok(Math.abs(arm.lower-.285)<1e-8);assert.ok(arm.handForward>0,'hand points toward field/ball at contact');}}
 assert.ok(a.examples.some(x=>x.saveType==='PARRY'));// DEFLECT_CORNER is not present in these real seeds; do not claim coverage.

 console.log('Real keeper contacts',JSON.stringify(saves.map(x=>({seed:x.seed,id:x.id,result:x.resultId,type:x.saveType,dir:x.goalDirection,gap:x.contactGap}))));
});
test('local net bends only after actual goal contact, damps, leaves opposite net and posts fixed',async()=>{
 const {netDisplacement}=await import('../dist/match3d-net.js');for(const dir of [-1,1]){const hit={dir,point:[dir*54.8,.15,.2],seconds:3};
 assert.equal(netDisplacement(hit.point,hit,2.99,dir),0);assert.equal(netDisplacement(hit.point,hit,3,dir),0);assert.ok(Math.abs(netDisplacement(hit.point,hit,3.07,dir))>.05);assert.ok(Math.abs(netDisplacement(hit.point,hit,3.8,dir))<.01);
 assert.equal(netDisplacement([dir*52.5,1,.2],hit,3.07,dir),0);assert.equal(netDisplacement(hit.point,hit,3.07,-dir),0);assert.equal(netDisplacement(hit.point,null,3.07,dir),0);
 }
});
