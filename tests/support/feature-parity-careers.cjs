const {loadGame}=require('./game.cjs');

function parityCareer(kind,direction=1) {
 const game=loadGame({quiet:true});
 game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch();setMatchView("3d")');
 const api=game.api,sim=api.M.simulation,attack=sim.teams.find(t=>t.id==='user'),defense=sim.teams.find(t=>t.id!=='user');
 for(const team of sim.teams){team.direction*=direction;for(const p of team.players){p.position.x*=direction;p.heading=team.direction>0?0:Math.PI;}}
 api.placeSimulationBall(sim,{teamId:'user',position:{x:0,y:0}});
 const context={api,sim,attack,defense,direction};
 if(kind==='freeKick') prepareFreeKick(context);
 else if(kind==='panenka') preparePanenka(context);
 else if(kind==='offside') prepareOffside(context);
 else prepareChip(context);
 api.synchronizeExperimentalMatch({time:sim.time,frame:api.captureSimulationFrame(sim),forcePlayers:true});
 api.pauseLive();api.save();return game.storage.get('msv4');
}

function prepareFreeKick({api,sim,attack,direction}) {
 const player=attack.players.find(p=>p.slot==='ST');player.position={x:27*direction,y:2};
 player.attributes.technique=player.attributes.finishing=90;
 api.beginSimulationRestart(sim,{kind:'freeKick',teamId:attack.id,position:player.position,taker:player});
 for(let i=0;i<1500&&sim.ball.restart?.stage!=='runup';i++)api.stepSimulation(sim);
 if(sim.ball.restart?.stage!=='runup')throw Error('Free kick run-up not reached');
}

function prepareChip({api,sim,attack,defense,direction}) {
 const player=attack.players.find(p=>p.slot==='ST'),keeper=defense.players.find(p=>p.slot==='GK');
 for(const team of sim.teams)for(const p of team.players)p.position={x:-30*direction,y:25};
 player.position={x:30*direction,y:0};player.heading=direction>0?0:Math.PI;player.attributes.technique=95;
 keeper.position={x:38*direction,y:0};
 api.placeSimulationBall(sim,{teamId:attack.id,ownerId:player.id,position:player.position});api.requestSimulationShot(sim);
}

function prepareOffside({api,sim,attack,defense,direction}) {
 const passer=attack.players.find(p=>p.slot==='RCM'),receiver=attack.players.find(p=>p.slot==='ST');
 for(const team of sim.teams)for(const p of team.players)p.position={x:-20*direction,y:25};
 passer.position={x:20*direction,y:0};receiver.position={x:43*direction,y:0};
 defense.players[0].position={x:50*direction,y:0};defense.players[1].position={x:40*direction,y:10};
 api.placeSimulationBall(sim,{teamId:attack.id,ownerId:passer.id,position:passer.position});
 api.releaseSimulationPass(sim,passer,{toId:receiver.id,target:receiver.position,lofted:false});
 const before={position:receiver.position,velocity:{x:0,y:0},height:0,verticalVelocity:0};
 api.controlSimulationBall(sim,{player:receiver,previous:receiver.position,fraction:0},{before,startTime:sim.time,seconds:.1});
}

module.exports={parityCareer};

function preparePanenka({api,sim,attack,defense,direction}) {
 const taker=attack.players.find(p=>p.slot==='ST'),keeper=defense.players.find(p=>p.slot==='GK');
 taker.position={x:41.15*direction,y:0};taker.attributes.technique=taker.attributes.composure=95;
 keeper.position={x:52.5*direction,y:0};keeper.attributes.gk.oneOnOne=keeper.attributes.gk.reflexes=95;
 api.beginSimulationRestart(sim,{kind:'penalty',teamId:attack.id,position:{x:41.5*direction,y:0},taker});
 for(let i=0;i<1500&&sim.ball.restart?.stage!=='runup';i++)api.stepSimulation(sim);
 if(sim.ball.restart?.stage!=='runup')throw Error('Penalty run-up not reached');
}
