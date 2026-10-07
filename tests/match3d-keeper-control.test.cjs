const test=require('node:test'),assert=require('node:assert/strict');
test('captured control uses selected clock rates for normal/delayed frames; failed real distribution links to its loose ball',async()=>{
 const {setup}=await import('../tools/match3d-keeper-control-audit.mjs');
 for(const view of ['2d','3d'])for(const speed of [.5,1,2]){const h=setup();h.run(`for(let i=0;i<30000;i++){ManagerStoryLive3D.step(.01,0);if(pitchV73.keeperControl&&pitchV73.active?.eventId===99)break;}setMatchView('${view}');setMatchSpeed(${speed});`);
  assert.ok(h.run('!!pitchV73.keeperControl'));for(const dt of [1/60,.08,.12,2,1/60]){const old=h.run('ManagerStoryLive3D.time');h.run(`ManagerStoryLive3D.step(${dt},0)`);assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-old-Math.min(dt,.12)*speed/2)<1e-9);}
 }
 const h=setup(),r=h.run(`(()=>{let seen=[],last=null,max=0,flightOwner=false;for(let i=0;i<40000;i++){ManagerStoryLive3D.step(.005,0);const e=pitchV73.active,b=[...pitchV73.ball];if(e?.eventId>=99&&e?.eventId<=104||e?.eventId===105){if(seen.at(-1)!==e.eventId)seen.push(e.eventId);if(e.eventId===105&&pitchV73.progress>.2&&pitchV73.progress<.7)flightOwner ||= pitchV73.carrier===null;if(last&&last.id===105&&e.eventId!==105)max=Math.max(max,Math.hypot((b[0]-last.b[0])*1.05,(b[1]-last.b[1])*.68));}if(e?.eventId===103&&pitchV73.progress>.8)return {seen,max,flightOwner};last={id:e?.eventId,b};}throw Error('No actual distribution continuation');})()`);
 assert.deepEqual(Array.from(r.seen),[99,105,103]);assert.ok(r.flightOwner);assert.ok(r.max<.05);
});
let result;async function audit(){return result??=await (await import('../tools/match3d-keeper-control-audit.mjs')).audit();}
test('real catches49/99 retain raised ball through recovery and existing distribution in both views/rates',async()=>{
 const a=await audit();for(const r of a.controls){assert.ok(r.heldFrames>0);assert.ok(r.maxHeldGap<.2);assert.equal(r.minHeldHeight,1.05);assert.ok(r.maxRootSpeed<6.001);assert.ok(r.pauseFrozen&&r.heldPauseFrozen);
  assert.equal(r.distribution.id,r.shot===49?53:105);assert.ok(r.distribution.source.startsWith('derived-hand-distribution'));
  for(const b of r.boundaries){assert.ok(b.rootStep<.13);assert.ok(b.ballStep<.13,JSON.stringify(b));}
  const other=a.controls.find(x=>x.shot===r.shot&&x.speed===r.speed&&x.view!==r.view);assert.equal(r.maxHeldGap,other.maxHeldGap);assert.equal(r.maxRootSpeed,other.maxRootSpeed);
 }for(const x of a.examples){assert.ok(x.before.maxHeldGap>2);assert.equal(x.before.minHeldHeight,.15);}
});
test('neutral keeper hands do not reuse save targets; both world directions bend the approved rig toward the ball',async()=>{
 const {keeperPose}=await import('../dist/match3d-keeper.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js');
 global.document={createElement:()=>({width:256,height:256,getContext:()=>({fillText(){}})})};
 for(const dir of [-1,1]){const root=[0,0,0],source=[dir*8,1.05,0],target=[dir*.4,1.05,0],ball=target,m=createFootballer({id:0,side:'user',number:1,kit:{primaryColor:'#222222',secondaryColor:'#aaaaaa'},goalkeeper:true});
  const contact=keeperPose({root,source,target,ball,p:.76,save:true,catchBall:true,active:true});poseFootballer(m,contact);
  const idle=keeperPose({root,source,target,ball,p:1,save:true,catchBall:true,active:false}),c=poseFootballer(m,idle);
  assert.equal(idle.keeperMotion.phase,'idle');assert.equal(idle.leftHand[1],.94);assert.equal(idle.leftHand[0]*dir,.07);
  assert.ok(c.leftHand.x*dir>0&&c.rightHand.x*dir>0);for(const side of ['left','right']){const b=m.userData.bones,sh=b[side+'Shoulder'].getWorldPosition(c.leftHand.clone()),el=b[side+'Elbow'].getWorldPosition(c.leftHand.clone()),hand=b[side+'Hand'].getWorldPosition(c.leftHand.clone());assert.ok(el.y<sh.y);assert.ok(Math.abs(sh.distanceTo(el)-.285)<1e-8&&Math.abs(el.distanceTo(hand)-.285)<1e-8);assert.ok(m.worldToLocal(el.clone()).z>m.worldToLocal(sh.clone()).z);}assert.ok(Math.abs(idle.leftHand[0])<Math.abs(contact.leftHand[0]));
 }
});
