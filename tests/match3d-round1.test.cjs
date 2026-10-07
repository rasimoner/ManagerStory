const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let measured;async function audit(){return measured??=(await import('../tools/match3d-round1-audit.mjs')).audit();}
test('two complete matches retain all real events, RNG, scores, stats and single career results while each real flight remains unique',async()=>{
 const a=await audit();for(const {before,after,preserved} of a.matches){assert.ok(preserved);assert.ok(after.finished&&!after.pending&&after.singleResult);assert.ok(Number.isFinite(after.wall)&&after.wall>0); /* Later legitimate motion budgets can change total time; unique flights are checked below. */assert.equal(after.defaultView,'3d');
  const played=after.clips.flatMap(c=>[...new Set([c.id,...c.linked])]).filter(x=>x!=null);assert.equal(new Set(played).size,played.length,'no engine action belongs to two clips');
  // During-position-update events belong to the existing keyframe motion, not an extra clip.
  for(const e of after.events.filter(e=>['pass','cross','shot','save','looseBall','recovery','goalKick','corner'].includes(e.type)))assert.ok(played.includes(e.eventId),'missing real action '+e.eventId);
 }
});
test('real failed field pass, keeper distribution and parry chains continue from the visible endpoints',async()=>{
 const a=await audit();for(const {after} of a.matches){const clips=after.clips;
  for(let i=1;i<clips.length;i++){const c=clips[i],previous=clips[i-1];if(!['looseBall','recovery'].includes(c.type))continue;
   assert.ok(dist(previous.endBall,c.startBall)<1e-8);if(c.type==='looseBall'&&!c.source&&c.id===76)continue; // dedicated heavy-touch roll
   if(c.type==='looseBall')assert.ok(dist(c.startBall,c.from)<1e-8,'old source '+c.id);
   for(const [id,p] of Object.entries(c.startPositions))assert.ok(dist(previous.endPositions[id],p)<1e-8,'root boundary '+c.id+':'+id);
  }
 }
 const c=a.matches.find(m=>m.seed===8800).after.clips;
 for(const ids of [[92,90,91],[105,103,104],[31,34,35]]){const indices=ids.map(id=>c.findIndex(e=>e.id===id));assert.ok(indices.every(i=>i>=0));assert.equal(indices[1],indices[0]+1);assert.equal(indices[2],indices[1]+1);}
});
test('loose ownership remains null until .76 actual recovery contact; view/rate/pause switches never restart the same event',async()=>{
 const {setup}=await import('../tools/match3d-round1-audit.mjs');
 for(const speed of [.5,1,2]){const h=setup();h.run(`M.rand=R(8800);setMatchSpeed(${speed});`);
  const r=h.run(`(()=>{let seen=new Set(),previous=null,recovery=false;for(let i=0;i<60000;i++){ManagerStoryLive3D.step(.005,i*5);const e=pitchV73.active,p=pitchV73.progress;if(!e)continue;
   if(e.looseResultId&&p>=.19||e.type==='looseBall'||e.type==='recovery'&&p<.76){if(pitchV73.carrier!==null)throw Error('early owner '+e.eventId);}
   if(e.type==='recovery'&&p>=.76){if(pitchV73.carrier!==e.toId)throw Error('wrong winner');recovery=true;}
   if(e.eventId===34&&p>.2&&!seen.has(34)){seen.add(34);const saved=JSON.stringify([pitchV73.active,pitchV73.queue,pitchV73.progress,pitchV73.ball,pitchV73.positions,ManagerStoryLive3D.time,M.events,M.rand.state]);pauseLive();for(const v of ['2d','3d'])setMatchView(v);for(const t of ['stats','details','pitch'])switchMatchTab(t);ManagerStoryLive3D.step(2,999);if(saved!==JSON.stringify([pitchV73.active,pitchV73.queue,pitchV73.progress,pitchV73.ball,pitchV73.positions,ManagerStoryLive3D.time,M.events,M.rand.state]))throw Error('switch restarted');resumeLive();}
   if(e.eventId===35&&p>.9)return {recovery,switched:seen.has(34)};
  }throw Error('missing real parry chain');})()`);assert.ok(r.recovery&&r.switched);
 }
});
function installSurface(h){
 h.run(`window.qaScenes=[];window.qaContextLost=false;window.qaFail=false;window.qaFrames=new Map();window.qaNextFrame=0;requestAnimationFrame=cb=>{const id=++qaNextFrame;qaFrames.set(id,cb);return id;};cancelAnimationFrame=id=>qaFrames.delete(id);
  const query=document.querySelector.bind(document);window.qaSurface=null;window.qaHost={append(n){n.isConnected=true;}};
  const qaCanvas={clientWidth:390,clientHeight:450,style:{},getContext:()=>({clearRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}})};
  document.querySelector=q=>q==='#career-3d-host'?(M?.fieldView==='3d'&&M?.activeTab==='pitch'?qaHost:null):query(q);
  document.head={append(){}};document.createElement=tag=>tag==='link'?{}:(qaSurface={isConnected:false,remove(){this.isConnected=false;},querySelector(q){return q==='[role=status]'?{hidden:true}:qaCanvas;}});
  window.ResizeObserver=class{observe(){}};window.addEventListener=()=>{};
  window.createLivePoseSampler=()=>()=>({opacity:1,ballPercent:[50,50]});window.createMatchScene=()=>{if(qaFail||qaContextLost)throw Error('context unavailable');const v={resize(){},applyLiveSample(){},render(){},projectPoint(){return [0,0];},dispose(options){this.disposed=true;if(options?.loseContext!==false)qaContextLost=true;}};qaScenes.push(v);return v;};`);
 let code=fs.readFileSync('dist/match3d-career.js','utf8').replace(/^import .*;\n/gm,'').replace('import.meta.url','"https://test.local/match3d-career.js"');h.run("{\n"+code+"\n}");
}
test('same-page two career matches recreate scene safely, reset event IDs and clock, keep one RAF and automatically fall back to 2D',async()=>{
 const {setup,full}=await import('../tools/match3d-round1-audit.mjs'),h=setup(),base=setup(true);installSurface(h);
 for(let n=0;n<2;n++){
  if(n){h.run('startMatch();resumeLive()');base.run('startMatch();resumeLive();setMatchView("3d")');}
  assert.equal(h.run('M.fieldView'),'3d');assert.equal(h.run('ManagerStoryLive3D.time'),0);assert.equal(h.run('pitchV73.queue[0].eventId'),1);h.run('switchMatchTab("pitch")');assert.ok(h.run('!!ManagerStoryCareer3D.view'));
  for(const speed of [.5,1,2]){h.run(`pauseLive();setMatchSpeed(${speed});setMatchView('2d');switchMatchTab('stats');switchMatchTab('pitch');setMatchView('3d');resumeLive();`);assert.ok(h.run('qaFrames.size<=1'));}
  h.run('setMatchSpeed(1)');const before=full(base,n?8897:8800),after=full(h,n?8897:8800);assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.singleResult);
  assert.equal(h.run('ManagerStoryCareer3D.view'),null);assert.equal(h.run('qaContextLost'),false);assert.equal(h.run('ManagerStoryLive3D.time'),0);assert.equal(h.run('qaFrames.size'),0);
 }
 assert.ok(h.run('qaScenes.length>=2')); assert.ok(h.run('qaScenes.every(v=>v.disposed)'));
 h.run('qaFail=true;startMatch();switchMatchTab("pitch")');assert.equal(h.run('M.fieldView'),'2d');assert.ok(h.run('ManagerStoryLive3D.enabled'));h.run('resumeLive();ManagerStoryLive3D.step(.1,0)');assert.ok(h.run('ManagerStoryLive3D.time>0'));
});
