const test=require('node:test');
const assert=require('node:assert/strict');
const {labFixture,plain}=require('./support/lab.cjs');

function passScene(direction=1,receiverX=43,restartKind) {
 const {api,input}=labFixture({seed:73});input.match=false;
 input.teams.forEach((team,i)=>team.direction=i?-direction:direction);
 const simulation=api.createSimulation(input),passer=simulation.teams[0].players[6],receiver=simulation.teams[0].players.at(-1);
 for(const team of simulation.teams)for(const p of team.players)p.position={x:-20*direction,y:25};
 passer.position={x:20*direction,y:0};passer.heading=direction>0?0:Math.PI;
 receiver.position={x:receiverX*direction,y:0};
 simulation.teams[1].players[0].position={x:50*direction,y:0};simulation.teams[1].players[1].position={x:40*direction,y:12};
 api.placeSimulationBall(simulation,{teamId:'home',ownerId:passer.id,position:passer.position});
 api.releaseSimulationPass(simulation,passer,{toId:receiver.id,target:receiver.position,lofted:false,restartKind});
 return {api,simulation,passer,receiver};
}

function touchReceiver({api,simulation,receiver},x) {
 receiver.position={x,y:0};Object.assign(simulation.ball,{position:{x,y:0},velocity:{x:0,y:0}});
 api.controlSimulationBall(simulation,{player:receiver,fraction:0,previous:receiver.position},
 {before:{position:{x,y:0},velocity:{x:0,y:0},height:0,verticalVelocity:0},startTime:simulation.time,seconds:.1});
}

for(const direction of [-1,1])test(`offside is frozen at the kick and whistled only on actual participation, direction ${direction}`,()=>{
 const fixture=passScene(direction),{simulation,receiver}=fixture;
 assert.equal(simulation.events.some(e=>e.type==='offside'),false);
 touchReceiver(fixture,30*direction);
 assert.ok(simulation.events.some(e=>e.type==='offside'&&e.fromId===receiver.id));
 assert.equal(simulation.ball.restart.kind,'freeKick');assert.equal(simulation.ball.restart.indirect,true);
 assert.equal(simulation.ball.restart.position.x,30*direction);
});

test('level, own-half and behind-ball players remain onside; later forward running does not change the kick snapshot',()=>{
 for(const x of [40,0,15]){const fixture=passScene(1,x);touchReceiver(fixture,45);assert.equal(fixture.simulation.events.some(e=>e.type==='offside'),false);}
});

test('corner, throw-in and goal-kick exemptions end at the next teammate kick',()=>{
 for(const kind of ['corner','throwIn','goalKick']) {
  const fixture=passScene(1,43,kind);touchReceiver(fixture,43);
  assert.equal(fixture.simulation.events.some(e=>e.type==='offside'),false);
  const next=fixture.simulation.teams[0].players[5];next.position={x:49,y:0};
  fixture.api.releaseSimulationPass(fixture.simulation,fixture.receiver,{toId:next.id,target:next.position,lofted:false});
  touchReceiver({...fixture,receiver:next},49);
  assert.ok(fixture.simulation.events.some(e=>e.type==='offside'));
 }
});

test('deliberate opponent possession resets the pending snapshot and save/load preserves participation',()=>{
 const fixture=passScene(),{api,simulation}=fixture,restored=api.restoreSimulation(api.snapshotSimulation(simulation));
 touchReceiver(fixture,43);touchReceiver({...fixture,simulation:restored,receiver:restored.teams[0].players.at(-1)},43);
 assert.deepEqual(plain(api.readSimulation(simulation)),plain(api.readSimulation(restored)));
 const other=passScene(),defender=other.simulation.teams[1].players[1];other.api.acquireSimulationBall(other.simulation,defender);
 assert.equal(other.simulation.offside,null);
});

test('a passive offside player is ignored, but a real challenge and goalkeeper screening are offences',()=>{
 const fixture=passScene(),{api,simulation,receiver}=fixture;
 assert.equal(api.simulationOffsideInterference(simulation),false);
 Object.assign(simulation.ball,{position:{x:42,y:0},height:0});receiver.position={x:43,y:0};receiver.velocity={x:-2,y:0};
 simulation.teams[1].players[1].position={x:42,y:1};
 assert.equal(api.simulationOffsideInterference(simulation),true);
 const screen=passScene();screen.receiver.position={x:48,y:0};screen.simulation.teams[1].players[0].position={x:50,y:0};
 screen.simulation.ball.shot={teamId:'home',eventIndex:0};
 assert.equal(screen.api.simulationOffsideInterference(screen.simulation),true);
 assert.equal(screen.simulation.events.find(e=>e.type==='offside').reason,'screen');
});

test('a save/deflection preserves offside while a slow deliberate opponent play clears it even on an inaccurate touch',()=>{
 const fixture=passScene(),{api,simulation}=fixture,defender=simulation.teams[1].players[1];
 assert.ok(simulation.offside.candidates.length);
 assert.equal(api.simulationDeliberateOpponentPlay(simulation,defender,{touching:{height:0,velocity:{x:30,y:0}},time:1}),false);
 assert.equal(api.simulationDeliberateOpponentPlay(simulation,defender,{touching:{height:0,velocity:{x:5,y:0}},time:2}),true);
});

test('an onside teammate touch replaces the old kick snapshot before any later participation',()=>{
 const fixture=passScene(1,35),{api,simulation,passer,receiver}=fixture,third=simulation.teams[0].players[5];
 third.position={x:45,y:2};api.captureSimulationOffside(simulation,passer);
 assert.ok(simulation.offside.candidates.includes(third.id));
 third.position={x:39,y:2};touchReceiver(fixture,35);
 assert.equal(simulation.offside.fromId,receiver.id);
 assert.equal(simulation.offside.candidates.includes(third.id),false);
});
