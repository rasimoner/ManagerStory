const test=require('node:test');const assert=require('node:assert/strict');
const {sceneFixture}=require('./support/simulation-scene.cjs');

test('offside reuses the yellow pitch line and notification without writing to its frame',async()=>{
 const scene=await sceneFixture(),world=new scene.THREE.Scene();
 const view=scene.api.createSimulationOffsideLine(world);
 const frame={physicsTime:12,contacts:[{type:'offside',lineX:40,time:12}]};
 const before=JSON.stringify(frame);view.paint(frame);
 const line=world.children[0];assert.equal(line.visible,true);assert.equal(line.position.x,40);
 assert.equal(line.material.color.getHexString(),'ffd400');assert.equal(scene.api.simulationSceneCaption(frame).text,'OFSAYT');
 assert.equal(JSON.stringify(frame),before);view.paint({...frame,physicsTime:15});assert.equal(line.visible,false);
});

test('the real offside line and offender receive the legacy high camera in either phone aspect',async()=>{
 const scene=await sceneFixture();
 const frame={physicsTime:12,contacts:[{type:'offside',lineX:40,time:12,fromId:'f',fromPos:{x:43,y:0}}],
  players:[{id:'f',teamId:'home',direction:1,position:{x:43,y:0,z:0}}],
  ball:{position:{x:43,y:.11,z:0},ownerId:null,teamId:'away'}};
 const shot=scene.api.simulationCameraShot(frame,'auto');assert.equal(shot.mode,'stand');assert.ok(shot.framePoints.some(p=>p.x===40));
 for(const aspect of [390/844,844/390]){
  const camera=new scene.THREE.PerspectiveCamera();scene.api.createSimulationCamera(camera).update(frame,0,{aspect,mode:'auto'});camera.updateMatrixWorld(true);
  for(const point of shot.framePoints){const p=point.clone().project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1);}
 }
});
