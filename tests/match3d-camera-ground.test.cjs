const test=require('node:test'),assert=require('node:assert/strict');
test('portrait frustum ground limits stay ordered and all corners within playing apron, close view unchanged when safe',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js'),T=await import('../dist/vendor/three/three.module.min.js');
 let count=0,oldCrossed=0;
 for(const aspect of [.35,.45,.55,.75,1,1.5])for(const xy of [[0,0],[100,0],[0,100],[100,100],[50,50]]){
  const sample=createLivePoseSampler();for(let n=0;n<50;n++){
   const s={presentation:{seconds:n*.02,progress:.7,activeEvent:{type:'pass',eventId:1,fromId:1,fromSide:'user',toId:2,toSide:'user',fromPos:xy,toPos:xy}},matchSeconds:n*.02,ball:{displayPosition:xy,displayOwnerId:null,displaySide:'user'},players:[]};
   const unchanged=JSON.stringify(s),v=sample(s,{aspect});assert.equal(JSON.stringify(s),unchanged);
   const f=new T.Vector3(...v.camera.focus),camera=new T.PerspectiveCamera(45,aspect,.1,320);camera.position.set(f.x,24,f.z+38);camera.lookAt(f);camera.fov=T.MathUtils.radToDeg(2*Math.atan(v.camera.span/aspect*.5/camera.position.distanceTo(f)));camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const d=Math.hypot(24,38),t=v.camera.span/(2*d*aspect),far=d*d*t/(24-38*t),near=d*d*t/(24+38*t);assert.ok(-35.8+far<=36-near+1e-8);
   const original=Math.min(12,2*d*Math.tan(22*Math.PI/180)*aspect),t0=original/(2*d*aspect);if(d*d*t0/(24-38*t0)+d*d*t0/(24+38*t0)>71.8)oldCrossed++;
   if(aspect>=.55)assert.equal(v.camera.span,12,'usual close scale retained');
   for(const x of [-1,1])for(const y of [-1,1]){const end=new T.Vector3(x,y,.5).unproject(camera),ray=end.sub(camera.position).normalize(),p=camera.position.clone().addScaledVector(ray,-camera.position.y/ray.y);assert.ok(Math.abs(p.x)<=57.3+1e-8);assert.ok(p.z>=-35.8-1e-8&&p.z<=36+1e-8);count++;}
  }
 }
 assert.ok(oldCrossed>0);assert.equal(count,6000);
});
test('real two-match mobile camera samples preserve world poses and motor outputs',async()=>{
 const {setup,full}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 for(const seed of [1,8800]){const h=setup();h.run('window.qaCameraFrames=[];MatchView.subscribe(s=>{if(s.presentation.activeEvent)qaCameraFrames.push(structuredClone(s))})');const after=full(h,seed),before=full(setup(true,'74294822843e8feb4940cfc82d3edc7b239eaa91'),seed);assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.equal(after.singleResult,true);assert.equal(after.pending,false);
  for(const aspect of [.45,.55,.75,1]){const sampler=createLivePoseSampler();for(const s of h.run('qaCameraFrames')){const raw=JSON.stringify(s),v=sampler(s,{aspect}),d=Math.hypot(24,38),t=v.camera.span/(2*d*aspect),far=d*d*t/(24-38*t),near=d*d*t/(24+38*t);assert.equal(JSON.stringify(s),raw);assert.ok(far+near<=71.8+1e-8);assert.ok(v.camera.focus[2]>=-35.8+far-1e-8&&v.camera.focus[2]<=36-near+1e-8);assert.ok(v.camera.span<=18);}}
 }
});
