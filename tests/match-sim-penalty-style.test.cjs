const test=require('node:test');const assert=require('node:assert/strict');
const {labFixture,plain}=require('./support/lab.cjs');

function penaltyFixture(skill=95,committed=true,direction=1) {
 const {api,input}=labFixture({seed:73});input.match=false;
 input.teams.forEach((team,index)=>team.direction=index?-direction:direction);
 const simulation=api.createSimulation(input),taker=simulation.teams[0].players.at(-1),keeper=simulation.teams[1].players[0];
 taker.position={x:41.15*direction,y:0};taker.heading=direction>0?0:Math.PI;taker.attributes.technique=taker.attributes.composure=skill;
 keeper.position={x:52.5*direction,y:committed?1.6:0};keeper.velocity={x:0,y:committed?2:0};
 api.beginSimulationRestart(simulation,{kind:'penalty',teamId:'home',position:{x:41.5*direction,y:0},taker});
 simulation.ball.restart.delivery=api.planSimulationRestart(simulation,simulation.ball.restart);
 return {api,simulation,taker,keeper};
}

for(const direction of [-1,1])test(`Panenka requires an actually committed keeper and a composed technician, direction ${direction}`,()=>{
 for(const [skill,committed,expected] of [[95,true,'panenka'],[25,true,'ordinary'],[95,false,'placed']]) {
  const {api,simulation}=penaltyFixture(skill,committed,direction);api.releasePositionedSimulationRestart(simulation);
  const shot=simulation.events.find(e=>e.type==='shot');if(expected==='ordinary')assert.notEqual(shot.style,'panenka');else assert.equal(shot.style,expected);
  if(expected==='panenka'){assert.equal(shot.target.y,0);assert.ok(shot.power<13);assert.ok(api.predictSimulationBall(simulation.ball,.4).height>1);}
  assert.equal(simulation.events.some(e=>e.type==='goal'),false,'a style never awards a goal');
 }
});

test('penalty anticipation moves along the line from observed body aim and resumes exactly',()=>{
 const fixture=penaltyFixture(95,false),{api,simulation,keeper}=fixture;
 keeper.attributes.gk.oneOnOne=keeper.attributes.gk.reflexes=95;
 for(let i=0;i<1500&&simulation.ball.restart?.stage!=='runup';i++)api.stepSimulation(simulation);
 assert.equal(simulation.ball.restart?.stage,'runup');
 const start={...keeper.position},restored=api.restoreSimulation(api.snapshotSimulation(simulation));
 for(let i=0;i<30&&simulation.ball.restart;i++){api.stepSimulation(simulation);api.stepSimulation(restored);}
 assert.ok(Math.abs(keeper.position.y-start.y)>.2,'the keeper really commits before a Panenka is considered');
 assert.ok(Math.abs(keeper.position.x-52.5)<.3);
 assert.equal(simulation.events.find(e=>e.type==='shot')?.style,'panenka');
 assert.deepEqual(plain(api.readSimulation(simulation)),plain(api.readSimulation(restored)));
});
