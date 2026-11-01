const test=require('node:test');const assert=require('node:assert/strict');
const {labFixture,plain}=require('./support/lab.cjs');const {loadGame}=require('./support/game.cjs');
const {sceneFixture}=require('./support/simulation-scene.cjs');

test('the existing physical chip selects the old scoop pose and leaves the actual result to the flight',async()=>{
 const {api,input}=labFixture({seed:73});input.match=false;
 const simulation=api.createSimulation(input),striker=simulation.teams[0].players.at(-1),keeper=simulation.teams[1].players[0];
 for(const team of simulation.teams)for(const p of team.players)p.position={x:-30,y:25};
 striker.position={x:30,y:0};striker.heading=0;striker.attributes.technique=95;
 keeper.position={x:38,y:0};
 api.placeSimulationBall(simulation,{teamId:'home',ownerId:striker.id,position:striker.position});api.requestSimulationShot(simulation);
 const shot=simulation.events.find(e=>e.type==='shot');assert.equal(shot.style,'chip');
 assert.ok(api.predictSimulationBall(simulation.ball,.5).height>1);
 assert.equal(simulation.events.some(e=>e.type==='goal'),false);
 const scene=await sceneFixture(),game=loadGame({quiet:true}),before=plain(api.snapshotSimulation(simulation));
 const frame=game.api.sampleSimulationScene({frame:game.api.captureSimulationFrame(simulation)},{immediate:true});scene.actors.apply(frame);
 assert.equal(scene.runtime.players.find(p=>p.id===striker.id).act.name,'pass');
 assert.deepEqual(plain(api.snapshotSimulation(simulation)),before);
});
