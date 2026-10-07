const test=require('node:test'),assert=require('node:assert/strict');
let result;async function audit(){return result??=(await import('../tools/match3d-round2-audit.mjs')).audit();}
test('round2 two full matches preserve raw engine/RNG/career, finish final actions once and retain round1 boundaries',async()=>{
 const a=await audit();for(const m of a.matches){assert.ok(m.preserved&&m.after.singleResult&&m.after.finished&&!m.after.pending);assert.equal(m.after.events.filter(e=>e.type==='end').length,1);
  for(const c of m.after.clips.filter(x=>x.actor?.kind==='keeper')){const id=String(c.result.toId),a=c.startPositions[id],b=c.endPositions[id];assert.ok(Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68)*1.5/(c.duration*.57)<=6.00001,'keeper visible approach root speed');}
  const ids=m.after.clips.flatMap(c=>[...new Set([c.id,...c.linked].filter(x=>x!=null))]);for(const e of m.after.events.filter(e=>['dribble','press','tackle','shot','save','block','pass','looseBall','recovery'].includes(e.type)))assert.equal(ids.filter(id=>id===e.eventId).length,1,`${m.seed}/${e.eventId}`);
  for(let i=1;i<m.after.clips.length;i++){const prev=m.after.clips[i-1],c=m.after.clips[i];if(c.type!=='kickoff'){assert.deepEqual(c.startBall,prev.endBall);assert.deepEqual(c.startPositions,prev.endPositions);}}
 }
});
test('all real shared duel approaches start at visible roots, move both actors, cap root speed and failed reaches follow forwards',async()=>{
 const a=await audit(),{setup}=await import('../tools/match3d-round2-audit.mjs'),h=setup();let successful=0,failed=0,known=[];
 for(const m of a.matches)for(const clip of m.after.clips.filter(c=>c.contest)){
  const c=clip.contest;h.run(`window.qaEvent=${JSON.stringify({contest:c})}`);
  const r=h.run(`(()=>{const e=qaEvent,t=ManagerStoryLive3D.contestTiming(e),D=${clip.duration},bounds=t.boundaries,pose=[0,.19,.65,.76,.91,1],dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);let max=0,joint=0,reverse=0;const dir=c=>{let x=(c.point[0]-c.attackerStart[0])*1.05,y=(c.point[1]-c.attackerStart[1])*.68,n=Math.hypot(x,y)||1;return [x/n,y/n];},d=dir(e.contest);
   for(let k=1;k<bounds.length;k++){let old=ManagerStoryLive3D.contestFrame(e,pose[k-1]);for(let i=1;i<=400;i++){const f=ManagerStoryLive3D.contestFrame(e,pose[k-1]+(pose[k]-pose[k-1])*i/400),dt=(bounds[k]-bounds[k-1])*D/400,va=dist(old.attacker,f.attacker)/dt,vd=dist(old.defender,f.defender)/dt;max=Math.max(max,va,vd);if(k===2&&va>.01&&vd>.01)joint++;if(k>=4&&e.contest.attackerKeepsBall)reverse=Math.min(reverse,(f.defender[0]-old.defender[0])*1.05*d[0]+(f.defender[1]-old.defender[1])*.68*d[1]);old=f;}}
   return {max,joint,reverse,start:ManagerStoryLive3D.contestFrame(e,0),end:ManagerStoryLive3D.contestFrame(e,1)};})()`);
  assert.ok(r.max<=6.002,`${m.seed}/${clip.id} speed ${r.max}`);if(!c.independent)assert.ok(r.joint>390,`${m.seed}/${clip.id} concurrent movement`);assert.ok(r.reverse>=-1e-8);for(const [start,id] of [[r.start.attacker,c.attackerId],[r.start.defender,c.defenderId]])assert.ok(start.every((x,i)=>Math.abs(x-clip.startPositions[String(id)][i])<1e-9));
  if(c.attackerKeepsBall)failed++;else successful++;if(m.seed===8800&&clip.id===72||m.seed===1&&clip.id===48)known.push(clip.id);
 }assert.ok(successful&&failed);assert.deepEqual(known.sort((a,b)=>a-b),[48,72]);
});
test('real block actors drive neutral/field/keeper narration without changing raw events or assigning catches',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');
 for(const [seed,id,kind] of [[1,424,'keeper'],[2,62,'keeper'],[24,356,'field'],[24,443,'field']]){const h=setup();seek(h,seed,id);const before=h.run('JSON.stringify([M.events,M.rand.state,M.stats])'),actor=h.run('shotInterventionActor(pitchV73.active.shotResult)'),p=h.run('presentationEvent(pitchV73.active.shotResult)');assert.equal(actor.kind,kind);assert.equal(p.presentationLabel,kind==='keeper'?'KURTARIŞ':'BLOK');assert.ok(!p.text.includes('Savunmacı'));assert.equal(h.run('JSON.stringify([M.events,M.rand.state,M.stats])'),before);const shot=h.run('structuredClone(pitchV73.shotMotion)');assert.equal(shot.keeperIntervention,kind==='keeper');assert.equal(!!shot.blocker,kind==='field');}
 const h=setup(),unknown=h.run('presentationEvent({type:"block",minute:1,toId:null,toSide:null})');assert.equal(unknown.text,'1’ Şut engellendi.');assert.equal(unknown.presentationLabel,'MÜDAHALE');
});
test('derived keeper body has support/push/flight/landing/recovery in both directions, with close contacts staying grounded',async()=>{
 const {keeperPose}=await import('../dist/match3d-keeper.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 for(const dir of [-1,1]){const forward=[dir,0,0],side=[0,0,-dir],root=[0,0,0],target=[dir*.3,1.05,-dir*.45],source=[dir*8,1,0],phases=[];
  const m=createFootballer({id:0,side:'user',number:1,kit:{primaryColor:'#222',secondaryColor:'#fff'},goalkeeper:true});
  for(const p of [.1,.35,.58,.72,.78,.89,.99]){const q=keeperPose({root,source,target,ball:target,p,active:true,save:true,catchBall:false,forwardHint:forward,dive:{amount:1,sign:1}});phases.push(q.keeperMotion.phase);const c=poseFootballer(m,q);assert.ok(Number.isFinite(c.leftHand.y)&&c.leftAnkle.y>=-.03);if(p===.72){assert.ok(Math.abs(q.pelvisRoll)>.8);assert.ok(q.leftFoot[1]>.2);}}
  assert.deepEqual(phases,['ready','support-step','push','reach','contact-and-land','balance-recovery','release-and-recover']);
  const near=keeperPose({root,source,target:[dir*.4,1.05,0],ball:[dir*.4,1.05,0],p:.72,active:true,save:true,forwardHint:forward,dive:{amount:0,sign:1}});assert.ok(near.pelvisRoll===0);assert.equal(near.keeperMotion.kind,'body');
 }
});
test('failed and keeper chains keep one clock through both views, all three speeds and pause',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');
 for(const [seed,id] of [[1,48],[8800,49],[8800,427]])for(const speed of [.5,1,2])for(const view of ['2d','3d']){const h=setup();seek(h,seed,id);h.run(`setMatchView('${view}');setMatchSpeed(${speed});pauseLive()`);const state=h.run('JSON.stringify([pitchV73.active,pitchV73.progress,pitchV73.ball,pitchV73.positions,M.events,M.rand.state,ManagerStoryLive3D.time])');h.run(`ManagerStoryLive3D.step(.12,0);setMatchView('${view==='2d'?'3d':'2d'}')`);assert.equal(h.run('JSON.stringify([pitchV73.active,pitchV73.progress,pitchV73.ball,pitchV73.positions,M.events,M.rand.state,ManagerStoryLive3D.time])'),state);h.run('resumeLive()');const t=h.run('ManagerStoryLive3D.time');h.run('ManagerStoryLive3D.step(.01,0)');assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-t-.01*speed)<1e-9);}
});
