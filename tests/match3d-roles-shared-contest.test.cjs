const test=require('node:test'),assert=require('node:assert/strict');
const baseline='8025e105956cc215692cfe831b9593f2ada7eb09';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let cached;
async function results(){
 if(cached)return cached;
 const {setup,full}=await import('../tools/match3d-round2-audit.mjs');
 cached=[1,8800].map(seed=>{
  const old=setup(true,baseline),h=setup(),roster=h.run('MatchView.read().players.map(({id,side,role,name})=>({id,side,role,name}))'),teams=h.run('MatchView.read().teams');
  h.run('window.qaMatchRef=M');const before=full(old,seed),after=full(h,seed);h.run('M=qaMatchRef');
  for(const p of h.run('MatchView.read().players.map(({id,side,role,name})=>({id,side,role,name}))'))if(!roster.some(x=>x.id===p.id&&x.side===p.side))roster.push(p);
  return {seed,h,roster,teams,before,after};
 });return cached;
}
test('same real keeper/field IDs drive role, model, kit and challenge narration without mutating raw events',async()=>{
 const {createFootballer}=await import('../dist/match3d-player.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 let keepers=0,fields=0;
 for(const {h,roster,teams,after} of await results()){
  const models=new Map(roster.map(p=>{const kit=p.side==='user'?(teams.userHome?teams.home:teams.away):(teams.userHome?teams.away:teams.home);return [p.side+':'+p.id,createFootballer({id:p.id,side:p.side,number:1,kit,opponentKit:kit===teams.home?teams.away:teams.home,goalkeeper:p.role==='GK'})];}));
  for(const e of after.events.filter(e=>['press','tackle','interception'].includes(e.type))){
   const raw=JSON.stringify(e),p=h.run(`presentationEvent(${raw})`),actor=p.presentationActor,real=roster.find(x=>x.id===actor.id&&x.side===actor.side);
   assert.ok(real);assert.equal(actor.role,real.role);assert.equal(actor.name,real.name);assert.ok(p.text.includes(real.name));
   const model=models.get(actor.side+':'+actor.id);assert.equal(model.userData.id,actor.id);assert.equal(model.userData.side,actor.side);assert.equal(model.userData.goalkeeper,real.role==='GK');
   if(real.role==='GK'){keepers++;assert.ok(p.text.includes('Kaleci '+real.name));assert.equal(model.userData.kit.source,'deterministic-contrast-palette');}else fields++;
   assert.equal(JSON.stringify(e),raw);
  }
 }assert.ok(keepers>0&&fields>0);console.log('Real keeper challenge records:',keepers,'; field records:',fields);
});
test('failed independent attempts share carrier/defender approach, preserve starts/contact/owner and avoid boundary jumps or speed bursts',async()=>{
 let failed=0,all=0,maxSpeed=0;
 for(const {seed,h,after} of await results())for(let j=0;j<after.clips.length;j++){
  const clip=after.clips[j],c=clip.contest;if(!c)continue;all++;
  h.run(`window.qaContest=${JSON.stringify({contest:c})}`);
  const sample=h.run(`(()=>{const e=qaContest,t=ManagerStoryLive3D.contestTiming(e),D=${clip.duration},bounds=t.boundaries,poses=t.poseBoundaries||[0,.19,.65,.76,.91,1],dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);let max=0,joint=0,min=Infinity,travel=0;
   for(let k=1;k<bounds.length;k++){let old=ManagerStoryLive3D.contestFrame(e,poses[k-1]);for(let i=1;i<=400;i++){const f=ManagerStoryLive3D.contestFrame(e,poses[k-1]+(poses[k]-poses[k-1])*i/400),dt=(bounds[k]-bounds[k-1])*D/400,va=dist(old.attacker,f.attacker)/dt,vd=dist(old.defender,f.defender)/dt;max=Math.max(max,va,vd);if(k===2||k===3){min=Math.min(min,f.clearance);if(va>.01&&vd>.01)joint++;travel+=dist(old.attacker,f.attacker);}old=f;}}
   return {max,joint,min,travel,approachStartClearance:ManagerStoryLive3D.contestFrame(e,.19).clearance,start:ManagerStoryLive3D.contestFrame(e,0),contact:ManagerStoryLive3D.contestFrame(e,.76)};})()`);
  assert.ok(sample.max<=6.002,`${seed}/${clip.id} speed ${sample.max}`);maxSpeed=Math.max(maxSpeed,sample.max);
  assert.ok(sample.joint>=775,`${seed}/${clip.id} joint ${sample.joint}`);assert.ok(sample.min>=Math.min(.61999,sample.approachStartClearance)-1e-7,`${seed}/${clip.id} clearance ${sample.min} ${JSON.stringify(c.attackerStart)} ${JSON.stringify(c.defenderStart)} ${JSON.stringify(c.point)}`);
  assert.ok(distance(sample.start.attacker,clip.startPositions[c.attackerId])<1e-8);assert.ok(distance(sample.start.defender,clip.startPositions[c.defenderId])<1e-8);assert.ok(distance(sample.contact.attacker,c.point)<1e-8);
  const next=after.clips[j+1];if(next&&next.type!=='kickoff'){assert.ok(distance(clip.endBall,next.startBall)<1e-8);assert.deepEqual(clip.endPositions,next.startPositions);}
  if(c.independent&&c.attackerKeepsBall){failed++;assert.equal(c.tackle.success,false);assert.equal(c.result,null);assert.ok(sample.travel>.8);assert.equal(clip.endOwner,c.attackerId);}
 }
 assert.ok(failed>0);console.log('Contests:',all,'; newly linked failed independent attempts:',failed,'; max clip root speed:',maxSpeed);
});
test('baseline deterministic comparison preserves every engine event/result/statistic/RNG and career output; one terminal result',async()=>{
 for(const {seed,before,after} of await results()){
  assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.finished&&!after.pending&&after.singleResult);assert.equal(after.events.filter(e=>e.type==='end').length,1);
  const ids=after.clips.flatMap(c=>[...new Set([c.id,...c.linked])]).filter(id=>id!=null);
  for(const e of after.events.filter(e=>['press','tackle','interception','dribble'].includes(e.type)))assert.equal(ids.filter(id=>id===e.eventId).length,1,`${seed}/${e.eventId} action represented once`);
  console.log(JSON.stringify({seed,events:after.events.length,engineResultsRngCareerEqual:true,oneResult:true,beforeWallSeconds:before.wall,afterWallSeconds:after.wall}));
 }
});
test('failed independent contact retains one half-speed clock and pause across 2D/3D at all UI speeds',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),first=(await results())[0].after.clips.find(c=>c.contest?.independent&&c.contest.attackerKeepsBall);
 for(const speed of [.5,1,2]){
  const h=setup();seek(h,1,first.id);h.run(`setMatchSpeed(${speed});pauseLive()`);
  const frozen=h.run('JSON.stringify([pitchV73.active,pitchV73.progress,pitchV73.ball,pitchV73.positions,M.events,M.rand.state,ManagerStoryLive3D.time])');
  h.run('setMatchView("2d");ManagerStoryLive3D.step(.12,0);setMatchView("3d")');assert.equal(h.run('JSON.stringify([pitchV73.active,pitchV73.progress,pitchV73.ball,pitchV73.positions,M.events,M.rand.state,ManagerStoryLive3D.time])'),frozen);
  h.run('resumeLive()');const t=h.run('ManagerStoryLive3D.time');h.run('ManagerStoryLive3D.step(.01,0)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-t-.01*speed/2)<1e-9);
 }
});
