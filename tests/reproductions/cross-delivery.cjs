const test = require('node:test');
const assert = require('node:assert/strict');
const {labFixture,plain} = require('../support/lab.cjs');

function cornerFixture(skill=90) {
  const {api,input}=labFixture({seed:73}); input.match=false;
  const simulation=api.createSimulation(input), taker=simulation.teams[0].players.find(p=>p.slot==='LW');
  taker.attributes.technique=taker.attributes.passing=skill;
  api.beginSimulationRestart(simulation,{kind:'corner',teamId:'home',position:{x:52.5,y:-34},taker});
  return {api,simulation};
}

test('a corner can serve moving box runners with a real aerial flight or retain the short option',()=>{
  for(const skill of [90,25]) {
    const {api,simulation}=cornerFixture(skill);
    for(let i=0;i<1500 && simulation.ball.restart;i++)api.stepSimulation(simulation);
    assert.equal(simulation.ball.restart,null);
    const cross=simulation.events.find(e=>e.type==='cross');
    if(skill>50){assert.ok(cross);assert.ok(simulation.ball.verticalVelocity>0);assert.ok(Math.abs(cross.toPos.y)<20);assert.ok(cross.toPos.x>36);}
    else {assert.equal(cross,undefined);assert.ok(simulation.events.some(e=>e.type==='pass'));}
  }
});

function aerialFixture(height, defending=false) {
  const {api,input}=labFixture({seed:73}); input.match=false;
  const simulation=api.createSimulation(input), player=simulation.teams[defending?1:0].players.at(-1);
  for(const team of simulation.teams)for(const p of team.players)p.position={x:-40,y:25};
  player.position={x:42,y:1}; player.heading=defending?Math.PI:0;
  player.attributes.technique=player.attributes.firstTouch=player.attributes.finishing=95;
  Object.assign(simulation.ball,{ownerId:null,position:{x:41.95,y:1},velocity:{x:8,y:0},height,verticalVelocity:-1,lastTouchTeamId:'home',
    flight:{eventIndex:0,teamId:'home',fromId:'home-LW',toId:player.id,fromPos:{x:30,y:-25},target:player.position,launchTick:0,cross:true}});
  simulation.events=[{type:'pass',time:0,fromPos:{x:30,y:-25},success:null}];
  simulation.statistics.teams.home.passes=1;
  return {api,simulation,player};
}

test('a high cross produces an actual header shot and a defender can head it clear',()=>{
  for(const defending of [false,true]) {
    const {api,simulation}=aerialFixture(1.65,defending);api.stepSimulation(simulation);
    const contact=simulation.events.find(e=>e.type==='aerialContact');assert.ok(contact);assert.equal(contact.kind,'header');
    if(defending){assert.ok(simulation.ball.velocity.x<0);assert.equal(simulation.events.some(e=>e.type==='shot'),false);}
    else {assert.ok(simulation.events.some(e=>e.type==='shot'&&e.style==='header'));assert.ok(simulation.ball.height>1);}
    assert.equal(simulation.ball.ownerId,null,'heading is not head control');
  }
});

test('a mid-height cross can be volleyed and saving before contact preserves the exact flight',()=>{
  const {api,simulation}=aerialFixture(.65), restored=api.restoreSimulation(api.snapshotSimulation(simulation));
  api.stepSimulation(simulation);api.stepSimulation(restored);
  assert.ok(simulation.events.some(e=>e.type==='shot'&&e.style==='volley'));
  assert.deepEqual(plain(api.readSimulation(simulation)),plain(api.readSimulation(restored)));
});
