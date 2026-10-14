const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./engine-harness.cjs');
async function modules(){
 global.document={createElement:()=>({width:256,height:256,getContext:()=>({fillText(){}})})};
 return {T:await import('../dist/vendor/three/three.module.min.js'),...await import('../dist/match3d-player.js'),...await import('../dist/match3d-football-pose.js'),...await import('../dist/match3d-live-view.js')};
}
const kit={primaryColor:'#126699',secondaryColor:'#eeee11',shortName:'TEST'};
test('approved geometry is shared across 22 identities; team kits, number and toon outlines are retained',async()=>{
 const {createFootballer,T}=await modules();const players=Array.from({length:22},(_,i)=>createFootballer({id:i,side:i<11?'user':'opp',number:i%11+1,kit,variant:i,goalkeeper:i%11===0}));
 const meshes=players.map(p=>p.children.find(x=>x.isSkinnedMesh));assert.ok(meshes.every(m=>m.geometry===meshes[0].geometry));assert.equal(new Set(players.map(p=>p.userData.id)).size,22);assert.equal(meshes[1].material[0],meshes[2].material[0]);assert.equal(meshes[1].material[8],meshes[21].material[8]);
 assert.equal(meshes[1].material[0].color.getHexString(),'126699');assert.equal(meshes[1].material[1].color.getHexString(),'eeee11');assert.ok(meshes[1].material[0] instanceof T.MeshToonMaterial);assert.equal(meshes[1].material[8].side,T.BackSide);
 assert.equal(players[21].userData.number,11);assert.equal(players[1].userData.model,'approved-player-33a2cda');
});
test('side-plane knee bend and actual skinned sole remain anatomical for stance, lift, preparation and follow-through',async()=>{
 const {T,createFootballer,poseFootballer}=await modules();const root=createFootballer({id:1,side:'user',number:7,kit});const b=root.userData.bones,mesh=root.children.find(x=>x.isSkinnedMesh);
 for(const z of [-.40,-.20,0,.20,.40])for(const lift of [0,.10,.22]){
  const contacts=poseFootballer(root,{position:[0,0,0],yaw:0,leftFoot:[-.10,.09,0],rightFoot:[.10,.09+lift,z]});
  const hip=b.rightHip.getWorldPosition(new T.Vector3()),knee=b.rightKnee.getWorldPosition(new T.Vector3()),ankle=b.rightAnkle.getWorldPosition(new T.Vector3());const axis=ankle.clone().sub(hip),projection=hip.clone().addScaledVector(axis,knee.clone().sub(hip).dot(axis)/axis.lengthSq());
  assert.ok(knee.z-projection.z>=-.00001,`backwards knee z=${z}, lift=${lift}`);assert.ok(Math.abs(ankle.distanceTo(knee)-.435)<1e-8);assert.ok(Math.abs(hip.distanceTo(knee)-.445)<1e-8);
  const up=new T.Vector3(0,1,0).applyQuaternion(b.rightAnkle.getWorldQuaternion(new T.Quaternion()));assert.ok(up.y>.99999,'ankle remains level');assert.ok(contacts.rightAnkle.distanceTo(new T.Vector3(.10,.09+lift,z))<1e-6);
  mesh.skeleton.update();let min=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++)if(mesh.geometry.attributes.skinIndex.getX(i)===15){min=Math.min(min,mesh.getVertexPosition(i,new T.Vector3()).y);}assert.ok(min>=-1e-6,`sole penetrates ground ${min}`);
 }
});
test('real engine samples use the actual approved mesh: kick, carry, contest, header and goalkeeper contacts',async()=>{
 const {T,createFootballer,poseFootballer,createLivePoseSampler}=await modules();const {setup}=await import('../tools/match3d-minute-audit.mjs');
 const kinds=new Set(),measurements=[];
 function surfaceDistance(model,ball,boneNames,near=null){const mesh=model.children.find(x=>x.isSkinnedMesh),g=mesh.geometry;mesh.skeleton.update();const ids=boneNames.map(n=>mesh.skeleton.bones.indexOf(model.userData.bones[n]));let closest=Infinity;for(let i=0;i<g.attributes.position.count;i++){if(!ids.includes(g.attributes.skinIndex.getX(i)))continue;const vertex=mesh.localToWorld(mesh.getVertexPosition(i,new T.Vector3()));if(near&&vertex.distanceTo(near)>.035)continue;closest=Math.min(closest,vertex.distanceTo(new T.Vector3(...ball)));}assert.ok(Number.isFinite(closest));return closest;}
 for(const seed of [1,10]){
  const h=setup();h.run(`M.rand=R(${seed})`);const sampler=createLivePoseSampler(),models=new Map();
  // Existing deterministic presentation protocol, no new decisions or scheduler.
  for(let i=0;i<12000;i++){
   h.run(`(()=>{let dt=.04;const e=pitchV73.active,p=pitchV73.progress;const boundary=[.19,.76].find(x=>x>p+1e-8);if(e&&boundary)dt=Math.min(dt,(boundary-p)*pitchV73.activeDuration*4+1e-10);ManagerStoryLive3D.step(dt,0);})()`);const s=h.run('MatchView.read()'),e=s.presentation.activeEvent;if(!e)continue;
   const view=sampler(s),p=s.presentation.progress,shot=s.presentation.shotMotion;
   for(const pose of view.poses){const key=`${pose.side}:${pose.id}`;if(!models.has(key))models.set(key,createFootballer({id:pose.id,side:pose.side,number:7,kit}));const model=models.get(key),c=poseFootballer(model,pose);
    if(pose.id===e.fromId&&pose.side===e.fromSide&&Math.abs(p-.19)<1e-7){
     const kind=shot?.header?'header':shot?'shot':['pass','cross'].includes(e.type)?'pass':null;
     if(kind&&!kinds.has(kind)){const d=(kind==='header'?c.forehead:c.rightToe).distanceTo(new T.Vector3(...view.ball));assert.ok(d<.23,`${kind} contact ${d}`);const surface=surfaceDistance(model,view.ball,kind==='header'?['head']:['rightAnkle'],kind==='header'?c.forehead:null);assert.ok(surface<.23);kinds.add(kind);measurements.push({kind,markerDistance:d,meshSurfaceDistance:surface});}
    }
    if(s.presentation.carryMotion&&pose.id===e.fromId&&s.presentation.carryMotion.touchPhase<.02){const d=c.rightToe.distanceTo(new T.Vector3(...view.ball));if(!kinds.has('carry')){assert.ok(d<.24,`carry ${d}`);kinds.add('carry');measurements.push({kind:'carry',markerDistance:d,meshSurfaceDistance:surfaceDistance(model,view.ball,['rightAnkle'])});}}
    if(shot?.result.type==='save'&&pose.id===e.goalkeeperId&&p>=.76&&p<.78&&!kinds.has('save')){const d=Math.min(c.leftHand.distanceTo(new T.Vector3(...view.ball)),c.rightHand.distanceTo(new T.Vector3(...view.ball)));assert.ok(d<.20,`hands ${d}`);kinds.add('save');measurements.push({kind:'save',markerDistance:d,meshSurfaceDistance:surfaceDistance(model,view.ball,['leftHand','rightHand'])});}
    if(s.presentation.contestMotion&&pose.id===s.presentation.contestMotion.defenderId&&p>=.76&&p<.78&&!kinds.has('contest')){const d=c.rightToe.distanceTo(new T.Vector3(...view.ball));assert.ok(d<.24,`contest ${d}`);kinds.add('contest');measurements.push({kind:'contest',markerDistance:d,meshSurfaceDistance:surfaceDistance(model,view.ball,['rightAnkle'])});}
   }
   if(seed===1&&['pass','shot','carry','save','contest'].every(x=>kinds.has(x)))break;
   if(seed===10&&kinds.has('header'))break;
  }
 }
 assert.ok(kinds.has('pass'));assert.ok(kinds.has('shot'));assert.ok(kinds.has('carry'));assert.ok(kinds.has('header'));assert.ok(kinds.has('save'));assert.ok(kinds.has('contest'));console.log('Approved mesh CPU contacts',JSON.stringify(measurements));
});
