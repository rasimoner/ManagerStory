/* Opt-in presentation scheduler on the EXISTING liveFrameStep. No RNG or second engine. */
(() => {
 let enabled=false,tempo=4,presentationSeconds=0,wallSeconds=0,logs=[],observedMatch=null,wallOrigin=0,inPositionUpdate=false,motionSample=null;
 function syncMatch(now=0,dt=0){if(observedMatch===M)return;observedMatch=M;presentationSeconds=0;wallSeconds=0;logs=[];wallOrigin=now-dt*1000;inPositionUpdate=false;motionSample=null;}
 const lerp=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),ease=u=>u*u*(3-2*u);
 // All action budgets use the existing presentation movement scale.
 const rootRate=24,flightRate=22;
 const isCarry=e=>['dribble','ballCarry','run'].includes(e.type);
 const baseDuration=e=>{
  const base=e.engineAnimationDuration??eventAnimationTime(e);
  if(e.type==='shot'&&e.shotResult){
   const target=shotTarget(e),start=e.enginePositions[String(e.goalkeeperId)]||target;
   const block=e.outcome==='block'?blockRoot(e):null,bStart=block?e.enginePositions[String(e.shotResult.toId)]||block:target;
   return Math.max(.7,metres(e.fromPos,target)/flightRate/.57,metres(start,keeperTarget(e))*1.5/rootRate/.57,block?metres(bStart,block)*1.5/rootRate/.76:0,e.continuation?metres(target,e.continuation.toPos)/flightRate/.24:0);
  }
  if(e.headerShot)return Math.max(base,metres(e.fromPos,headerContact(e.headerShot))/18/.81,...Object.entries(e.enginePositions).map(([id,p])=>metres((currentPitchState().durationPositions||currentPitchState().positions)[id]||p,p)*1.5/rootRate));
  if(e.cutPresentation)return Math.max(base,metres(e.cutPresentation.start,e.toPos)*1.5/rootRate/.76);
  if(e.recoveryStarts)return Math.max(base,(e.chaseSeconds||0)/4,...Object.entries(e.recoveryStarts).map(([id,start])=>metres(start,e.enginePositions[id]||start)*1.5/rootRate/.76));
  if(e.contest)return Math.max(base,contestDuration(e),...Object.entries(e.enginePositions||{}).map(([id,p])=>metres((currentPitchState().durationPositions||currentPitchState().positions)[id]||p,p)*1.5/rootRate));
  if(!isCarry(e))return base;
  const d=metres(e.fromPos,e.toPos),others=Math.max(0,...Object.entries(e.enginePositions||{}).map(([id,p])=>metres((currentPitchState().durationPositions||currentPitchState().positions)[id]||p,p)));
  return Math.max(base,d*1.5/(rootRate*.57),others*1.5/rootRate,e.contest?contestDuration(e):0);
 };
 // Field deliveries retain their real release/contact but allocate seconds per
 // phase, instead of stretching preparation and a stationary tail with distance.
 const fieldRole=(id,side)=>side==='user'?M.matchRoles[id]:playerAtMarker(id,side)?.position;
 const fieldDelivery=e=>['pass','cross'].includes(e.type)&&!e.headerShot&&!e.restartType&&!e.keeperDistribution&&!e.keeperLooseResult&&fieldRole(e.fromId,e.fromSide)!=='GK'&&fieldRole(e.toId,e.toSide)!=='GK';
 function deliveryPlan(state,e){
  const source=state.positions[String(e.fromId)]||e.fromPos,receiver=state.positions[String(e.toId)]||e.toPos;
  const preparation=Math.max(.12,metres(source,e.enginePositions[String(e.fromId)]||source)*1.5/rootRate);
  const control=.12,receiverRun=metres(receiver,e.enginePositions[String(e.toId)]||receiver)*1.5/rootRate;
  const others=Math.max(0,...Object.entries(e.enginePositions||{}).filter(([id])=>id!==String(e.fromId)&&id!==String(e.toId)).map(([id,end])=>metres(state.positions[id]||end,end)*1.5/rootRate));
  const distance=metres(e.fromPos,e.toPos),arc=Math.max(1.2,Math.min(3.8,distance/12));
  // A firm aerial delivery has a flight budget from its visible arc, rather
  // than the ground-pass rolling rate. Blend continuously beyond short range.
  const blend=e.travelType==='aerial'?ease(Math.max(0,Math.min(1,(distance-22)/16))):0;
  const rolling=distance*1.15/flightRate,air=Math.max(Math.sqrt(8*arc/9.81),distance/60+.04);
  const flightSeconds=Math.max(.18,rolling+(air-rolling)*blend,receiverRun-preparation,others-preparation-control);
  return {preparation,flight:flightSeconds,control,arc,total:preparation+flightSeconds+control,kickPreparation:.12,kickFollow:.18,source:'arc-flight-budget; release-relative-kick; one-clock'};
 }
 function keeperThrowFrame(e,seconds){
  const d=e.keeperDistribution,t=d.handTiming,f=d.forward,side=[f[2],0,-f[0]];
  const point=(front,lateral,height)=>[d.root[0]+(f[0]*front+side[0]*lateral)/1.05,d.root[1]+(f[2]*front+side[2]*lateral)/.68,height];
  const a=Math.atan2(d.initialForward[0],d.initialForward[2]),b=Math.atan2(f[0],f[2]),turn=Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const heldSide=sec=>{const yaw=a+turn*ease(Math.min(1,sec/t.releaseAt));return [Math.cos(yaw),0,-Math.sin(yaw)];};
  const heldPoint=sec=>{const yaw=a+turn*ease(Math.min(1,sec/t.releaseAt));return [d.root[0]+Math.sin(yaw)*.32/1.05,d.root[1]+Math.cos(yaw)*.32/.68,1.05];};
  const start=heldPoint(t.startAt),windup=point(-.12,.20,.94),release=[...d.release,1.05],neutral=point(.07,.24,.94),support=point(.07,-.24,.94);
  const dx=(e.toPos[0]-d.release[0])*1.05,dz=(e.toPos[1]-d.release[1])*.68,n=Math.hypot(dx,dz)||1,flightDirection=[dx/n,0,dz/n];
  const endControl=[release[0]-flightDirection[0]*.12/1.05,release[1]-flightDirection[2]*.12/.68,release[2]+.03];
  const bezier=(u)=>windup.map((v,i)=>(1-u)**3*v+3*(1-u)**2*u*windup[i]+3*(1-u)*u*u*endControl[i]+u**3*release[i]);
  let ball,hand,phase,wrist=0;const bodySide=heldSide(seconds),startSide=heldSide(t.startAt);const gather=Math.max(0,Math.min(1,(seconds-t.startAt)/t.preparation));
  if(seconds<t.startAt){ball=heldPoint(seconds);hand=[ball[0]+bodySide[0]*.065/1.05,ball[1]+bodySide[2]*.065/.68,ball[2]];phase='hand-held';}
  else if(seconds<t.startAt+t.preparation){ball=lerp(start,windup,ease(gather));hand=[ball[0]+startSide[0]*.065*(1-ease(gather))/1.05,ball[1]+startSide[2]*.065*(1-ease(gather))/.68,ball[2]];phase='hand-prepare';wrist=-.12*ease(gather);}
  else if(seconds<t.releaseAt){const q=Math.min(1,(seconds-t.startAt-t.preparation)/t.throw);ball=bezier(q);hand=[...ball];phase='hand-throw';wrist=-.12+.22*ease(q);}
  else {const after=seconds-t.releaseAt,tip=[release[0]+flightDirection[0]*.06/1.05,release[1]+flightDirection[2]*.06/.68,1.08];hand=after<t.follow?lerp(release,tip,ease(after/t.follow)):lerp(tip,neutral,ease(Math.min(1,(after-t.follow)/t.recover)));ball=release;phase=after<t.follow?'hand-follow':after<t.follow+t.recover?'hand-recover':'hand-idle';wrist=.10*(1-ease(Math.min(1,after/(t.follow+t.recover))));}
  const held=heldPoint(Math.min(seconds,t.startAt)),leftSide=heldSide(Math.min(seconds,t.startAt)),leftStart=[held[0]-leftSide[0]*.065/1.05,held[1]-leftSide[2]*.065/.68,held[2]];
  return {ball:ball.slice(0,2),height:ball[2],throwHand:hand,supportHand:lerp(leftStart,support,ease(gather)),wrist,phase,flightDirection,source:'one shared-clock hand path; real pass release; engine handedness absent, right arm presentation'};
 }
 function keeperDistributionPhase(e,q){const t=e.keeperDistribution.timing,sec=q*t.total;return sec<t.contactAt?.19*sec/t.contactAt:sec<t.contactAt+t.flight?.19+.57*(sec-t.contactAt)/t.flight:.76+.24*Math.min(1,(sec-t.contactAt-t.flight)/t.control);}
 function deliveryPhase(e,q){const t=e.deliveryTiming,sec=q*t.total;return sec<t.preparation ? .19*sec/t.preparation : sec<t.preparation+t.flight ? .19+.57*(sec-t.preparation)/t.flight : .76+.24*Math.min(1,(sec-t.preparation-t.flight)/t.control);}
 function deliveryFlight(u,seconds){const w=Math.min(.25,.08/seconds),a=1-w,v=u<=a?u:u-(u-a)**2/(2*w);return v/(1-w/2);}
 // Persistent visual roots only. Ball and engine keyframes are never offset.
 const duration=e=>e.timingDuration??baseDuration(e)+Math.max(0,...Object.values(e.offsetTracks||{}).map(t=>metres(t.start,t.end)*1.5/rootRate/(t.endProgress-t.startProgress)));
 function captureShield(data){if(!enabled)return;const e=currentPitchState().queue.at(-1);if(e?.type==='hold'&&e.fromId===data.attackerId)e.shield=structuredClone({...data,source:'captured-hold-challenger; derived-body-shield-and-visual-separation'});}
 function planOffsets(state,e){
  if(e.type==='ballOut'){e.offsetTracks={};return;}
  state.visualOffsets??={};const tracks={},set=(id,end,a=0,b=1)=>{if(id==null)return;const start=state.visualOffsets[String(id)]||[0,0];tracks[String(id)]={start:[...start],end:[...end],startProgress:a,endProgress:b,source:'derived-persistent-non-owner-root-offset; engine-and-ball-unchanged'};};
  const zero=(id,b=.76)=>{if(id!=null&&state.visualOffsets[String(id)]?.some(v=>Math.abs(v)>1e-9))set(id,[0,0],0,b);};
  const away=(a,b)=>{const A=xy(a),B=xy(b),dx=A[0]-B[0],dy=A[1]-B[1],n=Math.hypot(dx,dy)||1;return pct([dx/n*.85,dy/n*.85]);};
  if(e.contest){zero(e.contest.defenderId);zero(e.contest.attackerId);}
  if(e.shield&&e.success===false){const c=e.shield,other=e.enginePositions[String(c.defenderId)]||c.defenderStart||[c.point[0]+1,c.point[1]],off=state.visualOffsets[String(c.defenderId)]||[0,0];set(c.attackerId,away(c.point,other.map((v,i)=>v+off[i])),.76,1);}
  if(e.type==='recovery'||e.type==='interception'||['pass','cross','corner','freeKick'].includes(e.type))zero(e.toId);
  if(isCarry(e)||['pass','cross','shot','hold','freeKick'].includes(e.type))zero(e.fromId,.19);
  // Keep separation across zero-distance continuations; fade only when the real
  // next segment actually separates the bodies, or this player must contact ball.
  for(const [id,off] of Object.entries(state.visualOffsets))if(!tracks[id]&&off.some(v=>Math.abs(v)>1e-9)&&e.enginePositions?.[id]&&e.toPos&&metres(e.enginePositions[id],e.toPos)>1.4)set(id,[0,0]);
  // Use the existing persistent visual offsets for local support/spacing.
  // Contacts stay on their real actors; no ball or motor target is displaced.
  if(e.deliveryTiming){
   const receiver=e.enginePositions[String(e.toId)]||e.toPos;
   const sameSide=id=>M.active.some(x=>String(x)===id)?e.toSide==='user':e.toSide==='opp';
   for(const [id,point] of Object.entries(e.enginePositions||{})){
    if(id===String(e.toId)||fieldRole(M.active.find(x=>String(x)===id)??id,M.active.some(x=>String(x)===id)?'user':'opp')==='GK')continue;
    const distance=metres(point,receiver),giver=id===String(e.fromId);
    if(!giver&&(distance>12||metres(state.positions[id]||point,point)>2))continue;
    const dx=(point[0]-receiver[0])*1.05,dz=(point[1]-receiver[1])*.68,n=Math.hypot(dx,dz);
    const px=(receiver[0]-e.fromPos[0])*1.05,pz=(receiver[1]-e.fromPos[1])*.68,pn=Math.hypot(px,pz)||1;
    const direction=n>.01?[dx/n,dz/n]:[-pz/pn,px/pn];
    // The giver supports toward the receiver; close teammates open the lane.
    // Opponents close pressure without pretending to make a tackle/contact.
    const toward=giver&&distance>3||!sameSide(id)&&distance>2.4,step=giver?Math.min(1.2,distance*.15):sameSide(id)?Math.min(.8,Math.max(.25,2.4-distance)):distance>2.4?Math.min(.9,distance-2.4):Math.min(.6,Math.max(0,.85-distance));
    if(!step)continue;
    const total=e.deliveryTiming.total,begin=giver?(e.deliveryTiming.preparation+e.deliveryTiming.kickFollow)/total:0,available=Math.max(0,total*(1-begin));
    const amount=Math.min(step,available*3/1.5,available*available*12/6);
    if(amount<.01)continue;
    const end=pct(direction.map(v=>v*amount*(toward?-1:1)));
    if(point.some((v,i)=>v+end[i]<1||v+end[i]>99))continue;
    const start=state.visualOffsets[id]||[0,0],after=Math.min(1,begin);
    tracks[id]={start:[...start],end,startProgress:after,endProgress:1,clockBased:true,contactProgress:giver?e.deliveryTiming.preparation/total:null,source:'derived-local-support-and-pressure-from-recorded-pass-layout; persistent-common-roots'};
   }
  }
  e.offsetTracks=tracks;
 }
 function applyOffsets(state,e,p){for(const [id,t] of Object.entries(e.offsetTracks||{})){const progress=t.clockBased?state.progress:p;const u=Math.max(0,Math.min(1,(progress-t.startProgress)/(t.endProgress-t.startProgress)));state.visualOffsets[id]=t.contactProgress!=null?(progress<t.contactProgress?lerp(t.start,[0,0],ease(progress/t.contactProgress)):lerp([0,0],t.end,ease(u))):lerp(t.start,t.end,ease(u));}}
 // Presentation-only linkage of three already committed engine events.
 function linkDribbleContest(data){
  if(!enabled)return;const q=currentPitchState().queue,[carry,press,tackle]=q.slice(-3);
  if(carry?.type!=='dribble'||press?.type!=='press'||tackle?.type!=='tackle'||carry.fromId!==data.attackerId||tackle.defenderId!==data.defenderId)return;
  carry.contest=structuredClone({...data,press,tackle,source:'captured-before-defender-placement; derived-approach-and-contact',contactProgress:.76});
 }
 function linkCarrierGain(data){
  if(!enabled)return;const q=currentPitchState().queue,attempt=q.at(-1)?.type==='tackle';
  const [press,tackle,result]=attempt?[...q.slice(-2),null]:q.slice(-3);
  if(press?.type!=='press'||tackle?.type!=='tackle'||tackle.defenderId!==data.defenderId||tackle.fromId!==data.attackerId||press.gameSecond!==tackle.gameSecond)return;
  if(!attempt&&(result?.type!=='interception'||!tackle.success||result.toId!==data.defenderId||result.fromId!==data.attackerId||press.gameSecond!==result.gameSecond))return;
  press.contest=structuredClone({...data,press,tackle,result,independent:true,attackerKeepsBall:attempt,source:'captured-before-carrier-challenge-placement; shared-approach-contact-recovery',contactProgress:.76});
 }
 // All links live on copied presentation events, never M.events or saved state.
 function linkPassCut(data){if(!enabled)return;const e=currentPitchState().queue.at(-1);if(['pass','cross'].includes(e?.type)&&!e.success&&e.toId===data.id)e.cutPresentation=structuredClone(data);}
 function captureHeavyTouch(data){if(!enabled)return;const e=currentPitchState().queue.at(-1);if(e?.type==='ballCarry'&&e.fromId===data.carrierId)e.heavyDecision=structuredClone(data);}
 function linkRecovery(starts){if(!enabled)return;const q=currentPitchState().queue,e=q.at(-1),loose=q.at(-2);if(e?.type!=='recovery')return;e.recoveryStarts=structuredClone(starts);
  if(loose?.heavyGeometry){e.heavyGeometry=structuredClone(loose.heavyGeometry);e.recoveryStarts[String(e.heavyGeometry.carrierId)]=[...e.heavyGeometry.touch];}
 }
 function linkLooseTouch(){if(!enabled)return;const q=currentPitchState().queue,[carry,loose]=q.slice(-2);if(carry?.type!=='ballCarry'||carry.success!==false||loose?.reason!=='touch')return;
  carry.heavyTouch=true;const data=carry.heavyDecision||{carrierId:carry.fromId,carrierSide:carry.fromSide,start:carry.fromPos,land:carry.toPos,gameSecond:carry.gameSecond};
  const d=metres(data.start,data.land),gap=Math.min(3.5,d*.35),touch=lerp(data.start,data.land,d?(d-gap)/d:1),rollEnd=lerp(touch,data.land,.65);
  // Motor has no separate stop point. Reserve the final recorded segment for
  // deterministic presentation-only heavy-touch roll and the real winner's chase.
  const geometry={...structuredClone(data),touch,rollEnd,gapMetres:gap,releaseProgress:.76,source:'derived-final-segment-separation; immutable-engine-land-and-winner'};
  carry.heavyGeometry=structuredClone(geometry);loose.heavyGeometry=structuredClone(geometry);loose.fromPos=[...rollEnd];loose.movementSource=geometry.source;
 }
 function captureShotStart(start){if(!enabled)return;const e=currentPitchState().queue.at(-1);if(e?.type==='shot')e.shooterStart=[...start];}
 const xy=p=>[p[0]*1.05,p[1]*.68],pct=p=>[p[0]/1.05,p[1]/.68];
 const contestPaths=new WeakMap();
 // Presentation placement is a short preparation movement, not a sampled
 // zero-vector direction jump. Paths and timing use metre-space endpoints.
 function relativePath(from,to){
  const length=v=>Math.hypot(...v),a=length(from),b=length(to),angleB=Math.atan2(to[1],to[0]),angleA=a>1e-8?Math.atan2(from[1],from[0]):angleB;
  const turn=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA)),v=to.map((x,i)=>x-from[i]),n=v[0]*v[0]+v[1]*v[1],q=n?Math.max(0,Math.min(1,-(from[0]*v[0]+from[1]*v[1])/n)):0;
  const closest=Math.hypot(...from.map((x,i)=>x+v[i]*q));
  // Use the straight relative segment unless it intersects the body clearance.
  // A small polar detour has fixed endpoint bearings, never a live normalization.
  const path={from,to,a,b,angle:angleA,turn,detour:closest<.62-1e-8};
  if(path.detour&&Math.max(a,b)>1.2){
   const chord=Math.hypot(...v)||1,side=(-v[1]*from[0]+v[0]*from[1])<0?-1:1,normal=[-v[1]/chord*side,v[0]/chord*side];
   // A local quadratic bypass avoids sweeping a distant defender around a
   // growing circle. Inspect the complete curve, with a derivative margin
   // between samples; duration comes from its analytic control-polygon bound.
   for(let radius=1.4;radius<12;radius*=1.25){const control=normal.map(x=>x*radius),bound=2*Math.max(Math.hypot(...control.map((x,i)=>x-from[i])),Math.hypot(...to.map((x,i)=>x-control[i])));let minimum=Infinity;
    for(let i=0;i<=128;i++){const q=i/128;minimum=Math.min(minimum,Math.hypot(...from.map((x,j)=>(1-q)**2*x+2*(1-q)*q*control[j]+q*q*to[j])));}
    if(minimum>=.62+bound/256){path.control=control;path.curveBound=bound;break;}
   }
  }
  return path;
 }
 function relativeFrame(path,q){if(path.control)return path.from.map((x,i)=>(1-q)**2*x+2*(1-q)*q*path.control[i]+q*q*path.to[i]);if(!path.detour)return lerp(path.from,path.to,q);const r=path.a+(path.b-path.a)*q,a=path.angle+path.turn*q;return [r*Math.cos(a),r*Math.sin(a)];}
 function relativeSpeedBound(path){return path.curveBound??(path.detour?Math.abs(path.b-path.a)+Math.max(path.a,path.b)*Math.abs(path.turn):Math.hypot(...path.to.map((v,i)=>v-path.from[i])));}
 function contestPath(e){
  const c=e.contest,signature=[...c.attackerStart,...c.point,...c.defenderStart,...c.defenderEnd,c.independent,c.attackerKeepsBall].join('|'),cached=contestPaths.get(c);if(cached?.signature===signature)return cached.path;
  const A=xy(c.attackerStart),B=xy(c.point),S=xy(c.defenderStart),E=xy(c.defenderEnd),dx=B[0]-A[0],dy=B[1]-A[1],n=Math.hypot(dx,dy),dir=n>1e-8?[dx/n,dy/n]:[attackDirection(c.attackerSide),0];
  const sign=((S[0]-B[0])*-dir[1]+(S[1]-B[1])*dir[0])<0?-1:1,normal=[-dir[1]*sign,dir[0]*sign];
  const contactNormal=[...normal];if(Math.abs(contactNormal[0])<.9){contactNormal[0]=.9*Math.sign(contactNormal[0]||S[0]-B[0]||1);contactNormal[1]=Math.sqrt(1-.9**2)*Math.sign(contactNormal[1]||1);}
  const startVector=S.map((v,i)=>v-A[i]),gap=Math.hypot(...startVector),bearing=gap>1e-8?startVector.map(v=>v/gap):normal;
  if(contactNormal[0]*bearing[0]+contactNormal[1]*bearing[1]<0){contactNormal[0]*=-1;contactNormal[1]*=-1;}
  const contact=B.map((v,i)=>v+contactNormal[i]*.70);
  // Keep the real carrier segment moving throughout the opponent's approach.
  // A genuinely stationary recorded action stays stationary; no return loop.
  const lossDistance=Math.hypot(...B.map((v,i)=>v-E[i])),lossDirection=lossDistance>1e-8?B.map((v,i)=>(v-E[i])/lossDistance):contactNormal.map(v=>-v);
  const attackerEnd=B.map((v,i)=>v+(c.attackerKeepsBall?dir[i]*.60:lossDirection[i]*.85));
  const defenderEnd=c.attackerKeepsBall?contact.map((v,i)=>v+dir[i]*.60):E;
  const approach=relativePath(startVector,contact.map((v,i)=>v-B[i]));
  const recovery=relativePath(contact.map((v,i)=>v-B[i]),defenderEnd.map((v,i)=>v-attackerEnd[i]));
  const length=n,defenderRun=approach.detour?n+relativeSpeedBound(approach):Math.hypot(...contact.map((v,i)=>v-S[i]));
  const retreat=Math.hypot(...attackerEnd.map((v,i)=>v-B[i])),defenderRecovery=recovery.detour?retreat+relativeSpeedBound(recovery):Math.hypot(...defenderEnd.map((v,i)=>v-contact[i]));
  const movement=Math.max(.28,Math.max(length,defenderRun)*1.5/rootRate),recover=Math.max(.28,Math.max(retreat,defenderRecovery)*1.5/rootRate);
  // Pose labels split a continuous motion interval; they do not stop either root.
  const preparation=movement*.19/.76,reach=movement*.11/.76,contactSeconds=recover*.15/.24,recoverySeconds=recover*.09/.24,total=movement+recover;
  const path={A,B,S,E,dir,normal,prepA:A,prepared:S,contact,attackerEnd,defenderEnd,approach,recovery,length,timing:{preparation,approach:movement*.46/.76,reach,contact:contactSeconds,recovery:recoverySeconds,total,boundaries:[0,preparation/total,movement*.65/.76/total,movement/total,(movement+contactSeconds)/total,1],poseBoundaries:[0,.19,.65,.76,.91,1],source:'visible-starts-to-real-contact; concurrent-root-segments; one-shared-clock'}};contestPaths.set(c,{signature,path});return path;
 }
 function contestPhase(e,p){const t=contestPath(e).timing;for(let i=1;i<t.boundaries.length;i++)if(p<=t.boundaries[i])return t.poseBoundaries[i-1]+(t.poseBoundaries[i]-t.poseBoundaries[i-1])*(p-t.boundaries[i-1])/(t.boundaries[i]-t.boundaries[i-1]);return 1;}
 function contestFrame(e,p){
  const c=e.contest,path=contestPath(e),{A,B,dir}=path,t=ease(Math.max(0,Math.min(1,p/.76))),follow=ease(Math.max(0,Math.min(1,(p-.76)/.24)));
  const attacker=p<.76?lerp(A,B,t):lerp(B,path.attackerEnd,follow),relative=p<.76?relativeFrame(path.approach,t):relativeFrame(path.recovery,follow);
  const defender=attacker.map((v,i)=>v+relative[i]);
  const travel=path.length*t,phase=travel/1.25%1,lead=c.independent?0:.18*Math.sin(Math.PI*phase)**2*Math.sin(Math.PI*t)**2;
  let ball=(p<.76||c.attackerKeepsBall?[...attacker]:[...B]).map((v,i)=>v+dir[i]*lead);
  if(p>=.76&&!c.attackerKeepsBall)ball=lerp(B,defender,ease(Math.max(0,Math.min(1,(p-.76)/.15))));
  return {attacker:pct(attacker),defender:pct(defender),ball:pct(ball),travel,phase,lead,clearance:Math.hypot(...relative)};
 }
 function contestDuration(e){return contestPath(e).timing.total;}
 // Derived shot geometry. Raw percent goal mouth is wider than the real 7.32m goal.
 // Preserve raw endpoints on e; remap committed goal/post contacts into the real net/frame; never decide outcomes.
 function headerContact(e){const t=shotTarget(e),a=xy(e.fromPos),b=xy(t),n=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return pct(a.map((v,i)=>v+(b[i]-a[i])/n*.227));}
 function keeperIntervention(e){return e.outcome==='save'||e.outcome==='block'&&shotInterventionActor(e.shotResult).kind==='keeper';}
 function blockRoot(e){return [...e.shotResult.toPos];}
 function shotTarget(e){
  if(e.outcome==='post')return [e.frame==='crossbar'?(e.toPos[0]>50?100:0):e.toPos[0]>50?100-.205/1.05:.205/1.05,e.frame==='crossbar'?50+(e.toPos[1]-50)*.55:50+(e.toPos[1]<50?-1:1)*3.66/.68];
  if(e.outcome==='block'&&e.shotResult)return [...e.shotResult.toPos];
  return e.outcome==='goal'?[e.toPos[0]>50?102.1:-2.1,50+(e.toPos[1]-50)*.55]:e.outcome==='wide'?[e.toPos[0]>50?102:-2,e.toPos[1]]:[...e.toPos];}
 function keeperTarget(e){const t=shotTarget(e),dir=e.toPos[0]>50?1:-1;
  if(e.outcome==='post')return [e.toPos[0],50+(t[1]-50)*.25];
  return [e.outcome==='wide'?e.toPos[0]:t[0]-dir*.55/1.05,['goal','wide'].includes(e.outcome)?50+(e.toPos[1]-50)*.25:t[1]];
 }
 function shotFrame(e,p){
  const target=shotTarget(e),u=Math.max(0,Math.min(1,(p-.19)/.57)),dir=e.toPos[0]>50?1:-1;
  const source=e.header&&e.headerIncoming?headerContact(e):e.fromPos,sourceHeight=e.header&&e.headerIncoming?1.704:.15;
  const targetHeight=e.outcome==='post'&&e.frame==='crossbar'?2.235:e.outcome==='block'&&!keeperIntervention(e)?.15:1.05;
  // Engine supplies endpoints, not physical velocity. Keep the clip duration and
  // use a monotone presentation profile with an explicit loss at frame contact.
  const reboundDistance=e.continuation?metres(target,e.continuation.toPos):0,incidentDistance=metres(source,target),impactSlope=e.outcome==='post'&&incidentDistance?Math.max(1,1.6*reboundDistance*.57/(incidentDistance*.24*.7)):1;
  const flightProgress=e.outcome==='post'?Math.pow(u,impactSlope):u;
  let ball=lerp(source,target,flightProgress),height=sourceHeight+(targetHeight-sourceHeight)*u+Math.sin(Math.PI*u)*(e.shotFlight?.arc??.55);
  const kStart=e.keeperStart||e.enginePositions[String(e.goalkeeperId)]||keeperTarget(e),kEnd=keeperTarget(e);
  const fx=(source[0]-target[0])*1.05,fz=(source[1]-target[1])*.68,fn=Math.hypot(fx,fz)||1,keeperForward=[fx/fn,0,fz/fn];
  const keeperSide=[keeperForward[2],0,-keeperForward[0]],lateral=(target[0]-kStart[0])*1.05*keeperSide[0]+(target[1]-kStart[1])*.68*keeperSide[2];
  const dive=keeperIntervention(e)||e.penalty?Math.max(0,Math.min(1,(Math.abs(lateral)-.65)/1.5)):0,diveSign=Math.sign(lateral)||1;
  if(keeperIntervention(e)){kEnd[0]=target[0]-(keeperForward[0]*(.40-.10*dive)+keeperSide[0]*diveSign*.45*dive)/1.05;kEnd[1]=target[1]-(keeperForward[2]*(.40-.10*dive)+keeperSide[2]*diveSign*.45*dive)/.68;}
  // Goal keeper cannot reach the ball; his attempt stays inside the field.
  if(e.outcome==='goal')kEnd[0]=dir>0?98:2;
  const keeper=e.outcome==='block'&&!keeperIntervention(e)?[...kStart]:lerp(kStart,kEnd,ease(u));
  const cross=e.outcome==='goal'?( (dir>0?100:0)-e.fromPos[0])/(target[0]-e.fromPos[0]):null;
  if(e.outcome==='goal'){height=sourceHeight*(1-u)+.15*u+Math.sin(Math.PI*u)*(e.shotFlight?.arc??1.15);if(p>.76)height=.15;}
  if(e.outcome==='wide'){height=sourceHeight*(1-u)+.15*u+Math.sin(Math.PI*u)*(e.shotFlight?.arc??1.4);}
  if(e.outcome==='save'&&p>=.76){
   const r=ease(Math.max(0,Math.min(1,(p-.76)/.24)));
   if(e.shotResult.saveType==='CATCH'){ball=lerp(target,[keeper[0]+keeperForward[0]*.32/1.05,keeper[1]+keeperForward[2]*.32/.68],r);height=1.05;}
   else height=1.05*(1-r)+.15*r;
   // DEFLECT_CORNER has no recorded flight endpoint before the restart.
  }
  if(e.parryFlight&&p>=.76){const f=parryFrame(e.parryFlight,(p-.76)/.24*e.parryFlight.tail);ball=f.ball;height=f.height;}
  if(['block','post'].includes(e.outcome)&&p>=.76&&e.continuation){const u=Math.max(0,Math.min(1,(p-.76)/.24)),r=e.outcome==='post'?u+.6*u*(1-u):u;
   ball=lerp(target,e.continuation.toPos,r);height=targetHeight*(1-r)+.15*r+(e.outcome==='post'?.18*Math.sin(Math.PI*u)*(1-u):0);
  }
  return {ball,keeper,keeperForward,height,target,sourcePoint:source,header:!!(e.header&&e.headerIncoming),keeperIntervention:keeperIntervention(e),penaltyAttempt:!!e.penalty,dive:{amount:dive,sign:diveSign,lateralMetres:lateral,source:'derived-lateral-contact-route; engine height/dive telemetry absent'},keeperStart:[...kStart],contactHeight:targetHeight,blocker:e.outcome==='block'&&shotInterventionActor(e.shotResult).kind==='field'?lerp(e.enginePositions[String(e.shotResult.toId)]||blockRoot(e),blockRoot(e),ease(Math.min(1,p/.76))):null,contactProgress:.19,resultProgress:.76,lineCrossProgress:cross==null?null:.19+.57*cross,
   goalCrossed:cross!=null&&u>=cross,source:'derived-shot-flight-and-keeper-reach',result:e.shotResult};
 }
 // The recorded loose event keeps its ID and its own clip. Its route starts
 // at save contact and crosses the boundary once, rather than dropping in
 // place and restarting the same flight. No new event or possession is added.
 function planReboundChase(state){
  if(state.active.reboundChase){
     const e=state.active,c=e.reboundChase;c.tracks={};
     for(const id of new Set([...c.chasers,String(c.id)])){
      const start=state.positions[id]||c.targets[id];if(!start)continue;
      const target=e.enginePositions[id]||start,impact=String(e.goalkeeperId)===id?shotFrame(e,.76).keeper:lerp(start,target,ease(.76));
      const end=id===String(c.id)?c.approach:c.targets[id]||impact,distance=metres(impact,end);
      // Start the recorded chase concurrently without stretching the shot to
      // force an early arrival. The real recovery completes the remaining run.
      const fraction=distance?Math.min(id===String(c.id)?1:.65,state.activeDuration*.24*rootRate/1.5/distance):0;
      c.tracks[id]={impact,end:lerp(impact,end,fraction)};
     }
    }
 }
 function parryFrame(track,elapsed){const u=Math.max(0,Math.min(1,elapsed/(track.tail+track.loose))),q=ease(u);return {ball:lerp(track.contact,track.land,q),height:1.05*(1-q)+.15*q};}
 const positions=()=>Object.fromEntries([...M.active,...M.oppIds].map(id=>[String(id),eventPoint(id,typeof id==='string'?'opp':'user')]));
 function beginMotionSample(){if(!enabled)return;inPositionUpdate=true;motionSample={fromGameSecond:Math.max(0,M.min*60-60),toGameSecond:M.min*60,fromPositions:positions(),fromBall:[...M.ballState.position],fromOwner:M.ballOwner,fromSide:M.ballSide};}
 function endMotionSample(){if(!enabled||!motionSample)return;inPositionUpdate=false;Object.assign(motionSample,{toPositions:positions(),toBall:[...M.ballState.position],toOwner:M.ballOwner,toSide:M.ballSide,phase:'after-position-update-before-action-decisions'});}

 function anchored(state,id,point){const a=state.keeperRootAnchors?.[String(id)]||state.controlAnchor;return a&&id===a.id?point.map((v,i)=>v+a.display[i]-a.engine[i]):point;}
 function anchorTargets(state,targets){for(const id of Object.keys(targets||{})){const a=state.keeperRootAnchors?.[id]||(String(state.controlAnchor?.id)===id?state.controlAnchor:null);if(a)targets[id]=anchored(state,a.id,targets[id]);}return targets;}
 const metres=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
 function keyframeTransition(state,targets,to,gameSecond,owner=state.carrier,side=state.side,timingTargets=targets,timingTo=to){
  const gap=metres(state.ball,to),movement=Math.max(gap,...Object.entries(targets||{}).map(([id,p])=>metres(state.positions[id]||p,p)));
  const reference={positions:state.durationPositions||state.positions,ball:state.durationBall||state.ball},timingMovement=Math.max(metres(reference.ball,timingTo),...Object.entries(timingTargets||{}).map(([id,p])=>metres(reference.positions[id]||p,p)));
  const held=state.keeperControl,keeperMovement=held&&targets?.[String(held.id)]?metres(state.positions[String(held.id)],targets[String(held.id)]):0;
  if(Math.max(timingMovement,movement)<=.02&&keeperMovement<=.02)return null;
  // Unknown intermediate trajectory: bounded interpolation of recorded engine samples.
  // Smoothstep peak derivative is 1.5 in the shared presentation scale.
  return {type:'enginePositionGap',fromPos:[...state.ball],toPos:[...to],enginePositions:structuredClone(targets),
   timingTargets:structuredClone(timingTargets),timingTo:[...timingTo],presentationDuration:Math.max(.15,Math.max(timingMovement,movement)*1.5/rootRate,keeperMovement*1.5/rootRate),gameSecond,gapMetres:gap,maxMovementMetres:movement,
   carryId:state.carrier,carrySide:state.side,endOwner:owner,endSide:side,movementSource:'derived-between-engine-keyframes'};
 }
 // Stage 3A braking curve, same contact/arrival boundaries and endpoint.
 const flight=u=>{if(u<.7)return u*1.15;const t=(u-.7)/.3;return (2*t*t*t-3*t*t+1)*.805+(t*t*t-2*t*t+t)*.345+(-2*t*t*t+3*t*t);};
 function startGoalFeedback(state,now){
  const g=state.goalPresentation.goal,identity=resolveClubIdentity('goal',{teamId:g.side===0?M.home:M.away});
  const needsImage=typeof Image==='function';state.goalPresentation.stage=needsImage?'image':'overlay';state.goalPresentation.until=needsImage?null:now+2000;
  state.goalFeedback={eventId:g.eventId,visible:!needsImage,team:identity.id,colors:[identity.primaryColor,identity.secondaryColor],variant:Math.abs(Math.floor(Number(g.gameSecond)||0))%4,text:identity.name+' • '+(g.scorer||'Gol')+' • '+g.minute+'’'};
 }
 function step(dt,now){
  if(!enabled||!M||(M.finished?!finishing():M.pause&&!halfPending())||paused())return;
  syncMatch(now,dt);
  wallSeconds+=dt;
  // The existing RAF allows 2s engine catch-up. Presentation never repays that
  // wall-time debt with a burst: use its documented .12s frame cap, no backlog.
  const state=currentPitchState(),delta=Math.min(.12,Math.max(0,dt))*matchPlaybackRate()/tempo;
  // Same frame callback and queue. Wall time of the image is never clip debt.
  if(state.goalPresentation){
   const g=state.goalPresentation;state.presentationDelta=0;
   if(g.stage==='net'){const take=Math.min(delta,Math.max(0,g.netUntil-presentationSeconds));presentationSeconds+=take;state.presentationSeconds=presentationSeconds;state.presentationDelta=take;if(presentationSeconds>=g.netUntil-1e-9)startGoalFeedback(state,now);}
   else if(g.stage==='image'){if(g.imageReady){g.stage='overlay';g.until=now+2000;state.goalFeedback.visible=true;}else if(g.imageFailed){state.goalPresentation=null;state.goalFeedback.visible=false;state.goalImageError='Team and existing fallback image unavailable';}}
   else if(now>=g.until){state.goalPresentation=null;state.goalFeedback.visible=false;}
   if(window.MatchView)window.MatchView.publish(state);return;
  }
  presentationSeconds+=delta;state.presentationSeconds=presentationSeconds;state.presentationDelta=delta;
  // Drain only the current atomic engine minute. Never produce a future minute behind a queue.
  if(state.active&&state.durationEvent!==state.active){
   planOffsets(state,state.active);state.activeDuration=duration(state.active);
    if(state.active.shotKickTiming)state.active.shotKickTiming.preparation=state.activeDuration*.19;
    planReboundChase(state);state.durationEvent=state.active;state.startPositions=structuredClone(state.positions);
   state.clipStartTimestamp=now-state.progress*state.activeDuration*tempo/matchPlaybackRate()*1000;
   state.contactObserved=null;state.arrivalObserved=null;state.rateSegments=[];
  }
  let remaining=delta;
  if(!state.active&&!state.queue.length){
   // Finish the current committed minute before generating exactly ONE next minute.
   // No speculative future batches; new manager inputs are read at this boundary.
   if(state.batchEnd){
    const last=state.batchEnd;state.batchEnd=null;
    const tail=keyframeTransition(state,anchorTargets(state,structuredClone(last.positions)),anchored(state,last.owner,last.ball),last.gameSecond,last.owner,last.side,last.positions,last.ball);
    if(tail){tail.controlMapped=true;tail.sampleInterval={fromGameSecond:last.gameSecond,toGameSecond:last.gameSecond,phase:'post-event-settlement'};tail.homeGoals=last.score[0];tail.awayGoals=last.score[1];tail.engineStatistics=last.statistics;state.queue.push(tail);}else {state.eventScore=last.score;state.eventStatistics=last.statistics;}
   }
   if(!state.queue.length&&!M.finished&&!M.pause){
    const start=matchSecond(),oldScore=state.eventScore||[M.hg,M.ag],oldStatistics=state.eventStatistics||{shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()};
    motionSample=null;advanceLive((60-start%60)/90/M.speed);
    if(motionSample?.toPositions){
     const during=state.queue.filter(e=>e.sampleTime?.stage==='during-position-update');
     state.queue=state.queue.filter(e=>e.sampleTime?.stage!=='during-position-update');
     const sample=motionSample;state.positionSamples=structuredClone(sample);const rawPositions=structuredClone(sample.toPositions),rawBall=[...sample.toBall];sample.toPositions=anchorTargets(state,structuredClone(sample.toPositions));sample.toBall=anchored(state,sample.toOwner,sample.toBall);
     const move=keyframeTransition(state,sample.toPositions,sample.toBall,sample.toGameSecond,sample.toOwner,sample.toSide,rawPositions,rawBall)||{type:'enginePositionGap',fromPos:[...state.ball],toPos:[...sample.toBall],enginePositions:sample.toPositions,carryId:state.carrier,carrySide:state.side,endOwner:sample.toOwner,endSide:sample.toSide,gapMetres:0,maxMovementMetres:0};
     move.presentationDuration=Math.max(move.presentationDuration||0,(sample.toGameSecond-sample.fromGameSecond)/90);
     move.sampleInterval={fromGameSecond:sample.fromGameSecond,toGameSecond:sample.toGameSecond,phase:sample.phase};
     move.rawEnginePositions=rawPositions;move.engineFromPos=[...(state.durationBall||state.ball)];move.engineToPos=rawBall;move.controlMapped=true;move.movementSource='derived-between-minute-position-samples';move.motionEvents=during;move.gameSecond=sample.toGameSecond;
     move.homeGoals=oldScore[0];move.awayGoals=oldScore[1];move.engineStatistics=structuredClone(oldStatistics);
     const first=state.queue[0];
     if(first?.contest&&first.contest.attackerId===sample.toOwner&&first.contest.attackerSide===sample.toSide){
      first.approachSample=structuredClone(move.sampleInterval);first.motionEvents=during;first.minimumMotionDuration=move.presentationDuration;
      first.contestTransitionSource='minute-carrier-motion-folded-into-real-challenge';
     }else state.queue.unshift(move);
    }else if(!state.queue.length){
     const move=keyframeTransition(state,positions(),M.ballState.position,matchSecond(),M.ballOwner,M.ballSide);if(move)state.queue.push(move);
    }
    for(const shot of state.queue.filter(e=>e.headerIncoming)){shot.presentationTarget=shotTarget(shot);const delivery=state.queue.find(e=>e.eventId===shot.headerIncoming.eventId);if(delivery)delivery.headerShot=structuredClone(shot);}
    for(const shot of state.queue.filter(e=>e.type==='shot'&&e.shotResult&&['post','block'].includes(e.outcome))){const resultIndex=state.queue.findIndex(e=>e.eventId===shot.shotResult.eventId),next=state.queue[resultIndex+1];if(next&&['looseBall','ballOut'].includes(next.type)){shot.continuation=structuredClone(next);if(next.type==='looseBall')shot.consumedContinuationId=next.eventId;}}
    state.batchEnd={positions:positions(),ball:[...M.ballState.position],owner:M.ballOwner,side:M.ballSide,gameSecond:matchSecond(),score:[M.hg,M.ag],statistics:{shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()}};
   }
  }
  while(remaining>1e-9&&(state.active||state.queue.length)){
   if(!state.active){
    // Failed deliveries may be logged AFTER their committed loose/recovery
    // consequences. Link only an exact same-minute source and landing pair.
    // Reorder the presentation copies; never re-run or delete an engine action.
    if(state.queue[0]?.type==='looseBall'){
     const loose=state.queue[0],i=state.queue.findIndex(x=>['pass','cross'].includes(x.type)&&x.success===false&&x.gameSecond===loose.gameSecond&&x.fromPos?.every((v,j)=>Math.abs(v-loose.fromPos[j])<1e-8)&&x.toPos?.every((v,j)=>Math.abs(v-loose.toPos[j])<1e-8));
     if(i>0){const delivery=state.queue.splice(i,1)[0];delivery.looseResultId=loose.eventId;loose.deliveryArrivalId=delivery.eventId;delivery.enginePositions=structuredClone(loose.enginePositions);delivery.preRecoveryPositions=true;
      if(state.keeperControl?.id===delivery.fromId){delivery.keeperLooseResult=loose.eventId;loose.keeperDistributionArrival=true;}
      state.queue.unshift(delivery);
     }
    }
    const delivery=state.queue[0],consequence=state.queue[1];
    if(['pass','cross','corner','goalKick','freeKick'].includes(delivery?.type)&&consequence?.type==='looseBall'&&delivery.gameSecond===consequence.gameSecond&&
     (consequence.fromPos?.every((v,j)=>Math.abs(v-delivery.toPos[j])<1e-8)||consequence.fromPos?.every((v,j)=>Math.abs(v-delivery.fromPos[j])<1e-8)&&consequence.toPos?.every((v,j)=>Math.abs(v-delivery.toPos[j])<1e-8)))delivery.looseResultId=consequence.eventId;
    const next=state.queue[0];if(['kickoff','restartPosition'].includes(next.type)){state.keeperRootAnchors=null;state.controlAnchor=null;state.keeperControl=null;state.parryFlight=null;state.keeperRecovery=null;state.parryLooseLand=null;}const rawTargets=structuredClone(next.timingTargets||next.rawEnginePositions||next.enginePositions||{}),rawFrom=next.engineFromPos||next.fromPos;
    if(next.type!=='enginePositionGap'&&next.timingDuration==null){
     const reference={...next,fromPos:rawFrom,toPos:next.type==='kickoff'?next.toPos:next.engineToPos||next.toPos,enginePositions:rawTargets,timingDuration:undefined,engineAnimationDuration:undefined};
     planOffsets(state,reference);next.timingDuration=duration(reference);
    }
    if((state.controlAnchor||state.keeperRootAnchors)&&!next.controlMapped){
     const a=state.controlAnchor;next.engineAnimationDuration??=eventAnimationTime(next);next.enginePositions=anchorTargets(state,structuredClone(next.enginePositions||{}));
     if(next.fromPos&&(next.fromId===a?.id||state.keeperRootAnchors?.[String(next.fromId)])){next.engineFromPos??=[...next.fromPos];next.fromPos=anchored(state,next.fromId,next.fromPos);}
     if(next.toPos&&(next.toId===a?.id||state.keeperRootAnchors?.[String(next.toId)])&&['restart','firstTouch','pass','cross'].includes(next.type))next.toPos=anchored(state,next.toId,next.toPos);
     if(next.contest&&a&&next.contest.attackerId===a.id){next.timingContest=structuredClone(next.contest);next.contest.attackerStart=anchored(state,a.id,next.contest.attackerStart);next.contest.point=anchored(state,a.id,next.contest.point);}
     next.controlMapped=true;next.controlMapping='derived-from-visible-control; immutable-engine-source';
    }
    // Out-of-play is already the shot endpoint; do not fly back to an old source.
    if(next.type==='looseBall'&&!next.heavyGeometry){
     next.fromPos=[...state.ball];next.continuitySource='derived-visible-endpoint-to-recorded-loose-land; no-engine-velocity';
    }
    if(next.type==='ballOut'){next.fromPos=[...state.ball];next.toPos=[...state.ball];next.timingDuration=.08;next.rawEnginePositions??=structuredClone(next.enginePositions);}
    if(next.type==='restartPosition'&&!next.restartReset){
     next.fromPos=[...state.ball];next.restartReset=true;
     const placed=state.queue.find(x=>x.type==='restartPlayers'&&x.gameSecond===next.gameSecond&&x.restartType===next.restartType);
     if(placed?.enginePositions)next.enginePositions=structuredClone(placed.enginePositions);
    }

    // Dead-ball layouts are copied presentation data. Keep the motor's exact
    // taker/receiver/result; use metric clearance and the regulation 11m spot.
    if(next.type==='restartPosition'&&['FREE_KICK','PENALTY'].includes(next.restartType)){
     const group=state.queue.filter(x=>x.gameSecond===next.gameSecond&&x.restartType===next.restartType);
     const kick=group.find(x=>x.type==='freeKick'||x.type==='shot');
     if(kick){
      const penalty=next.restartType==='PENALTY',dir=kick.toPos[0]>50?1:-1;
      const ball=penalty?[dir>0?100-11/1.05:11/1.05,50]:[...kick.fromPos];
      const dx=(kick.toPos[0]-ball[0])*1.05,dz=(kick.toPos[1]-ball[1])*.68,n=Math.hypot(dx,dz)||1,forward=[dx/n,0,dz/n];
      const behind=[ball[0]-forward[0]*(penalty?2:1.2)/1.05,ball[1]-forward[2]*(penalty?2:1.2)/.68],contact=[ball[0]-forward[0]*.35/1.05,ball[1]-forward[2]*.35/.68];
      const layout=structuredClone(next.enginePositions);
      if(!penalty)for(const [id,point] of Object.entries(layout)){
       const side=M.active.some(x=>String(x)===id)?'user':'opp';if(side===kick.fromSide)continue;
       const off=state.visualOffsets?.[id]||[0,0],clearance=9.15+Math.hypot(off[0]*1.05,off[1]*.68);
       const x=(point[0]-ball[0])*1.05,z=(point[1]-ball[1])*.68,d=Math.hypot(x,z);
       if(d<clearance){const ax=d?x/d:forward[0],az=d?z/d:forward[2];let q=[ball[0]+ax*clearance/1.05,ball[1]+az*clearance/.68];
        q=q.map(v=>Math.max(1,Math.min(99,v)));if(metres(q,ball)<clearance)q=[ball[0]+(ball[0]<50?1:-1)*clearance/1.05,ball[1]];layout[id]=q;}
      }
      if(penalty)layout[String(kick.goalkeeperId)]=[dir>0?100:0,50];
      for(const event of group){
       event.enginePositions={...event.enginePositions,...structuredClone(layout),[String(kick.fromId)]:[...(event===kick?contact:behind)]};
       if(event.type==='restartPosition')event.toPos=[...ball];else {event.fromPos=[...ball];if(event!==kick)event.toPos=[...ball];}
       event.restartDisplayPoint=[...ball];event.sourcePrepared=true;
      }
      kick.goalKickSetup={id:kick.fromId,side:kick.fromSide,ball,behind,contact,forward,source:'presentation-only dead-ball approach; metric clearance; engine route absent'};
     }
    }
    if(next.restartType==='GOAL_KICK'&&['restartPosition','restartPlayers','restartWait','goalKick'].includes(next.type)){
     const kick=state.queue.find(x=>x.type==='goalKick'&&x.gameSecond===next.gameSecond);
     if(kick){const consequence=state.queue[state.queue.indexOf(kick)+1];if(consequence?.type==='looseBall'&&consequence.gameSecond===kick.gameSecond)kick.looseResultId=consequence.eventId;const ball=kick.fromPos,dx=(kick.toPos[0]-ball[0])*1.05,dz=(kick.toPos[1]-ball[1])*.68,n=Math.hypot(dx,dz)||1,forward=[dx/n,0,dz/n],behind=[ball[0]-forward[0]*1.2/1.05,ball[1]-forward[2]*1.2/.68],contact=[ball[0]-forward[0]*.35/1.05,ball[1]-forward[2]*.35/.68];
      next.goalKickSetup={id:kick.fromId,side:kick.fromSide,ball:[...ball],behind,contact,forward,source:'derived-dead-ball-setup-and-two-step-approach; engine run-up telemetry absent'};
      next.enginePositions[String(kick.fromId)]=next.type==='goalKick'?contact:behind;
     }
    }
    if(['kickoff','restartPosition'].includes(next.type)){state.duelRootLinks=null;state.controlContinuation=null;}
    if(!next.duelRootMapped&&state.duelRootLinks){
     const map=(id,p)=>p&&state.duelRootLinks[String(id)]?p.map((v,i)=>v+state.duelRootLinks[String(id)][i]):p;
     // Follow recorded increments after a failed reach, rather than the engine's
     // bookkeeping placement four percent backwards. New ball contacts settle
     // through the existing continuous keyframe link; no root is pushed instantly.
     for(const [id,p] of Object.entries(next.enginePositions||{}))next.enginePositions[id]=map(id,p);
     if(next.type==='enginePositionGap'){next.fromPos=[...state.ball];next.toPos=map(next.endOwner,next.toPos);}
     if(next.fromPos&&next.fromId!=null)next.fromPos=map(next.fromId,next.fromPos);
     if(next.toPos&&next.toId!=null&&next.type!=='shot')next.toPos=map(next.toId,next.toPos);
     if(next.contest){const c=next.contest;next.timingContest??=structuredClone(c);c.attackerStart=map(c.attackerId,c.attackerStart);c.point=map(c.attackerId,c.point);c.defenderStart=map(c.defenderId,c.defenderStart);c.defenderEnd=map(c.defenderId,c.defenderEnd);}
     next.duelRootMapped=true;
    }
    // An unowned landing is a ball contact, not a saved keeper-root sample.
    // Keep it fixed while the actual recorded winner approaches from the screen.
    if(next.type==='recovery'&&!next.heavyGeometry&&state.parryLooseLand?.gameSecond===next.gameSecond){
     const id=next.toId,key=String(id),land=[...state.ball],start=state.positions[key]||land;
     const keeper=(next.toSide==='user'?M.matchRoles[id]:playerAtMarker(id,next.toSide)?.position)==='GK';
     const dx=(land[0]-start[0])*1.05,dz=(land[1]-start[1])*.68,n=Math.hypot(dx,dz);
     const forward=n>.01?[dx/n,0,dz/n]:[attackDirection(next.toSide),0,0];
     const root=keeper?[land[0]-forward[0]*.32/1.05,land[1]-forward[2]*.32/.68]:land;
     next.looseCollection={id,side:next.toSide,land,root,forward,keeper,engineRoot:[...(next.rawEnginePositions?.[key]||rawTargets[key]||next.engineToPos||next.toPos)],source:'real-parry-recovery-winner; visible-approach-and-contact; engine has no collection style'};
     next.toPos=land;next.enginePositions[key]=root;state.keeperControl=null;state.parryLooseLand=null;
    }
    const sourceTargets=next.enginePositions?structuredClone(next.enginePositions):{};
    if(next.contest){const c=next.contest;const raw=next.timingContest||c;rawTargets[String(c.attackerId)]=[...raw.attackerStart];rawTargets[String(c.defenderId)]=[...raw.defenderStart];sourceTargets[String(c.attackerId)]=[...c.attackerStart];sourceTargets[String(c.defenderId)]=[...c.defenderStart];}
    if(next.cutPresentation)rawTargets[String(next.toId)]=[...next.cutPresentation.start];
    if(next.cutPresentation)sourceTargets[String(next.toId)]=[...next.cutPresentation.start];
    if(next.recoveryStarts)Object.assign(rawTargets,structuredClone(next.recoveryStarts));
    if(next.recoveryStarts)Object.assign(sourceTargets,structuredClone(next.recoveryStarts));
    if(next.headerShot)sourceTargets[String(next.headerShot.fromId)]=[...(next.headerShot.shooterStart||state.positions[String(next.headerShot.fromId)]||next.headerShot.fromPos)];
    if(isCarry(next)||next.type==='shot')rawTargets[String(next.fromId)]=[...rawFrom];
    if(isCarry(next)||next.type==='shot')sourceTargets[String(next.fromId)]=[...next.fromPos];
    let transition=!next.contest&&!next.sourcePrepared&&next.fromPos&&(['pass','cross','shot'].includes(next.type)||isCarry(next)||next.contest?.independent||(state.afterShot&&!['looseBall','recovery'].includes(next.type)))?keyframeTransition(state,sourceTargets,next.contest?.independent?next.contest.attackerStart:next.headerIncoming?headerContact(next):next.fromPos,next.gameSecond,state.carrier,state.side,rawTargets,next.contest?.independent?(next.timingContest||next.contest).attackerStart:next.headerIncoming?headerContact(next):rawFrom):null;
    // Out is a notification at the already visible endpoint, not another
    // player-settlement clip. The recorded restart performs its own setup.
    if(next.type==='ballOut')transition=null;
    const placement=next.type==='kickoff'?keyframeTransition(state,next.enginePositions,next.fromPos,next.gameSecond,next.fromId,next.fromSide):null;
    if(placement){placement.sampleInterval={fromGameSecond:next.gameSecond,toGameSecond:next.gameSecond,phase:'restart-placement'};placement.carryId=null;placement.carrySide='none';placement.movementSource='derived-dead-ball-placement';
     // Preserve this segment's original duration and common clock. Only the
     // visible dead-ball relocation is replaced by a .30s fade to real setup.
     if(state.afterGoal){placement.goalReset=true;placement.presentationDuration=duration(placement);state.afterGoal=false;}
    }
    if(placement)state.active=placement;
    else if(transition){transition.ballHeight=state.displayBallHeight??.15;
     if(state.afterShot&&['ballOut','restartPosition','restartPlayers','restartWait'].includes(next.type)){

      transition.deadBallHold=true;transition.toPos=[...state.ball];transition.carryId=null;transition.carrySide='none';transition.movementSource='derived-dead-ball-placement';
     }
     next.sourcePrepared=true;state.active=transition;
    }
    else {state.active=state.queue.shift();state.afterShot=false;if(state.active.type==='ballOut'){state.carrier=null;state.side='none';state.active.enginePositions=structuredClone(state.positions);}
     if(state.keeperControl&&state.active.fromId===state.keeperControl.id&&['pass','cross'].includes(state.active.type)){
      const a=state.keeperControl,root=[...state.positions[String(a.id)]],dx=(state.active.toPos[0]-root[0])*1.05,dz=(state.active.toPos[1]-root[1])*.68,n=Math.hypot(dx,dz)||1,forward=[dx/n,0,dz/n];
      const release=[root[0]+forward[0]*.32/1.05,root[1]+forward[2]*.32/.68];
      const distance=metres(root,state.active.toPos),kind=['long','cross','lofted'].includes(state.active.passKind)||state.active.passKind!=='short'&&distance>=30?'punt':'throw';
      state.active.keeperDistribution={kind,distance,id:a.id,side:a.side,root,forward,initialForward:[...a.forward],release:[...release],height:1.05,source:'real-pass-kind; otherwise 30m visible-target rule; engine has no hand/foot style'};
      if(kind==='throw'){const lateral=[forward[2],0,-forward[0]];state.active.keeperDistribution.release=[root[0]+(forward[0]*.35+lateral[0]*.20)/1.05,root[1]+(forward[2]*.35+lateral[2]*.20)/.68];}
      state.active.fromPos=[...state.active.keeperDistribution.release];state.active.enginePositions[String(a.id)]=root;
     }
     if(state.controlAnchor&&(isCarry(state.active)||['pass','cross','shot','goalKick','corner','throwIn','kickoff','restartPosition'].includes(state.active.type)))state.controlAnchor=null;
     if(state.active.shotResult)state.queue=state.queue.filter(x=>x.eventId!==state.active.shotResult.eventId&&x.eventId!==state.active.consumedContinuationId);
     if(state.active.contest){const c=state.active.contest;state.queue=state.queue.filter(x=>x.eventId!==c.press.eventId&&x.eventId!==c.tackle.eventId&&x.eventId!==c.result?.eventId);}
    }
    if(state.active.contest){
     const c=state.active.contest;for(const id of [c.attackerId,c.defenderId]){const key=String(id),off=state.visualOffsets?.[key];if(off&&state.positions[key]){state.positions[key]=state.positions[key].map((v,i)=>v+off[i]);state.visualOffsets[key]=[0,0];}}c.attackerStart=[...(state.positions[String(c.attackerId)]||c.attackerStart)];c.defenderStart=[...(state.positions[String(c.defenderId)]||c.defenderStart)];
     state.active.timingDuration=undefined;state.active.contestStartSource='visible-roots; shared-approach-clock';
     state.active.timingDuration=Math.max(duration(state.active),state.active.minimumMotionDuration||0,...Object.entries(state.active.enginePositions||{}).filter(([id])=>id!==String(c.attackerId)&&id!==String(c.defenderId)).map(([id,target])=>metres(state.positions[id]||target,target)*1.5/rootRate));
     if(state.active.approachSample)state.active.sampleInterval=structuredClone(state.active.approachSample);
    }
    if(state.active.recoveryStarts){state.active.capturedRecoveryStarts=structuredClone(state.active.recoveryStarts);for(const id of Object.keys(state.active.recoveryStarts))state.active.recoveryStarts[id]=[...(state.positions[id]||state.active.recoveryStarts[id])];}
    if(state.controlContinuation){
     const e=state.active,c=state.controlContinuation;
     if(!e.contest&&!e.heavyTouch&&state.carrier===c.id&&state.side===c.side&&(isCarry(e)&&e.fromId===c.id&&e.fromSide===c.side||e.type==='enginePositionGap')){
      e.controlStart=structuredClone(c);e.carryFromControl=isCarry(e);
     }
     // Preserve the receiver's movement profile through every same-owner clip.
     // A real possession change, restart or contested contact ends this link.
     if(state.carrier!==c.id||state.side!==c.side||e.contest||e.heavyTouch||e.restartType)state.controlContinuation=null;
    }
    state.shotPreStatistics=structuredClone(state.eventStatistics);
    state.progress=0;state.eventStartBall=[...state.ball];state.startPositions=structuredClone(state.positions);
    if(state.active.type==='looseBall'&&!state.active.heavyGeometry){
     state.active.looseStartHeight=state.displayBallHeight??.15;
     if(state.parryFlight?.eventId===state.active.eventId)state.active.parryFlight={...structuredClone(state.parryFlight),continuation:true};
     state.parryFlight=null;
    }
    if(state.active.goalKickSetup&&['goalKick','freeKick','shot'].includes(state.active.type)){const g=state.active.goalKickSetup;state.active.goalKickRunUp={...structuredClone(g),start:[...(state.positions[String(g.id)]||g.behind)]};state.active.timingDuration=Math.max(duration(state.active),metres(state.active.goalKickRunUp.start,g.contact)*1.5/6/.19);}
    if(state.active.shotResult)state.active.keeperStart=[...(state.positions[String(state.active.goalkeeperId)]||state.active.enginePositions[String(state.active.goalkeeperId)])];
    if(state.active.shotResult){
     const e=state.active,contact=shotFrame(e,.76).keeper;
     e.timingDuration=Math.max(duration(e),metres(e.keeperStart,contact)*1.5/rootRate/.57);
     e.keeperTimingSource='visible-root-to-derived-contact; same root-rate scale as live movement';
     e.shotKickTiming={preparation:e.timingDuration*.19,kickPreparation:.12,kickFollow:.18,source:'release-relative strike; flight does not stretch foot follow-through'};
     const distance=metres(e.fromPos,shotTarget(e)),blend=ease(Math.max(0,Math.min(1,(distance-22)/20)));
     e.shotFlight={arc:(e.outcome==='goal'?1.15:e.outcome==='wide'?1.4:.55)+(['goal','wide','save'].includes(e.outcome)?blend*(e.outcome==='save'?.9:1.4):0),source:'derived-from-visible-shot-distance-and-committed-result; engine has no height/type telemetry'};
     if(e.outcome==='post'&&e.continuation?.type==='looseBall'){
      const recovery=state.queue.find(x=>x.type==='recovery'&&x.gameSecond===e.gameSecond&&x.fromPos?.every((v,i)=>Math.abs(v-e.continuation.toPos[i])<1e-8));
      if(recovery){const id=String(recovery.toId),start=state.positions[id]||recovery.toPos,land=[...e.continuation.toPos],dx=(land[0]-start[0])*1.05,dz=(land[1]-start[1])*.68,n=Math.hypot(dx,dz)||1;
       const approach=[land[0]-dx/n*.8/1.05,land[1]-dz/n*.8/.68];
       e.reboundChase={id:recovery.toId,side:recovery.toSide,land,approach,targets:structuredClone(recovery.enginePositions),chasers:Object.keys(recovery.recoveryStarts||{}),source:'recorded-recovery-chasers approach during real rebound; winner unchanged'};
      }
     }
    }
    // Budget the rendered segment, including mapped roots, rather than its
    // stale engine timing reference. Long passes cannot finish in a tiny clip.
    if(!state.active.contest&&!state.active.restartType&&!['kickoff','restartPosition','restartPlayers','restartWait','ballOut','goalKick','corner','freeKick','throwIn'].includes(state.active.type)){
     const e=state.active,pass=['pass','cross'].includes(e.type),carry=isCarry(e);
     const budgets=Object.entries(e.enginePositions||{}).map(([id,end])=>{
      if(e.shotResult&&(id===String(e.fromId)||id===String(e.goalkeeperId)))return 0;
      const fraction=carry&&id===String(e.fromId) ? .57 : pass&&id===String(e.fromId) ? .19 : pass&&id===String(e.toId) ? .76 : e.recoveryStarts ? .76 : 1;
      return metres(state.positions[id]||end,end)*1.5/rootRate/fraction;
     });
     if(pass)budgets.push(metres(e.fromPos,e.toPos)*1.5/flightRate/.57);
     e.timingDuration=Math.max(duration(e),...budgets);
    }
    if(fieldDelivery(state.active)){
     const e=state.active,touch=state.queue[0];
     if(e.success&&touch?.type==='firstTouch'&&touch.toId===e.toId&&touch.toSide===e.toSide&&touch.gameSecond===e.gameSecond&&touch.fromPos?.every((v,i)=>Math.abs(v-(e.engineToPos||e.toPos)[i])<1e-8)){
      e.controlEvent=state.queue.shift();
      // Compare original engine coordinates for identity; the shared display
      // mapping can legitimately put the same real contact at another root.
      e.controlEvent={...e.controlEvent,fromPos:[...e.toPos],toPos:[...e.toPos]};
     }
     e.deliveryTiming=deliveryPlan(state,e);e.timingDuration=e.deliveryTiming.total;
    }
    if(state.active.controlStart){const e=state.active,id=String(e.controlStart.id),start=state.positions[id],end=e.enginePositions?.[id];
     if(start&&end){const travel=metres(start,end);e.timingDuration=Math.max(duration(e),travel*1.5/rootRate,Math.sqrt(6*travel/(rootRate*2)));}
    }
    if(state.active.keeperDistribution?.kind==='punt'){
     const e=state.active,d=e.keeperDistribution,old=duration(e),drop=Math.sqrt(2*(1.05-.24)/9.81);
     d.kickRoot=[d.root[0]+d.forward[0]*.18/1.05,d.root[1]+d.forward[2]*.18/.68];
     d.release=[d.kickRoot[0]+d.forward[0]*.32/1.05,d.kickRoot[1]+d.forward[2]*.32/.68];
     d.timing={releaseAt:.22,contactAt:.22+drop,flight:old*.57,control:old*.24,kickPreparation:.12,kickFollow:.18,total:.22+drop+old*.81};
     e.fromPos=[...d.release];e.enginePositions[String(d.id)]=[...d.kickRoot];e.timingDuration=d.timing.total;
    }
    if(state.active.keeperDistribution?.kind==='throw'){const d=state.active.keeperDistribution,releaseAt=duration(state.active)*.19,scale=Math.min(1,releaseAt/.30);d.handTiming={releaseAt,startAt:Math.max(0,releaseAt-.30),preparation:.12*scale,throw:.18*scale,follow:.16,recover:.20};}
    planOffsets(state,state.active);state.activeDuration=duration(state.active);
    if(state.active.shotKickTiming)state.active.shotKickTiming.preparation=state.activeDuration*.19;
    planReboundChase(state);
    if(state.active.type==='shot'&&state.active.outcome==='wide'){
     const e=state.active,original=state.activeDuration;
     e.wideTiming={originalDuration:original,arrivalAt:original*.76,follow:Math.min(.12,original*.24)};
     e.timingDuration=e.wideTiming.arrivalAt+e.wideTiming.follow;state.activeDuration=e.timingDuration;
    }
    if(state.active.type==='shot'&&state.active.outcome==='save'&&state.active.shotResult?.saveType==='PARRY'){
     const e=state.active,next=state.queue[0];
     if(next?.type==='looseBall'&&next.reason==='parry'&&next.gameSecond===e.gameSecond&&next.fromPos?.every((v,i)=>Math.abs(v-e.shotResult.fromPos[i])<1e-8)){
      state.keeperControl=null;e.parryFlight={eventId:next.eventId,contact:shotTarget(e),land:[...next.toPos],tail:state.activeDuration*.24,loose:duration(next),source:'real-parry-to-real-loose-route; one-clock-cross-clip-flight'};
     }
    }state.durationEvent=state.active;state.clipStart=presentationSeconds-remaining;state.clipStartTimestamp=now-remaining*tempo/matchPlaybackRate()*1000;state.contactObserved=null;state.arrivalObserved=null;state.rateSegments=[];
   }
   const e=state.active;state.carryMotion=null;state.contestMotion=null;state.shotMotion=null;state.looseMotion=null;state.holdMotion=null;state.kickoffMotion=null;
   if(Number.isFinite(e.homeGoals)&&Number.isFinite(e.awayGoals))state.eventScore=[e.homeGoals,e.awayGoals];
   if(e.engineStatistics)state.eventStatistics=e.engineStatistics;
   const D=state.activeDuration,take=Math.min(remaining,(1-state.progress)*D);
   state.progress+=take/D;remaining-=take;
   const clockProgress=state.progress,p=e.contest?contestPhase(e,clockProgress):e.deliveryTiming?deliveryPhase(e,clockProgress):e.keeperDistribution?.timing?keeperDistributionPhase(e,clockProgress):e.wideTiming?(clockProgress*D<=e.wideTiming.arrivalAt?clockProgress*D/e.wideTiming.originalDuration:.76+.24*Math.min(1,(clockProgress*D-e.wideTiming.arrivalAt)/e.wideTiming.follow)):clockProgress;state.actionProgress=p;state.displayMatchSeconds=e.sampleInterval?e.sampleInterval.fromGameSecond+(e.sampleInterval.toGameSecond-e.sampleInterval.fromGameSecond)*clockProgress:(e.gameSecond??matchSecond());
   const pass=['pass','cross','corner','goalKick','freeKick'].includes(e.type)||!!e.headerShot,u=e.carryFromControl?clockProgress:p<.19?0:p<.76?(p-.19)/.57:1;
   if(pass){
    if(state.rateSegments.at(-1)?.speed!==M.speed||state.rateSegments.at(-1)?.tempo!==tempo)state.rateSegments.push({progress:p,speed:M.speed,effectiveSpeed:matchPlaybackRate(),tempo});
    if(p>=.19&&state.contactObserved==null)state.contactObserved=now;
    if(p>=.76&&state.arrivalObserved==null)state.arrivalObserved=now;
    state.ball=e.headerShot?lerp(e.fromPos,headerContact(e.headerShot),Math.max(0,Math.min(1,(p-.19)/.81))):lerp(e.fromPos,e.toPos,e.deliveryTiming?deliveryFlight(u,e.deliveryTiming.flight):flight(u));state.carrier=p<.19?e.fromId:e.headerShot||e.looseResultId||['goalKick','freeKick'].includes(e.type)&&e.success===false?null:p<.76?null:e.toId;state.side=state.carrier==null?'none':p<.19?e.fromSide:e.toSide;}
   else if(isCarry(e)){
    // Derived touches on the recorded segment, not new decisions or physical engine data.
    const t=ease(u),d=metres(e.fromPos,e.toPos),travel=d*t,phase=(travel/1.25)%1;
    const lead=.18*Math.sin(Math.PI*phase)**2*Math.sin(Math.PI*t)**2;
    const ballT=d?Math.min(1,t+lead/d):t;
    state.ball=lerp(e.fromPos,e.toPos,ballT);state.carrier=e.heavyTouch&&p>=.76?null:e.fromId;state.side=state.carrier==null?'none':e.fromSide;
    state.carryMotion={eventId:e.eventId,travelMetres:travel,touchPhase:phase,leadMetres:lead,source:'derived-distance-touches-on-engine-segment'};
   }
   else if(e.type==='looseBall'||e.type==='recovery'){state.ball=e.type==='recovery'?lerp(state.eventStartBall,e.toPos,ease(Math.min(1,p/.76))):e.heavyGeometry?[...state.ball]:lerp(state.eventStartBall,e.toPos,p);state.carrier=e.type==='recovery'&&p>=.76?e.toId:null;state.side=state.carrier==null?'none':e.toSide;state.looseMotion={phase:e.type==='recovery'?(p<.65?'approach':p<.76?'reach':'control'):'unowned',event:p<.76&&e.type==='recovery'?{...e,text:'Top sahipsiz · gerçek kazanım teması bekleniyor'}:e,source:'captured-chaser-starts; derived-interpolation-and-contact'};}
   else if(e.type==='enginePositionGap'){state.ball=e.goalReset?(p*D<.15?[...e.fromPos]:[...e.toPos]):lerp(e.fromPos,e.toPos,ease(p));state.carrier=e.carryId;state.side=e.carrySide;}
   else if(e.restartReset){state.ball=p*D<.15?[...e.fromPos]:[...e.toPos];state.carrier=null;state.side='none';}
   else if(e.kickoffExchange){const k=e.kickoffExchange,back=p>=.55,a=back?k.point:e.fromPos,b=back?e.fromPos:k.point,q=back?(p-.55)/.45:p/.55,t=q<.19?0:q<.76?(q-.19)/.57:1;
    state.ball=lerp(a,b,flight(t));state.carrier=q<.19?(back?k.receiverId:e.fromId):q<.76?null:back?e.fromId:k.receiverId;state.side=state.carrier==null?'none':e.fromSide;
    state.kickoffMotion={fromId:back?k.receiverId:e.fromId,toId:back?e.fromId:k.receiverId,fromPos:a,toPos:b,progress:q,source:k.source};
   }
   else{const point=animationPoint(e,p,state.eventStartBall);if(point)state.ball=point;}

   const targets=e.enginePositions;
   if(targets)for(const [key,target] of Object.entries(targets)){
    const start=e.recoveryStarts?.[key]||state.startPositions[key]||target;
    const fraction=isCarry(e)&&key===String(e.fromId)?u:pass&&key===String(e.fromId)?Math.min(1,e.deliveryTiming?clockProgress*D/e.deliveryTiming.preparation:p/.19):pass&&key===String(e.toId)?Math.min(1,e.deliveryTiming?clockProgress*D/(e.deliveryTiming.preparation+e.deliveryTiming.flight):p/(e.headerShot?1:.76)):e.recoveryStarts?Math.min(1,p/.76):e.wideTiming?Math.min(.76,clockProgress*D/e.wideTiming.originalDuration):clockProgress;
    state.positions[key]=(e.goalReset||e.restartReset)?(p*D<.15?[...start]:[...target]):lerp(start,target,ease(fraction));
   }
   if(e.goalKickRunUp){const g=e.goalKickRunUp;state.positions[String(g.id)]=lerp(g.start,g.contact,ease(Math.min(1,p/.19)));if(p<.19){state.ball=[...g.ball];state.carrier=null;state.side='none';}}
   if(e.kickoffExchange){state.positions[String(e.fromId)]=[...e.fromPos];state.positions[String(e.kickoffExchange.receiverId)]=[...e.kickoffExchange.point];}
   if(e.heavyGeometry){
    const g=e.heavyGeometry,key=String(g.carrierId);
    if(isCarry(e)){
     const t=ease(u),d=metres(g.start,g.touch),travel=d*t,phase=travel/1.25%1,lead=.18*Math.sin(Math.PI*phase)**2*Math.sin(Math.PI*t)**2;
     state.positions[key]=lerp(g.start,g.touch,t);state.ball=p<=.76?lerp(g.start,g.touch,d?Math.min(1,t+lead/d):t):lerp(g.touch,g.rollEnd,ease((p-.76)/.24));
     state.carryMotion={eventId:e.eventId,travelMetres:travel,touchPhase:phase,leadMetres:lead,heavyContact:g.touch,releaseProgress:.76,source:g.source};
    }else if(e.type==='looseBall'){
     state.positions[key]=[...g.touch];state.ball=lerp(g.rollEnd,g.land,ease(p));
    }else if(e.type==='recovery'){
     state.positions[key]=lerp(g.touch,e.enginePositions[key]||g.land,ease(e.toId===g.carrierId?Math.min(1,p/.76):p));state.ball=[...g.land];
    }
   }
   if(e.type==='shot'&&e.shotResult){
    const f=shotFrame(e,p),result=e.shotResult;
    if(p<.19)state.eventStatistics=state.shotPreStatistics;
    state.ball=f.ball;state.positions[String(e.fromId)]=e.goalKickRunUp?lerp(e.goalKickRunUp.start,e.goalKickRunUp.contact,ease(Math.min(1,p/.19))):[...e.fromPos];state.positions[String(e.goalkeeperId)]=f.keeper;
    if(f.blocker)state.positions[String(result.toId)]=f.blocker;
    if(e.reboundChase&&p>=.76)for(const [id,t] of Object.entries(e.reboundChase.tracks))state.positions[id]=lerp(t.impact,t.end,ease((p-.76)/.24));
    state.carrier=p<.19&&!f.header?e.fromId:e.outcome==='save'&&result.saveType==='CATCH'&&p>=.76?e.goalkeeperId:null;
    state.side=p<.19&&!f.header?e.fromSide:state.carrier==null?'none':result.toSide;
    state.shotMotion={...f,progress:p,event:p>=.76||f.goalCrossed?presentationEvent(result):presentationEvent(e),phase:p<.19?'preparation':p<.76?'flight':'result'};
    if(f.goalCrossed)state.eventScore=[result.homeGoals,result.awayGoals];
    if(e.outcome==='goal'&&state.netImpact?.eventId!==e.eventId){
     const a=(e.fromPos[0]-50)*1.05,b=(f.target[0]-50)*1.05,dir=b>0?1:-1,fraction=(dir*(54.8-.14)-a)/(b-a),contactP=.19+.57*fraction;
     if(p>=contactP&&fraction>=0&&fraction<=1)state.netImpact={dir,eventId:e.eventId,point:[dir*54.8,.15,(e.fromPos[1]+(f.target[1]-e.fromPos[1])*fraction-50)*.68],seconds:state.clipStart+contactP*D,source:'shared-shot/net intersection; retained across delayed frames'};
    }
   }
   if(e.contest){
    const c=e.contest,f=contestFrame(e,p),won=p>=c.contactProgress;
    state.positions[String(c.attackerId)]=f.attacker;state.positions[String(c.defenderId)]=f.defender;state.ball=f.ball;
    state.carrier=won&&!c.attackerKeepsBall?c.defenderId:c.attackerId;state.side=won&&!c.attackerKeepsBall?c.defenderSide:c.attackerSide;
    if(won){state.carryMotion=null;state.eventStatistics=c.tackle.engineStatistics||state.eventStatistics;}
    state.contestMotion={...c,phase:p<.19?'preparation':p<.65?'approach':p<.76?'reach':p<.91?'contact-result':'recovery',progress:p,clockProgress,timing:contestPath(e).timing,clearanceMetres:f.clearance,event:won?(c.result||c.tackle):p<.65?e:c.press};
   }
   if(e.type==='hold'){
    state.ball=[...e.fromPos];state.carrier=e.success===false&&p>=.76?null:e.fromId;state.side=state.carrier==null?'none':e.fromSide;
    state.holdMotion={...e.shield,progress:p,phase:p<.65?'shield':p<.76?'pressure':e.success===false?'release':'retained',event:p<.76&&e.success===false?{...e,text:'Oyuncu topu korumaya çalışıyor'}:e,source:e.shield?.source||'derived-shield-pose-on-real-hold'};
   }
   state.controlMotion=e.controlEvent&&p>=.76?{event:e.controlEvent,progress:(p-.76)/.24}:null;
   applyOffsets(state,e,p);
   if(e.looseCollection){
    const c=e.looseCollection,q=ease(Math.max(0,(p-.76)/.24));
    state.ball=[...c.land];state.carrier=p>=.76?c.id:null;state.side=state.carrier==null?'none':c.side;
    if(c.keeper&&p>=.76&&!state.keeperControl)state.keeperControl={id:c.id,side:c.side,forward:[...c.forward],caughtAt:state.clipStart+.76*D,eventId:e.eventId,source:c.source};
    // Hands lift the ball only after the real winner has reached its landing.
    if(c.keeper)state.collectionHeight=.15+.90*q;
   }
   if(e.type==='shot'&&e.outcome==='save'&&e.shotResult.saveType==='CATCH'&&p>=.76){
    if(state.keeperControl?.eventId!==e.eventId)state.keeperControl={id:e.goalkeeperId,side:e.shotResult.toSide,forward:[...state.shotMotion.keeperForward],caughtAt:state.clipStart+.76*D,eventId:e.eventId,source:'derived-visible-catch-control; engine has no carried-ball height'};
   }
   if(e.keeperDistribution){
    const d=e.keeperDistribution,t=d.timing,sec=clockProgress*D,held=t?sec<t.releaseAt:p<.19;
    const root=t?lerp(d.root,d.kickRoot,ease(Math.min(1,sec/t.releaseAt))):d.root;state.positions[String(d.id)]=[...root];
    if(held){const q=ease(t?sec/t.releaseAt:p/.19),a=Math.atan2(d.initialForward[0],d.initialForward[2]),b=Math.atan2(d.forward[0],d.forward[2]),turn=Math.atan2(Math.sin(b-a),Math.cos(b-a)),f=[Math.sin(a+turn*q),0,Math.cos(a+turn*q)];
     if(state.keeperControl)state.keeperControl.forward=f;
     state.ball=[root[0]+f[0]*.32/1.05,root[1]+f[2]*.32/.68];
    }else {state.keeperControl=null;if(t&&sec<t.contactAt){state.ball=[...d.release];state.carrier=null;state.side='none';}if(e.keeperLooseResult&&p>=.76){state.carrier=null;state.side='none';}}
    if(d.kind==='throw'){d.handMotion=keeperThrowFrame(e,sec);if(held)state.ball=[...d.handMotion.ball];}
   }
   if(e.type==='looseBall'&&e.parryFlight){const t=e.parryFlight,f=parryFrame(t,t.tail+Math.min(clockProgress*D,t.loose));state.ball=f.ball;state.carrier=null;state.side='none';}
   const controlled=state.keeperControl;
   if(controlled&&!state.shotMotion){
    if(state.carrier===controlled.id){const root=state.positions[String(controlled.id)];state.ball=e.looseCollection?[...e.looseCollection.land]:e.keeperDistribution?.handMotion?[...e.keeperDistribution.handMotion.ball]:[root[0]+controlled.forward[0]*.32/1.05,root[1]+controlled.forward[2]*.32/.68];}
    else if(!e.keeperDistribution)state.keeperControl=null;
   }
   // A non-ball event can still contain movement of the actual ball carrier.
   // Keep the owned ball on that recorded root rather than leave it behind.
   if(!state.keeperControl&&!e.contest&&!pass&&e.type!=='enginePositionGap'&&animationPoint(e,p,state.eventStartBall)==null&&state.carrier!=null&&state.positions[String(state.carrier)])state.ball=[...state.positions[String(state.carrier)]];
   state.ballState={...state.ballState,position:[...state.ball],ownerId:state.carrier,state:e.sampleInterval?.phase==='restart-placement'||e.goalKickSetup&&(e.type!=='goalKick'||p<.19)?'RESTART_SETUP':state.carrier==null?'LOOSE_BALL':'LIVE',height:aerialHeight(e,p),travelType:e.travelType||'ground',target:e.toPos||null,travelDuration:D};
   state.displayBallHeight=state.shotMotion?.height??(e.type==='enginePositionGap'?e.ballHeight??.15:null)??(e.headerShot?.15+(1.704-.15)*Math.max(0,Math.min(1,(p-.19)/.81))+Math.sin(Math.PI*Math.max(0,Math.min(1,(p-.19)/.81)))*2.4:.15);
   if(e.type==='looseBall'&&!e.heavyGeometry)state.displayBallHeight=e.parryFlight?parryFrame(e.parryFlight,e.parryFlight.tail+Math.min(clockProgress*D,e.parryFlight.loose)).height:(e.looseStartHeight??.15)*(1-ease(clockProgress))+.15*ease(clockProgress);
   if(state.keeperControl&&!state.shotMotion)state.displayBallHeight=e.looseCollection?state.collectionHeight:1.05;
   if(e.keeperDistribution){const t=e.keeperDistribution.timing,sec=clockProgress*D;state.displayBallHeight=t?(sec<t.releaseAt?1.05:sec<t.contactAt?1.05-4.905*(sec-t.releaseAt)**2:.24*(1-u)+.15*u+Math.sin(Math.PI*u)*Math.min(3.8,metres(e.fromPos,e.toPos)/12)):(p<.19?(e.keeperDistribution.handMotion?.height??1.05):1.05*(1-u)+.15*u+(e.travelType==='aerial'?Math.sin(Math.PI*u)*Math.min(3.8,metres(e.fromPos,e.toPos)/12):0));if(t)state.ballState.travelType='aerial';}
   if(state.keeperControl||e.keeperDistribution||e.parryFlight||e.type==='looseBall'||state.shotMotion)state.ballState.height=state.displayBallHeight;
   state.lastTime=now;state.presentationSeconds=presentationSeconds;state.presentationDelta=delta;
   if(clockProgress>=1-1e-8){
    if(e.type!=='enginePositionGap'&&!state.shotMotion&&!e.headerShot&&!e.contest)finishPitchAction(state,e,now);else if(e.type==='enginePositionGap'){state.carrier=e.endOwner;state.side=e.endSide;state.ballState.ownerId=state.carrier;}
    // Coordinate references preserve the previous clip budgets; there is still
    // one clock and one queue. These are never rendered or engine positions.
    state.durationPositions=structuredClone(e.timingTargets||((e.controlMapped||e.duelRootMapped||e.restartDisplayPoint||e.restartReset||e.type==='ballOut')?e.rawEnginePositions||e.enginePositions:state.positions)||state.positions);
    if(e.type==='shot'&&e.shotResult){state.durationPositions[String(e.fromId)]=[...(e.engineFromPos||e.fromPos)];state.durationPositions[String(e.goalkeeperId)]=keeperTarget(e);if(e.outcome==='block'&&shotInterventionActor(e.shotResult).kind==='field')state.durationPositions[String(e.shotResult.toId)]=shotFrame(e,1).blocker;}
    if(e.deliveryTiming&&state.carrier!=null)state.controlContinuation={id:state.carrier,side:state.side,eventId:e.controlEvent?.eventId||e.eventId};
    if(e.contest){
     const c=e.contest,f=contestFrame(e,1);state.duelRootLinks??={};
     for(const [id,display,engine] of [[c.attackerId,f.attacker,c.point],[c.defenderId,f.defender,c.defenderEnd]])state.duelRootLinks[String(id)]=display.map((v,i)=>v-engine[i]+(state.duelRootLinks[String(id)]?.[i]||0));
    }
    if(e.contest){const f=contestFrame({...e,contest:e.timingContest||e.contest},1);state.durationPositions[String(e.contest.attackerId)]=f.attacker;state.durationPositions[String(e.contest.defenderId)]=f.defender;if(e.contest.attackerKeepsBall){const c=e.timingContest||e.contest;state.durationPositions[String(c.attackerId)]=[...(e.engineToPos||c.point)];state.durationPositions[String(c.defenderId)]=[...c.defenderEnd];}}
    state.durationBall=e.timingContest?[...contestFrame({...e,contest:e.timingContest},1).ball]:e.timingTo?[...e.timingTo]:e.restartDisplayPoint||e.restartReset?[...(e.engineToPos||e.toPos)]:e.controlMapped&&!state.shotMotion&&!e.headerShot?(animationPoint(e,1,state.durationBall)?[...(e.engineToPos||e.toPos||state.ball)]:state.durationPositions[String(state.carrier)]||[...state.ball]):[...state.ball];
    if(e.duelRootMapped&&!e.shotResult&&!e.contest)state.durationBall=[...(e.engineToPos||state.durationPositions[String(state.carrier)]||state.ball)];
    if(e.contest?.attackerKeepsBall)state.durationBall=[...(e.engineToPos||(e.timingContest||e.contest).point)];
    if(e.outcome==='save'&&e.shotResult?.saveType==='CATCH')state.durationBall=keeperTarget(e);
    if(pass){const metres=Math.hypot((e.toPos[0]-e.fromPos[0])*1.05,(e.toPos[1]-e.fromPos[1])*.68);logs.push({eventId:e.eventId,gameSecond:e.gameSecond,metres,duration:D,flight:e.deliveryTiming?.flight??D*.57,tempo,speed:M.speed,effectiveSpeed:matchPlaybackRate(),screenDurationAtConstantSpeed:D*tempo/matchPlaybackRate(),screenFlightAtConstantSpeed:(e.deliveryTiming?.flight??D*.57)*tempo/matchPlaybackRate(),actualWallEnd:(now-wallOrigin)/1000,actualScreenDuration:(now-state.clipStartTimestamp)/1000,presentationEnd:presentationSeconds,observedFlightScreenDuration:(state.arrivalObserved-state.contactObserved)/1000,rateSegments:structuredClone(state.rateSegments),success:e.success,toId:e.toId,queue:state.queue.length,clock:'existing liveFrameStep → shared presentation seconds; atomic-minute backpressure'});}
    if(e.looseResultId||e.keeperLooseResult||['goalKick','freeKick'].includes(e.type)&&e.success===false){state.carrier=null;state.side='none';state.ballState.ownerId=null;}
    if(state.shotMotion)state.afterShot=true;
    if(e.reboundChase){state.parryLooseLand={gameSecond:e.gameSecond,point:[...state.ball]};state.keeperControl=null;}
    if(e.keeperDistribution?.timing){const d=e.keeperDistribution,a=state.keeperRootAnchors?.[String(d.id)];if(a)a.display=a.display.map((v,i)=>v+d.kickRoot[i]-d.root[i]);}
    if(e.type==='looseBall'&&e.parryFlight){state.parryLooseLand={gameSecond:e.gameSecond,point:[...state.ball]};state.keeperControl=null;}
    if(e.looseCollection&&state.duelRootLinks)delete state.duelRootLinks[String(e.toId)];
    if(e.looseCollection?.keeper){const c=e.looseCollection;state.keeperRootAnchors??={};state.keeperRootAnchors[String(c.id)]={id:c.id,side:c.side,engine:[...c.engineRoot],display:[...state.positions[String(c.id)]]};state.controlAnchor=structuredClone(state.keeperRootAnchors[String(c.id)]);}
    if(e.type==='shot'&&e.outcome==='save'&&state.shotMotion){
     const f=state.shotMotion;
     state.keeperRecovery={id:e.goalkeeperId,side:e.shotResult.toSide,forward:[...f.keeperForward],root:[...f.keeper],contact:[...f.target],startedAt:state.clipStart+D,duration:.25,source:'visible-save-end-pose-on-common-clock'};
     if(e.parryFlight)state.parryFlight=structuredClone(e.parryFlight);
    }
    if(state.shotMotion?.keeperIntervention){
     // The engine result ball point is not the goalkeeper's recorded root.
     // Anchor to that actual root sample, and retain its recorded increments
     // after both catches and parries. Only a real restart clears this link.
     const id=e.goalkeeperId,engine=e.shotResult.enginePositions?.[String(id)]||e.rawEnginePositions?.[String(id)]||e.enginePositions[String(id)];
     state.keeperRootAnchors??={};state.keeperRootAnchors[String(id)]={id,side:e.shotResult.toSide,engine:[...engine],display:[...state.positions[String(id)]]};
     if(e.outcome==='save'&&e.shotResult.saveType==='CATCH'){state.anchorSettled=false;state.controlAnchor=structuredClone(state.keeperRootAnchors[String(id)]);}
    }
    if(state.shotMotion?.goalCrossed||e.type==='goal')state.afterGoal=true;
    const goal=e.type==='shot'&&e.outcome==='goal'?e.shotResult:e.type==='goal'?e:null;
    if(goal&&state.lastGoalFeedbackId!==goal.eventId){state.lastGoalFeedbackId=goal.eventId;presentationSeconds-=remaining;state.presentationSeconds=presentationSeconds;remaining=0;state.goalPresentation={stage:'net',goal:structuredClone(goal),netUntil:Math.max(presentationSeconds,(state.netImpact?.seconds??presentationSeconds)+.35)};if(state.goalPresentation.netUntil<=presentationSeconds+1e-9)startGoalFeedback(state,now);}
    state.active=null;state.progress=0;state.actionProgress=0;state.controlMotion=null;state.contestMotion=null;state.carryMotion=null;state.shotMotion=null;state.looseMotion=null;state.holdMotion=null;state.kickoffMotion=null;
   }
  }
  const completed=finishing()&&!state.goalPresentation&&!state.active&&!state.queue.length&&!state.batchEnd;
  if(completed){state.terminalPhase='complete';state.terminalPaused=false;state.displayMatchSeconds=5400;state.eventScore=[M.hg,M.ag];}
  if(window.MatchView)window.MatchView.publish(state);
  if(completed||M.reason==='half'&&!halfPending())render();
 }
 const finishing=()=>enabled&&pitchV73?.match===M&&pitchV73.terminalPhase==='draining';
 const halfPending=()=>enabled&&M?.reason==='half'&&pitchV73?.match===M&&!!(pitchV73.active||pitchV73.queue.length||pitchV73.batchEnd||pitchV73.goalPresentation);
 const paused=()=>finishing()?!!pitchV73.terminalPaused:halfPending()?!!pitchV73.halfPaused:!!M?.pause;
 window.ManagerStoryLive3D={
  get finishing(){return finishing()},get halfPending(){return halfPending()},get paused(){return paused()},
  goalImageReady(match,eventId,failed=false){if(match!==M)return;const g=currentPitchState().goalPresentation;if(g?.stage==='image'&&g.goal.eventId===eventId){g.imageReady=!failed;g.imageFailed=failed;}},
  beginFinish(){const s=currentPitchState();s.terminalPhase='draining';s.terminalPaused=false;},
  setTerminalPaused(value){if(finishing())pitchV73.terminalPaused=!!value;else if(halfPending())pitchV73.halfPaused=!!value;},beginMotionSample,endMotionSample,captureShield,linkCarrierGain,linkDribbleContest,linkPassCut,captureShotStart,captureHeavyTouch,linkRecovery,linkLooseTouch,contestFrame,get inPositionUpdate(){return inPositionUpdate},get enabled(){return enabled},get tempo(){return tempo},get time(){return presentationSeconds},get logs(){return structuredClone(logs)},
  enable(){const joining=!enabled;syncMatch();enabled=true;if(M){if(joining&&typeof preparePitchGoalPhotos==='function')preparePitchGoalPhotos();const s=currentPitchState();if(joining){s.active=s.active?structuredClone(s.active):null;s.queue=s.queue.map(e=>structuredClone(e));s.durationEvent=null;}for(const id of [...M.active,...M.oppIds])s.positions[String(id)]??=eventPoint(id,typeof id==='string'?'opp':'user');s.eventScore??=[M.hg,M.ag];s.eventStatistics??={shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()};}},
  disable(){enabled=false;observedMatch=null;presentationSeconds=0;wallSeconds=0;logs=[];motionSample=null;inPositionUpdate=false;},setTempo(n){if(![1,4].includes(Number(n)))throw Error('Invalid tempo');tempo=Number(n)},step,
  duration,contestPhase,contestTiming:e=>structuredClone(contestPath(e).timing), togglePause(){if(!M)return;if(paused())resumeLive();else pauseLive()},setSpeed(n){setMatchSpeed(n)}
 };
})();
