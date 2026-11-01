const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const seeds=[1,2,3,4,5,6,7,8,9,10,42,73,101,202,303,404,505,606,707,731];

async function report(root,destination) {
 const {loadNativeLab}=require(path.resolve(root,'tests/support/lab.cjs'));
 const api=await loadNativeLab(['createSimulation','createLabScenario','stepSimulation','resumeSimulation','readSimulationStatistics']);
 const runs=seeds.map(seed=>measureMatch(api,seed));
 const fields=['shots','goals','passes','completedPasses','fouls','saves','ballWins','turnovers'];
 const summary=Object.fromEntries(fields.map(field=>[field,runs.reduce((sum,run)=>sum+run.statistics[field],0)/runs.length]));
 fs.writeFileSync(destination,JSON.stringify({status:'complete',node:process.version,seeds,durationSeconds:420,workload:false,
  setup:'Equal attributes by slot; both halves; same seed order; turnovers include ownership changes at awarded restarts.',summary,runs},null,2)+'\n');
 console.log(destination,summary);
}

function measureMatch(api,seed) {
 const input=api.createLabScenario({seed});input.durationSeconds=420;
 input.teams[1].players.forEach((player,index)=>player.attributes=structuredClone(input.teams[0].players[index].attributes));
 const simulation=api.createSimulation(input),started=performance.now();
 let turnovers=0,team=simulation.ball.teamId;
 while(simulation.match.phase!=='ended'){
  if(simulation.tick>10000)throw Error(`Simulation did not end: seed ${seed}`);
  if(simulation.paused)api.resumeSimulation(simulation);api.stepSimulation(simulation);
  if(simulation.ball.teamId!==team){turnovers++;team=simulation.ball.teamId;}
 }
 const counts={};for(const event of simulation.events)counts[event.type]=(counts[event.type]??0)+1;
 return {seed,score:simulation.match.score,ticks:simulation.tick,matchTime:simulation.matchTime,milliseconds:performance.now()-started,
  statistics:{...api.readSimulationStatistics(simulation),turnovers},counts};
}

if(require.main===module)report(process.argv[2]||'.',process.argv[3]||'docs/measurements/3d-feature-parity/after.json').catch(error=>{console.error(error);process.exitCode=1});
module.exports={report};
