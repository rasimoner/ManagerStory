const test=require('node:test'),assert=require('node:assert/strict');
test('existing side-camera keeps both approaching contest actors in both portrait fields',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js'),T=await import('../dist/vendor/three/three.module.min.js');const h=setup(),sample=createLivePoseSampler(),checked=new Set();h.run('M.rand=R(1)');
 for(let n=1;n<7000;n++){
  h.run(`ManagerStoryLive3D.step(.01,${n*10})`);const s=h.run('MatchView.read()'),pose=sample(s),c=s.presentation.contestMotion;if(!c||s.presentation.progress<.3||checked.has(s.presentation.activeEvent.eventId))continue;
  for(const aspect of [390/540,320/280]){
   const focus=new T.Vector3(...pose.camera.focus),camera=new T.PerspectiveCamera(45,aspect,.1,320);camera.position.set(focus.x,24,focus.z+38);camera.lookAt(focus);camera.fov=T.MathUtils.radToDeg(2*Math.atan(pose.camera.span/aspect*.5/camera.position.distanceTo(focus)));camera.updateProjectionMatrix();camera.updateMatrixWorld();
   for(const id of [c.attackerId,c.defenderId]){const p=pose.poses.find(p=>p.id===id),v=new T.Vector3(...p.position).project(camera);assert.ok(Math.abs(v.x)<.95&&Math.abs(v.y)<.95,`${id} outside approach frame: ${v.x},${v.y}`);}
  }checked.add(s.presentation.activeEvent.eventId);if(checked.size===2)break;
 }assert.deepEqual([...checked],[18,21]);
});
