/* Opt-in presentation scheduler on the EXISTING liveFrameStep. No RNG or second engine. */
(() => {
 let enabled=false,tempo=4,presentationSeconds=0,wallSeconds=0,logs=[],observedMatch=null,wallOrigin=0,inPositionUpdate=false,motionSample=null;
 const lerp=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),ease=u=>u*u*(3-2*u);
 const isCarry=e=>['dribble','ballCarry','run'].includes(e.type);
 const duration=e=>{
  const base=eventAnimationTime(e);
  if(e.type==='shot'&&e.shotResult){
   const target=shotTarget(e),start=e.enginePositions[String(e.goalkeeperId)]||target;
   return Math.max(.7,metres(e.fromPos,target)/22/.57,metres(start,keeperTarget(e))*1.5/24/.57);
  }
  if(!isCarry(e))return base;
  const d=metres(e.fromPos,e.toPos),others=Math.max(0,...Object.entries(e.enginePositions||{}).map(([id,p])=>metres(currentPitchState().positions[id]||p,p)));
  return Math.max(base,d*1.5/(24*.57),others*1.5/24,e.contest?contestDuration(e):0);
 };
 // Presentation-only linkage of three already committed engine events.
 function linkDribbleContest(data){
  if(!enabled)return;const q=currentPitchState().queue,[carry,press,tackle]=q.slice(-3);
  if(carry?.type!=='dribble'||press?.type!=='press'||tackle?.type!=='tackle'||carry.fromId!==data.attackerId||tackle.defenderId!==data.defenderId)return;
  carry.contest=structuredClone({...data,press,tackle,source:'captured-before-defender-placement; derived-approach-and-contact',contactProgress:.76});
 }
 const xy=p=>[p[0]*1.05,p[1]*.68],pct=p=>[p[0]/1.05,p[1]/.68];
 function contestFrame(e,p){
  const c=e.contest,A=xy(c.attackerStart),B=xy(c.point),S=xy(c.defenderStart),E=xy(c.defenderEnd),dx=B[0]-A[0],dy=B[1]-A[1],n=Math.hypot(dx,dy)||1,dir=[dx/n,dy/n];
  const sign=((S[0]-B[0])*-dir[1]+(S[1]-B[1])*dir[0])<0?-1:1,normal=[-dir[1]*sign,dir[0]*sign],contact=B.map((v,i)=>v+normal[i]*.62);
  const u=Math.max(0,Math.min(1,(p-.19)/.57)),t=ease(u),r=ease(Math.max(0,Math.min(1,(p-.76)/.24)));
  const attacker=lerp(A,B,t).map((v,i)=>v-(c.attackerKeepsBall?0:dir[i]*.75*r));
  let defender=p<.76?lerp(S,contact,ease(Math.max(0,Math.min(1,p/.76)))):c.attackerKeepsBall?lerp(contact,E,r):contact;
  // Body-root clearance only; immutable engine endpoints remain in c/enginePositions.
  const vector=defender.map((v,i)=>v-attacker[i]),gap=Math.hypot(...vector);
  if(gap<.62)defender=attacker.map((v,i)=>v+(gap>1e-8?vector[i]/gap:normal[i])*.62);
  const travel=Math.hypot(dx,dy)*t,phase=travel/1.25%1,lead=.18*Math.sin(Math.PI*phase)**2*Math.sin(Math.PI*t)**2;
  let ball=lerp(A,B,t).map((v,i)=>v+dir[i]*lead);
  if(p>=.76&&!c.attackerKeepsBall)ball=lerp(B,defender,ease(Math.max(0,Math.min(1,(p-.76)/.15))));
  return {attacker:pct(attacker),defender:pct(defender),ball:pct(ball),travel,phase,lead,clearance:Math.hypot(...defender.map((v,i)=>v-attacker[i]))};
 }
 function contestDuration(e){
  let peak=0,last=contestFrame(e,0);for(let i=1;i<=500;i++){const frame=contestFrame(e,i/500);peak=Math.max(peak,metres(last.attacker,frame.attacker)*500,metres(last.defender,frame.defender)*500);last=frame;}
  return peak/24*1.02;
 }
 // Derived shot geometry. Raw percent goal mouth is wider than the real 7.32m goal.
 // Preserve raw endpoints on e; remap only an already decided goal into the real net.
 function shotTarget(e){return e.outcome==='goal'?[e.toPos[0]>50?102.1:-2.1,50+(e.toPos[1]-50)*.55]:e.outcome==='wide'?[e.toPos[0]>50?102:-2,e.toPos[1]]:[...e.toPos];}
 function keeperTarget(e){const t=shotTarget(e),dir=e.toPos[0]>50?1:-1;
  return [e.outcome==='wide'?e.toPos[0]:t[0]-dir*.55/1.05,['goal','wide'].includes(e.outcome)?50+(e.toPos[1]-50)*.25:t[1]];
 }
 function shotFrame(e,p){
  const target=shotTarget(e),u=Math.max(0,Math.min(1,(p-.19)/.57)),dir=e.toPos[0]>50?1:-1;
  let ball=lerp(e.fromPos,target,u),height=.15+(1.05-.15)*u+Math.sin(Math.PI*u)*.55;
  const kStart=e.enginePositions[String(e.goalkeeperId)]||keeperTarget(e),kEnd=keeperTarget(e);
  // Goal keeper cannot reach the ball; his attempt stays inside the field.
  if(e.outcome==='goal')kEnd[0]=dir>0?98:2;
  const keeper=lerp(kStart,kEnd,ease(u));
  const cross=e.outcome==='goal'?( (dir>0?100:0)-e.fromPos[0])/(target[0]-e.fromPos[0]):null;
  if(e.outcome==='goal'){height=.15+Math.sin(Math.PI*u)*1.15;if(p>.76)height=.15;}
  if(e.outcome==='wide'){height=.15+Math.sin(Math.PI*u)*1.4;}
  if(e.outcome==='save'&&p>=.76){
   const r=ease(Math.max(0,Math.min(1,(p-.76)/.24)));
   if(e.shotResult.saveType==='CATCH'){ball=lerp(target,keeper,r);height=1.05*(1-r)+.15*r;}
   else height=1.05*(1-r)+.15*r;
   // PARRY/DEFLECT keep the real result point: next existing loose-ball/restart owns continuation.
  }
  return {ball,keeper,height,contactProgress:.19,resultProgress:.76,lineCrossProgress:cross==null?null:.19+.57*cross,
   goalCrossed:cross!=null&&u>=cross,source:'derived-shot-flight-and-keeper-reach',result:e.shotResult};
 }
 const positions=()=>Object.fromEntries([...M.active,...M.oppIds].map(id=>[String(id),eventPoint(id,typeof id==='string'?'opp':'user')]));
 function beginMotionSample(){if(!enabled)return;inPositionUpdate=true;motionSample={fromGameSecond:Math.max(0,M.min*60-60),toGameSecond:M.min*60,fromPositions:positions(),fromBall:[...M.ballState.position],fromOwner:M.ballOwner,fromSide:M.ballSide};}
 function endMotionSample(){if(!enabled||!motionSample)return;inPositionUpdate=false;Object.assign(motionSample,{toPositions:positions(),toBall:[...M.ballState.position],toOwner:M.ballOwner,toSide:M.ballSide,phase:'after-position-update-before-action-decisions'});}

 const metres=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
 function keyframeTransition(state,targets,to,gameSecond,owner=state.carrier,side=state.side){
  const gap=metres(state.ball,to),movement=Math.max(gap,...Object.entries(targets||{}).map(([id,p])=>metres(state.positions[id]||p,p)));
  if(movement<=.02)return null;
  // Unknown intermediate trajectory: bounded interpolation of recorded engine samples.
  // smoothstep peak derivative is 1.5; /4 at 1x gives a maximum 6 m/s.
  return {type:'enginePositionGap',fromPos:[...state.ball],toPos:[...to],enginePositions:structuredClone(targets),
   presentationDuration:Math.max(.15,movement*1.5/24),gameSecond,gapMetres:gap,maxMovementMetres:movement,
   carryId:state.carrier,carrySide:state.side,endOwner:owner,endSide:side,movementSource:'derived-between-engine-keyframes'};
 }
 // Stage 3A braking curve, same contact/arrival boundaries and endpoint.
 const flight=u=>{if(u<.7)return u*1.15;const t=(u-.7)/.3;return (2*t*t*t-3*t*t+1)*.805+(t*t*t-2*t*t+t)*.345+(-2*t*t*t+3*t*t);};
 function step(dt,now){
  if(!enabled||!M||M.pause||M.finished)return;
  if(observedMatch!==M){observedMatch=M;presentationSeconds=0;wallSeconds=0;logs=[];wallOrigin=now-dt*1000;}
  wallSeconds+=dt;
  const state=currentPitchState(),delta=Math.max(0,dt)*M.speed/tempo;
  presentationSeconds+=delta;state.presentationSeconds=presentationSeconds;state.presentationDelta=delta;
  // Drain only the current atomic engine minute. Never produce a future minute behind a queue.
  if(state.active&&state.durationEvent!==state.active){
   state.activeDuration=duration(state.active);state.durationEvent=state.active;state.startPositions=structuredClone(state.positions);
   state.clipStartTimestamp=now-state.progress*state.activeDuration*tempo/M.speed*1000;
   state.contactObserved=null;state.arrivalObserved=null;state.rateSegments=[];
  }
  let remaining=delta;
  if(!state.active&&!state.queue.length){
   // Finish the current committed minute before generating exactly ONE next minute.
   // No speculative future batches; new manager inputs are read at this boundary.
   if(state.batchEnd){
    const last=state.batchEnd;state.batchEnd=null;
    const tail=keyframeTransition(state,last.positions,last.ball,last.gameSecond,last.owner,last.side);
    if(tail){tail.sampleInterval={fromGameSecond:last.gameSecond,toGameSecond:last.gameSecond,phase:'post-event-settlement'};tail.homeGoals=last.score[0];tail.awayGoals=last.score[1];tail.engineStatistics=last.statistics;state.queue.push(tail);}else {state.eventScore=last.score;state.eventStatistics=last.statistics;}
   }
   if(!state.queue.length){
    const start=matchSecond(),oldScore=state.eventScore||[M.hg,M.ag],oldStatistics=state.eventStatistics||{shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()};
    motionSample=null;advanceLive((60-start%60)/90/M.speed);
    if(motionSample?.toPositions){
     const during=state.queue.filter(e=>e.sampleTime?.stage==='during-position-update');
     state.queue=state.queue.filter(e=>e.sampleTime?.stage!=='during-position-update');
     const sample=motionSample;state.positionSamples=structuredClone(sample);
     const move=keyframeTransition(state,sample.toPositions,sample.toBall,sample.toGameSecond,sample.toOwner,sample.toSide)||{type:'enginePositionGap',fromPos:[...state.ball],toPos:[...sample.toBall],enginePositions:sample.toPositions,carryId:state.carrier,carrySide:state.side,endOwner:sample.toOwner,endSide:sample.toSide,gapMetres:0,maxMovementMetres:0};
     move.presentationDuration=Math.max(move.presentationDuration||0,(sample.toGameSecond-sample.fromGameSecond)/90);
     move.sampleInterval={fromGameSecond:sample.fromGameSecond,toGameSecond:sample.toGameSecond,phase:sample.phase};
     move.movementSource='derived-between-minute-position-samples';move.motionEvents=during;move.gameSecond=sample.toGameSecond;
     move.homeGoals=oldScore[0];move.awayGoals=oldScore[1];move.engineStatistics=structuredClone(oldStatistics);
     state.queue.unshift(move);
    }else if(!state.queue.length){
     const move=keyframeTransition(state,positions(),M.ballState.position,matchSecond(),M.ballOwner,M.ballSide);if(move)state.queue.push(move);
    }
    state.batchEnd={positions:positions(),ball:[...M.ballState.position],owner:M.ballOwner,side:M.ballSide,gameSecond:matchSecond(),score:[M.hg,M.ag],statistics:{shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()}};
   }
  }
  while(remaining>1e-9&&(state.active||state.queue.length)){
   if(!state.active){
    const next=state.queue[0];
    const sourceTargets=next.enginePositions?structuredClone(next.enginePositions):{};
    if(isCarry(next)||next.type==='shot')sourceTargets[String(next.fromId)]=[...next.fromPos];
    const transition=next.fromPos&&(['pass','cross','shot'].includes(next.type)||isCarry(next)||state.afterShot)?keyframeTransition(state,sourceTargets,next.fromPos,next.gameSecond):null;
    const placement=next.type==='kickoff'?keyframeTransition(state,next.enginePositions,next.fromPos,next.gameSecond,next.fromId,next.fromSide):null;
    if(placement){placement.sampleInterval={fromGameSecond:next.gameSecond,toGameSecond:next.gameSecond,phase:'restart-placement'};placement.carryId=null;placement.carrySide='none';placement.movementSource='derived-dead-ball-placement';}
    if(placement)state.active=placement;
    else if(transition)state.active=transition;
    else {state.active=state.queue.shift();state.afterShot=false;
     if(state.active.shotResult)state.queue=state.queue.filter(x=>x.eventId!==state.active.shotResult.eventId);
     if(state.active.contest){const c=state.active.contest;state.queue=state.queue.filter(x=>x.eventId!==c.press.eventId&&x.eventId!==c.tackle.eventId);}
    }
    state.shotPreStatistics=structuredClone(state.eventStatistics);
    state.progress=0;state.eventStartBall=[...state.ball];state.startPositions=structuredClone(state.positions);
    state.activeDuration=duration(state.active);state.durationEvent=state.active;state.clipStart=presentationSeconds-remaining;state.clipStartTimestamp=now-remaining*tempo/M.speed*1000;state.contactObserved=null;state.arrivalObserved=null;state.rateSegments=[];
   }
   const e=state.active;state.carryMotion=null;state.contestMotion=null;state.shotMotion=null;
   if(Number.isFinite(e.homeGoals)&&Number.isFinite(e.awayGoals))state.eventScore=[e.homeGoals,e.awayGoals];
   if(e.engineStatistics)state.eventStatistics=e.engineStatistics;
   const D=state.activeDuration,take=Math.min(remaining,(1-state.progress)*D);
   state.progress+=take/D;remaining-=take;
   const p=state.progress;state.displayMatchSeconds=e.sampleInterval?e.sampleInterval.fromGameSecond+(e.sampleInterval.toGameSecond-e.sampleInterval.fromGameSecond)*p:(e.gameSecond??matchSecond());
   const pass=['pass','cross'].includes(e.type),u=p<.19?0:p<.76?(p-.19)/.57:1;
   if(pass){
    if(state.rateSegments.at(-1)?.speed!==M.speed||state.rateSegments.at(-1)?.tempo!==tempo)state.rateSegments.push({progress:p,speed:M.speed,tempo});
    if(p>=.19&&state.contactObserved==null)state.contactObserved=now;
    if(p>=.76&&state.arrivalObserved==null)state.arrivalObserved=now;
    state.ball=lerp(e.fromPos,e.toPos,flight(u));state.carrier=p<.19?e.fromId:p<.76?null:e.toId;state.side=p<.19?e.fromSide:p<.76?'none':e.toSide;}
   else if(isCarry(e)){
    // Derived touches on the recorded segment, not new decisions or physical engine data.
    const t=ease(u),d=metres(e.fromPos,e.toPos),travel=d*t,phase=(travel/1.25)%1;
    const lead=.18*Math.sin(Math.PI*phase)**2*Math.sin(Math.PI*t)**2;
    const ballT=d?Math.min(1,t+lead/d):t;
    state.ball=lerp(e.fromPos,e.toPos,ballT);state.carrier=e.fromId;state.side=e.fromSide;
    state.carryMotion={eventId:e.eventId,travelMetres:travel,touchPhase:phase,leadMetres:lead,source:'derived-distance-touches-on-engine-segment'};
   }
   else if(e.type==='enginePositionGap'){state.ball=lerp(e.fromPos,e.toPos,ease(p));state.carrier=e.carryId;state.side=e.carrySide;}
   else{const point=animationPoint(e,p,state.eventStartBall);if(point)state.ball=point;}
   const targets=e.enginePositions;
   if(targets)for(const [key,target] of Object.entries(targets)){
    const start=state.startPositions[key]||target;
    const fraction=isCarry(e)&&key===String(e.fromId)?u:pass&&key===String(e.fromId)?Math.min(1,p/.19):pass&&key===String(e.toId)?Math.min(1,p/.76):p;
    state.positions[key]=lerp(start,target,ease(fraction));
   }
   if(e.type==='shot'&&e.shotResult){
    const f=shotFrame(e,p),result=e.shotResult;
    if(p<.19)state.eventStatistics=state.shotPreStatistics;
    state.ball=f.ball;state.positions[String(e.fromId)]=[...e.fromPos];state.positions[String(e.goalkeeperId)]=f.keeper;
    state.carrier=p<.19?e.fromId:e.outcome==='save'&&result.saveType==='CATCH'&&p>=.76?e.goalkeeperId:null;
    state.side=p<.19?e.fromSide:state.carrier==null?'none':result.toSide;
    state.shotMotion={...f,progress:p,event:p>=.76||f.goalCrossed?result:e,phase:p<.19?'preparation':p<.76?'flight':'result'};
    if(f.goalCrossed)state.eventScore=[result.homeGoals,result.awayGoals];
   }
   if(e.contest){
    const c=e.contest,f=contestFrame(e,p),won=p>=c.contactProgress;
    state.positions[String(c.attackerId)]=f.attacker;state.positions[String(c.defenderId)]=f.defender;state.ball=f.ball;
    state.carrier=won&&!c.attackerKeepsBall?c.defenderId:c.attackerId;state.side=won&&!c.attackerKeepsBall?c.defenderSide:c.attackerSide;
    if(won){state.carryMotion=null;state.eventStatistics=c.tackle.engineStatistics||state.eventStatistics;}
    state.contestMotion={...c,phase:p<.65?'approach':p<.76?'reach':p<.91?'contact-result':'recovery',progress:p,clearanceMetres:f.clearance,event:won?c.tackle:p<.65?e:c.press};
   }
   // A non-ball event can still contain movement of the actual ball carrier.
   // Keep the owned ball on that recorded root rather than leave it behind.
   if(!pass&&e.type!=='enginePositionGap'&&animationPoint(e,p,state.eventStartBall)==null&&state.carrier!=null&&state.positions[String(state.carrier)])state.ball=[...state.positions[String(state.carrier)]];
   state.ballState={...state.ballState,position:[...state.ball],ownerId:state.carrier,state:e.sampleInterval?.phase==='restart-placement'?'RESTART_SETUP':state.carrier==null?'LOOSE_BALL':'LIVE',height:aerialHeight(e,p),travelType:e.travelType||'ground',target:e.toPos||null,travelDuration:D};
   state.lastTime=now;state.presentationSeconds=presentationSeconds;state.presentationDelta=delta;
   if(p>=1-1e-8){
    if(e.type!=='enginePositionGap'&&!state.shotMotion)finishPitchAction(state,e,now);else if(e.type==='enginePositionGap'){state.carrier=e.endOwner;state.side=e.endSide;state.ballState.ownerId=state.carrier;}
    if(pass){const metres=Math.hypot((e.toPos[0]-e.fromPos[0])*1.05,(e.toPos[1]-e.fromPos[1])*.68);logs.push({eventId:e.eventId,gameSecond:e.gameSecond,metres,duration:D,flight:D*.57,tempo,speed:M.speed,screenDurationAtConstantSpeed:D*tempo/M.speed,screenFlightAtConstantSpeed:D*.57*tempo/M.speed,actualWallEnd:(now-wallOrigin)/1000,actualScreenDuration:(now-state.clipStartTimestamp)/1000,presentationEnd:presentationSeconds,observedFlightScreenDuration:(state.arrivalObserved-state.contactObserved)/1000,rateSegments:structuredClone(state.rateSegments),success:e.success,toId:e.toId,queue:state.queue.length,clock:'existing liveFrameStep → shared presentation seconds; atomic-minute backpressure'});}
    if(state.shotMotion)state.afterShot=true;
    state.active=null;state.progress=0;state.contestMotion=null;state.carryMotion=null;state.shotMotion=null;
   }
  }
  if(window.MatchView)window.MatchView.publish(state);
 }
 window.ManagerStoryLive3D={beginMotionSample,endMotionSample,linkDribbleContest,contestFrame,get inPositionUpdate(){return inPositionUpdate},get enabled(){return enabled},get tempo(){return tempo},get time(){return presentationSeconds},get logs(){return structuredClone(logs)},
  enable(){enabled=true;if(M){const s=currentPitchState();for(const id of [...M.active,...M.oppIds])s.positions[String(id)]??=eventPoint(id,typeof id==='string'?'opp':'user');s.eventScore??=[M.hg,M.ag];s.eventStatistics??={shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()};}},
  disable(){enabled=false;},setTempo(n){if(![1,4].includes(Number(n)))throw Error('Invalid tempo');tempo=Number(n)},step,
  duration, togglePause(){if(!M)return;if(M.pause)resumeLive();else pauseLive()},setSpeed(n){setMatchSpeed(n)}
 };
})();
