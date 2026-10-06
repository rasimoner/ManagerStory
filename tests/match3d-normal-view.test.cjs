const test=require('node:test'),assert=require('node:assert/strict');
test('real goal returns behind a common-clock fade to exact engine kickoff placement, with frozen pause',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 const h=setup(),sample=createLivePoseSampler();h.run('M.rand=R(1);ManagerStoryLive3D.setTempo(1)');let now=0,found=false,placed=false,original=null;
 for(let i=0;i<30000;i++){
  now+=.01;h.run(`ManagerStoryLive3D.step(.01,${now*1000})`);const s=h.run('MatchView.read()'),e=s.presentation.activeEvent;
  if(!e?.goalReset){if(found)break;continue;}
  found=true;const p=s.presentation.progress,t=p*s.presentation.duration,v=sample(s);
  assert.equal(e.sampleInterval.phase,'restart-placement');assert.equal(s.ball.displayOwnerId,null);
  const expected=t<.15?e.fromPos:e.toPos;assert.deepEqual(Array.from(s.ball.displayPosition),Array.from(expected),'no visible journey through the pitch');
  if(!original){original=s;h.run('pauseLive()');const held=h.run('JSON.stringify(MatchView.read())');h.run('ManagerStoryLive3D.step(2,999999)');assert.equal(h.run('JSON.stringify(MatchView.read())'),held);assert.equal(sample(h.run('MatchView.read()')),v);h.run('resumeLive()');}
  if(t>=.15){placed=true;for(const actor of s.players)assert.deepEqual(Array.from(actor.baseDisplayPosition),Array.from(e.enginePositions[String(actor.id)]));assert.equal(v.resetPlaced,true);}
  if(t>=.30)assert.equal(v.opacity,1);
 }
 assert.equal(found,true);assert.equal(placed,true);assert.ok(original.presentation.eventScore.some(x=>x>0));
});
test('normal pass follows the current ball at close scale without moving any actor root',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js'),T=await import('../dist/vendor/three/three.module.min.js');
 const h=setup(),aspects=[390/500,320/240],samplers=aspects.map(()=>createLivePoseSampler());h.run('M.rand=R(8800)');let checked=0;
 for(let n=1;n<25000;n++){
  h.run(`ManagerStoryLive3D.step(.02,${n*20})`);const s=h.run('MatchView.read()'),e=s.presentation.activeEvent;
  const immutable=JSON.stringify(s);
  for(let i=0;i<aspects.length;i++){
   const v=samplers[i](s,{aspect:aspects[i]});assert.equal(JSON.stringify(s),immutable);assert.ok(v.camera.span<=13);
   if(e?.eventId!==11||s.presentation.progress<.65||s.presentation.progress>.75)continue;
   const focus=new T.Vector3(...v.camera.focus),camera=new T.PerspectiveCamera(45,aspects[i],.1,320);camera.position.set(focus.x,24,focus.z+38);camera.lookAt(focus);camera.fov=T.MathUtils.radToDeg(2*Math.atan(v.camera.span/aspects[i]*.5/camera.position.distanceTo(focus)));camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const ball=new T.Vector3(...v.ball).project(camera);assert.ok(Math.abs(ball.x)<.94&&Math.abs(ball.y)<.94,'current ball remains in close frame');
   for(const actor of v.poses){const raw=s.players.find(p=>p.id===actor.id&&p.side===actor.side);assert.ok(Math.abs(actor.position[0]-(raw.displayPosition[0]/100-.5)*105)<1e-8);}
   checked++;
  }
  if(checked>=4)break;
 }
 assert.ok(checked>=4);
});

test('distant actors and stale event endpoints cannot widen or pull the camera',async()=>{
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 const s={presentation:{seconds:1,progress:.1,activeEvent:{eventId:1,type:'pass',fromPos:[50,50],toPos:[99,99]}},ball:{displayPosition:[50,50],displayOwnerId:1,displaySide:'home'},players:[{id:1,side:'home',displayPosition:[50,50]},{id:2,side:'away',displayPosition:[51,51]},{id:3,side:'home',displayPosition:[99,99]}]};
 for(const aspect of [390/545,320/269]){
  const a=createLivePoseSampler()(s,{aspect}),other=JSON.parse(JSON.stringify(s));other.players[2].displayPosition=[10000,-10000];other.presentation.activeEvent.fromPos=[-10000,10000];other.presentation.activeEvent.toPos=[10000,-10000];
  const b=createLivePoseSampler()(other,{aspect});assert.deepEqual(b.camera,a.camera);assert.ok(b.camera.span<=13);
 }
});
