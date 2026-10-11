const test=require('node:test'),assert=require('node:assert/strict');
function frame(t,x,sign=1,role='CM',active=null){return {presentation:{seconds:t,activeEvent:active,progress:.5,duration:1,carryMotion:active?{touchPhase:.5}:null},matchSeconds:t,ball:{displayPosition:[90,90],engine:{position:[90,90]},presentationHeight:.15,displayOwnerId:null,displaySide:'none'},players:[{id:1,side:'user',role,attackDirection:sign,displayPosition:[50+x/1.05,50]}]};}
test('low-speed soles follow travelled distance, planted feet stay still, and an airborne foot settles on stopping',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 for(const sign of [-1,1])for(const speed of [.1,.5,1,4,12]){const sample=createLivePoseSampler();let old,settled;
 for(let i=0;i<120;i++){const p=sample(frame(i*.02,sign*speed*i*.02,sign)).poses[0];assert.ok(p.gait.cyclesPerSecond<=4.00001);if(i&&speed<=.5){assert.ok(p.gait.stride<=.200001);for(const f of [p.leftFoot,p.rightFoot])assert.ok(Math.hypot(f[0]-p.position[0],f[2]-p.position[2])<.19,'no giant slow step');}if(old){assert.ok(Math.abs(p.gait.phase-old.gait.phase-Math.abs(p.position[0]-old.position[0])/p.gait.stride)<1e-8);}old=p;}
 const before=old;
 for(let i=120;i<240;i++)settled=sample(frame(i*.02,sign*speed*119*.02,sign)).poses[0];
 for(const name of ['leftFoot','rightFoot'])if(before[name][1]<=.091){assert.equal(settled[name][0],before[name][0]);assert.equal(settled[name][2],before[name][2]);}
 assert.equal(settled.gait.phase,before.gait.phase);assert.equal(settled.gait.speed,0);for(const f of [settled.leftFoot,settled.rightFoot])assert.ok(f[1]<.091);
 assert.equal(sample(frame(239*.02,sign*speed*119*.02,sign)),sample(frame(239*.02,sign*speed*119*.02,sign)));
 }
});
test('open-play turn preserves common roots and distance-based gait without adding a stop',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 for(const sign of [-1,1]){const sample=createLivePoseSampler(),e={type:'ballCarry',eventId:1,fromId:99,fromSide:'opp',fromPos:[50,50],toPos:[40,50]};let old;
 for(let i=0;i<120;i++){const x=sign*(i<60?i:120-i)*.02,s=frame(i*.02,x,sign,'CM',e),p=sample(s).poses[0];assert.ok(Math.abs(p.position[0]-x)<1e-8);assert.ok(p.position.every(Number.isFinite));if(old)assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw-old.yaw),Math.cos(p.yaw-old.yaw)))<.68);old=p;}
 }
});
