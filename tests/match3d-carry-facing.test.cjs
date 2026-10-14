const test=require('node:test'),assert=require('node:assert/strict');
test('carrying boot contact stays on the ball while the body turns in either attack direction',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 const {createFootballer}=await import('../dist/match3d-player.js');
 const {poseFootballer}=await import('../dist/match3d-football-pose.js');
 const T=await import('../dist/vendor/three/three.module.min.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 const model=createFootballer({id:7,side:'user',number:7,kit:{primaryColor:'#ffdd00',secondaryColor:'#cc0000'}});
 let samples=0,maxGap=0,minBootClearance=Infinity;
 for(const sign of [-1,1])for(const heading of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]){
  const sample=createLivePoseSampler();
  for(let i=0;i<30;i++){
   const t=i*.02,x=sign*.3*t,z=Math.sin(t)*.03,position=[50+x/1.05,50+z/.68];
   const e={type:'dribble',eventId:1,fromId:7,fromSide:'user',fromPos:position,toPos:[position[0]+Math.sin(heading)*10,position[1]+Math.cos(heading)*10]};
   const s={presentation:{seconds:t,progress:.01+i*.001,duration:2,activeEvent:e,carryMotion:{touchPhase:0}},matchSeconds:t,ball:{displayPosition:position,presentationHeight:.15,displayOwnerId:7,displaySide:'user'},players:[{id:7,side:'user',role:'CM',attackDirection:sign,displayPosition:position}]};
   const unchanged=JSON.stringify(s),v=sample(s),p=v.poses[0],c=poseFootballer(model,p),ball=new T.Vector3(...v.ball),gap=c.rightToe.distanceTo(ball);
   assert.ok(gap<.24,`body/path mismatch: ${gap}`);maxGap=Math.max(maxGap,gap);
   assert.ok(c.rightAnkle.distanceTo(new T.Vector3(...p.rightFoot))<1e-5,'ankle reaches target');
   assert.ok(model.userData.bones.pelvis.position.y>.85,'no deep pelvis collapse');
   const mesh=model.children.find(x=>x.isSkinnedMesh),g=mesh.geometry,bone=mesh.skeleton.bones.indexOf(model.userData.bones.rightAnkle);mesh.skeleton.update();
   for(let j=0;j<g.attributes.position.count;j++)if(g.attributes.skinIndex.getX(j)===bone)minBootClearance=Math.min(minBootClearance,mesh.localToWorld(mesh.getVertexPosition(j,new T.Vector3())).distanceTo(ball));
   assert.equal(JSON.stringify(s),unchanged,'presentation correction cannot move common roots or ball');samples++;
  }
 }
 assert.ok(minBootClearance>=.14,'contact boot must not intersect ball volume');
 console.log(JSON.stringify({samples,maxGap,minBootClearance}));
});
