const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let result;async function audit(){return result??=(await import('../tools/match3d-presentation-fixes-audit.mjs')).audit();}
function installRAF(h){const sub=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];h.run(`window.qaSub=${JSON.stringify(sub)};window.frames=new Map();window.frameId=0;requestAnimationFrame=cb=>{const id=++frameId;frames.set(id,cb);return id};cancelAnimationFrame=id=>frames.delete(id);liveFrame=null;window.wall=0;ensureLiveLoop();`);}
test('real career RAF drains half, preserves manual pause/overlays, starts second half and finishes two consecutive matches once',async()=>{
 const {setup,full}=await import('../tools/match3d-presentation-fixes-audit.mjs'),now=setup(),old=setup(true);installRAF(now);const rows=[];
 for(const seed of [8800,8897]){
  if(seed===8897){now.run('startMatch();resumeLive()');old.run('startMatch();resumeLive()');}
  const before=full(old,seed);now.run(`M.rand=R(${seed});window.qaClips=[]`);
  const after=now.run(`(()=>{let halfEntered=false,halfReady=false,finalPaused=false,maxRAF=0,halfStart,halfEnd;
   const state=()=>JSON.stringify([pitchV73.active,pitchV73.queue,pitchV73.progress,pitchV73.ball,pitchV73.positions,ManagerStoryLive3D.time,M.events,M.rand.state]);
   for(let i=0;i<150000;i++){
    if(M.reason==='injury')eval(qaSub);else if(M.pause&&!livePresentationPending()&&M.reason!=='half'&&!M.finished)resumeLive();
    if(M.reason==='half'&&ManagerStoryLive3D.halfPending&&!halfEntered){halfEntered=true;halfStart=wall;const held=state();pauseLive();openDecisionSheet();if(M.reason!=='half')throw Error('Overlay destroyed half boundary');for(const view of ['2d','3d'])setMatchView(view);for(const tab of ['stats','details','pitch'])switchMatchTab(tab);for(const speed of [.5,2,1])setMatchSpeed(speed);ManagerStoryLive3D.step(.12,wall);if(state()!==held)throw Error('Paused queue changed');startSecondHalf();if(M.secondHalf)throw Error('Premature second half');resumeLive();}
    if(M.reason==='half'&&!ManagerStoryLive3D.halfPending){halfReady=true;halfEnd=wall;if(!matchUI().includes('İKİNCİ YARIYI BAŞLAT'))throw Error('Half UI missing');startSecondHalf();if(!M.secondHalf)throw Error('Second half did not start');}
    if(M.finished&&ManagerStoryLive3D.finishing&&!finalPaused){finalPaused=true;const held=state();pauseLive();setMatchView('2d');setMatchView('3d');ManagerStoryLive3D.step(.12,wall);if(state()!==held)throw Error('Final pause changed queue');resumeLive();}
    if(M.finished&&!ManagerStoryLive3D.finishing)break;
    maxRAF=Math.max(maxRAF,frames.size);if(frames.size!==1)throw Error('RAF count '+frames.size+' at '+M.min+'/'+M.reason);wall+=80;const [id,cb]=[...frames][0];frames.delete(id);cb(wall);
   }
   if(!M.finished||ManagerStoryLive3D.finishing)throw Error('Match did not finish/drain');
   const raw=JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state}),clips=structuredClone(qaClips),endCount=M.events.filter(e=>e.type==='end').length;finishMatch();const career=JSON.stringify(S);finishMatch();return {raw,career,clips,halfEntered,halfReady,halfDrainSeconds:(halfEnd-halfStart)/1000,maxRAF,endCount,singleResult:career===JSON.stringify(S),defaultView:clips.length>0};})()`);
  assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.halfEntered&&after.halfReady&&after.singleResult);assert.equal(after.endCount,1);assert.equal(after.maxRAF,1);
  const ids=after.clips.flatMap(c=>[...new Set([c.id,...c.linked])]).filter(x=>x!=null);assert.equal(new Set(ids).size,ids.length);rows.push({seed,halfDrainSeconds:after.halfDrainSeconds,maxRAF:after.maxRAF,endCount:after.endCount,engineRngStatsCareerEqual:true,singleResult:true});
 }
 fs.mkdirSync('docs/qa-presentation-fixes',{recursive:true});fs.writeFileSync('docs/qa-presentation-fixes/raf.json',JSON.stringify(rows,null,2));
});
test('every stationary and dribbling contest overlaps both approaches with bounded roots and immutable contact/result',async()=>{
 const a=await audit(),{setup}=await import('../tools/match3d-presentation-fixes-audit.mjs'),h=setup();let stationary=0,dribbling=0;const examples=[];
 for(const m of a.matches){assert.ok(m.preserved);for(const clip of m.after.clips.filter(c=>c.contest)){
  h.run(`window.e=${JSON.stringify({contest:clip.contest})}`);
  const r=h.run(`(()=>{const t=ManagerStoryLive3D.contestTiming(e),D=${clip.duration},distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);let max=0,joint=0,min=Infinity,old=ManagerStoryLive3D.contestFrame(e,.19),travel=0;for(let i=1;i<=400;i++){const f=ManagerStoryLive3D.contestFrame(e,.19+.57*i/400),dt=(t.boundaries[3]-t.boundaries[1])*D/400,da=distance(old.attacker,f.attacker),dd=distance(old.defender,f.defender);travel+=da;max=Math.max(max,da/dt,dd/dt);if(da/dt>.01&&dd/dt>.01)joint++;min=Math.min(min,f.clearance);old=f;}return {max,joint,min,travel,contact:ManagerStoryLive3D.contestFrame(e,.76)};})()`);
  assert.ok(r.max<=6.002);assert.ok(r.joint>=390,`${m.seed}/${clip.id} joint ${r.joint}`);assert.ok(r.min>=.61999);assert.ok(dist(r.contact.attacker,clip.contest.point)<1e-8);
  if(clip.contest.independent){stationary++;assert.ok(r.travel>.8);}else dribbling++;
  if(clip.contest.independent&&examples.length<2||clip.id===72||clip.id===48)examples.push({seed:m.seed,id:clip.id,independent:!!clip.contest.independent,attacker:clip.contest.attackerId,defender:clip.contest.defenderId,maxRootSpeed:r.max,jointSamples:r.joint,approachTravel:r.travel});
 }}assert.ok(stationary&&dribbling);fs.writeFileSync('docs/qa-presentation-fixes/duels.json',JSON.stringify(examples,null,2));
});
test('actual keeper catches/parries retain their visible roots and held/loose ownership into the next real action',async()=>{
 const a=await audit(),examples=[];
 for(const m of a.matches)for(let i=0;i<m.after.clips.length-1;i++){
  const c=m.after.clips[i],next=m.after.clips[i+1];if(!c.result||c.actor?.kind!=='keeper')continue;const id=c.result.toId;
  assert.ok(dist(c.endBall,next.startBall)<1e-8);assert.ok(dist(c.endPositions[id],next.startPositions[id])<1e-8);
  const rawRoot=c.result.enginePositions[String(id)],nextRaw=next.contest?.attackerId===id?next.contest.attackerStart:null;
  if(c.result.saveType==='CATCH'){assert.equal(c.endOwner,id);if(next.type==='enginePositionGap'){assert.equal(next.endOwner,id);assert.ok(dist(c.endPositions[id],next.endPositions[id])<1e-8);}}
  else assert.equal(c.endOwner,null);
  if([31,49,99,427].includes(c.id)&&m.seed===8800)examples.push({seed:m.seed,shot:c.id,result:c.result.eventId,actor:id,type:c.result.saveType||c.result.type,endRoot:c.endPositions[id],nextRoot:next.endPositions[id],nextType:next.type,startOwner:next.startOwner,endOwner:next.endOwner});
 }
 fs.writeFileSync('docs/qa-presentation-fixes/keepers.json',JSON.stringify(examples,null,2));
});
test('real goal kicks in both directions start behind the placed ball and release only after foot contact',async()=>{
 const {setup}=await import('../tools/match3d-presentation-fixes-audit.mjs'),{seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js'),T=await import('../dist/vendor/three/three.module.min.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};const rows=[];
 for(const [seed,id] of [[8800,21],[8800,193]]){
  const h=setup();seek(h,seed,id);const e=h.run('structuredClone(pitchV73.active)'),g=e.goalKickRunUp;assert.ok(g);assert.ok(dist(g.start,g.ball)>1&&dist(g.start,g.ball)<1.4);const sampler=createLivePoseSampler();let old=h.run('pitchV73.progress');
  for(const p of [.10,.189999,.19,.20,.76]){
   h.run(`ManagerStoryLive3D.step(${(p-old)*h.run('pitchV73.activeDuration')/h.run('matchPlaybackRate()')},0)`); // each requested jump below .12 would otherwise be capped; use small steps below
   h.run(`for(let k=0;k<5000&&pitchV73.active?.eventId===${id}&&pitchV73.progress<${p}-1e-10;k++){const dt=Math.min(.01,(${p}-pitchV73.progress)*pitchV73.activeDuration/ matchPlaybackRate());ManagerStoryLive3D.step(dt,0);}`);
   const s=h.run('MatchView.read()'),v=sampler(s),actor=v.poses.find(x=>x.id===g.id&&x.side===g.side);assert.equal(s.presentation.activeEvent.eventId,id);
   if(p<.19){assert.ok(dist(s.ball.displayPosition,g.ball)<1e-8);assert.equal(s.ball.displayOwnerId,null);assert.equal(s.ball.displayState.state,'RESTART_SETUP');}
   if(p===.19){const model=createFootballer({id:g.id,side:g.side,number:1,kit:s.teams.home,goalkeeper:true}),contacts=poseFootballer(model,actor),contact=contacts.rightToe.distanceTo(new T.Vector3(...v.ball));assert.ok(contact<.22,`goal kick contact ${contact}`);rows.push({seed,id,actor:g.id,side:g.side,start:g.start,contact:g.contact,ball:g.ball,footBallMetres:contact});}
   if(p>.19&&p<.76){assert.ok(dist(s.ball.displayPosition,g.ball)>0);assert.equal(s.ball.displayOwnerId,null);}old=p;
  }
 }
 fs.writeFileSync('docs/qa-presentation-fixes/goal-kicks.json',JSON.stringify(rows,null,2));
});
test('real pass source and recipient remain readable in both mobile frustums with bounded zoom and no grey panels',async()=>{
 const {setup}=await import('../tools/match3d-presentation-fixes-audit.mjs'),{seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js'),T=await import('../dist/vendor/three/three.module.min.js');const rows=[];
 for(const aspect of [390/(844*.43),320/(568*.43)])for(const id of [11,53]){
  const h=setup();seek(h,8800,id);const sample=createLivePoseSampler(),seen=new Set();let last;
  for(let i=0;i<5000&&h.run(`pitchV73.active?.eventId===${id}`);i++){
   const s=h.run('MatchView.read()'),p=s.presentation.progress,e=s.presentation.activeEvent,v=sample(s,{aspect});assert.ok(v.camera.span<=18.000001);
   if(last){assert.ok(Math.abs(v.camera.span-last.span)<.2,'smooth bounded zoom');}last=v.camera;
   const stage=p<.19?'source':p>=.68&&p<=.78?'arrival':null;
   if(stage){const actor=v.poses.find(x=>x.id===(stage==='source'?e.fromId:e.toId)&&x.side===(stage==='source'?e.fromSide:e.toSide));assert.ok(actor);
    const focus=new T.Vector3(...v.camera.focus),camera=new T.PerspectiveCamera(45,aspect,.1,320);camera.position.set(focus.x,24,focus.z+38);camera.lookAt(focus);camera.fov=T.MathUtils.radToDeg(2*Math.atan(v.camera.span/aspect*.5/camera.position.distanceTo(focus)));camera.updateProjectionMatrix();camera.updateMatrixWorld();
    for(const point of [v.ball,actor.position,[actor.position[0],1.85,actor.position[2]]]){const ndc=new T.Vector3(...point).project(camera);assert.ok(Math.abs(ndc.x)<.96&&Math.abs(ndc.y)<.96,`${id}/${stage} cropped ${ndc.x},${ndc.y}`);}
    // Existing far advertising and grey side panels are outside the camera.
    for(const z of [-34,0,34])for(const x of [-57.5,57.5]){const q=new T.Vector3(x,2.35,z).project(camera);assert.ok(Math.abs(q.x)>1||Math.abs(q.y)>1);}
    const board=new T.Vector3(focus.x,1.75,-38.1).project(camera);assert.ok(Math.abs(board.y)>1);
    seen.add(stage);
   }
   h.run('ManagerStoryLive3D.step(.01,0)');
  }
  assert.deepEqual([...seen],['source','arrival']);rows.push({seed:8800,id,aspect,sourceAndArrivalReadable:true,greyPanelsOutside:true,maxHorizontalSpan:18});
 }
 fs.writeFileSync('docs/qa-presentation-fixes/camera.json',JSON.stringify(rows,null,2));
});
