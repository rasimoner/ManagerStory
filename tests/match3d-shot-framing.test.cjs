const test=require('node:test'),assert=require('node:assert/strict');
test('shot anticipation keeps late-flight ball, keeper and goal inside both portrait frames without outcome branching',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js'),T=await import('../dist/vendor/three/three.module.min.js');const h=setup(),sample=createLivePoseSampler(),checked=new Set();h.run('M.rand=R(8800)');let last=null,maxStep=0;
 for(let n=1;n<30000;n++){
  h.run(`ManagerStoryLive3D.step(.02,${n*20})`);const s=h.run('MatchView.read()'),v=sample(s),e=s.presentation.activeEvent,f=s.presentation.shotMotion;
  if(!f||![14,49,115].includes(e.eventId)){last=null;continue;}
  if(last){maxStep=Math.max(maxStep,Math.hypot(...v.camera.focus.map((x,i)=>x-last.focus[i])));assert.ok(v.camera.span>=last.span-1e-8,'no repeated zoom-in during shot');}last=v.camera;
  const u=(f.progress-.19)/.57;if(u<.65||u>1)continue;
  for(const aspect of [390/545,320/269]){
   const focus=new T.Vector3(...v.camera.focus),camera=new T.PerspectiveCamera(45,aspect,.1,320);camera.position.set(focus.x,24,focus.z+38);camera.lookAt(focus);camera.fov=T.MathUtils.radToDeg(2*Math.atan(v.camera.span/aspect*.5/camera.position.distanceTo(focus)));camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const dir=e.toPos[0]>50?1:-1,keeper=v.poses.find(x=>x.id===e.goalkeeperId),points=[v.ball,keeper.position,...[-3.66,3.66].map(z=>[dir*52.5,2.44,z])];
   for(const point of points){const p=new T.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<=.92&&Math.abs(p.y)<=.92,`shot${e.eventId} u${u} outside safe frame ${p.x},${p.y}`);}
  }checked.add(e.eventId);if(checked.size===3&&e.eventId===115&&u>.98)break;
 }
 assert.deepEqual([...checked],[14,49,115]);assert.ok(maxStep<.35,`camera frame step ${maxStep}`);
});
