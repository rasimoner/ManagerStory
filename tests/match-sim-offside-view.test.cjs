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
