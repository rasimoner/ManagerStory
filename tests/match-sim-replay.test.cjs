const test=require('node:test');const assert=require('node:assert/strict');
const {sceneFixture}=require('./support/simulation-scene.cjs');const {labFixture,plain}=require('./support/lab.cjs');const {loadGame}=require('./support/game.cjs');

async function recordedShot() {
 const {api,input}=labFixture({seed:73});input.match=false;
 const simulation=api.createSimulation(input),striker=simulation.teams[0].players.at(-1),keeper=simulation.teams[1].players[0];
 for(const team of simulation.teams)for(const p of team.players)p.position={x:-30,y:25};
 striker.position={x:30,y:0};striker.heading=0;striker.attributes.technique=95;keeper.position={x:38,y:0};
 api.placeSimulationBall(simulation,{teamId:'home',ownerId:striker.id,position:striker.position});api.requestSimulationShot(simulation);
 const scene=await sceneFixture(),game=loadGame({quiet:true}),ball=new scene.THREE.Object3D(),camera=new scene.THREE.PerspectiveCamera();
 const replay=scene.api.createSimulationReplay(scene.runtime,ball,camera);
 for(let i=0;i<12;i++){
  const frame=game.api.sampleSimulationScene({frame:game.api.captureSimulationFrame(simulation)},{immediate:true});
  scene.actors.apply(frame);ball.position.copy(frame.ball.position);replay.record(frame);api.stepSimulation(simulation);
 }
 return {api,simulation,scene,ball,camera,replay};
}

test('the existing body-and-ball recorder replays the actual shot without touching live football or RNG',async()=>{
 const fixture=await recordedShot(),{api,simulation,replay,scene,ball}=fixture,before=plain(api.snapshotSimulation(simulation));
 const live=ball.position.clone(),positions=scene.runtime.players.map(p=>p.model.position.clone());
 assert.equal(replay.canStart,true);assert.equal(replay.start(),true);
 assert.equal(replay.metadata.type,'shot');assert.equal(replay.metadata.kind,'chip');
 replay.advance(.5,390/844);assert.ok(replay.metadata.time<1.1);replay.stop();
 assert.ok(ball.position.distanceTo(live)<1e-5);
 scene.runtime.players.forEach((p,i)=>assert.ok(p.model.position.distanceTo(positions[i])<1e-5));
 assert.deepEqual(plain(api.snapshotSimulation(simulation)),before);
});

test('record storage stays bounded and a changed roster clears old player records',async()=>{
 const {replay,scene,simulation}=await recordedShot();
 for(let i=0;i<350;i++){scene.runtime.S.t=2+i*.05;replay.record({physicsTime:scene.runtime.S.t,contacts:[]});}
 assert.ok(replay.count<=180);assert.ok(replay.estimatedBytes<8*1024*1024);
 scene.runtime.players.pop();replay.record({physicsTime:30,contacts:[]});assert.equal(replay.count,1);
 assert.equal(simulation.match.score.home,0);
});
