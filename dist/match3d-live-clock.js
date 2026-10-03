/* Opt-in presentation scheduler on the EXISTING liveFrameStep. No RNG or second engine. */
(() => {
 let enabled=false,tempo=4,presentationSeconds=0,wallSeconds=0,logs=[],observedMatch=null,wallOrigin=0,inPositionUpdate=false,motionSample=null;
 const lerp=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),ease=u=>u*u*(3-2*u);
 const duration=e=>eventAnimationTime(e);
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
    const transition=next.fromPos&&['pass','cross'].includes(next.type)?keyframeTransition(state,next.enginePositions,next.fromPos,next.gameSecond):null;
    const placement=next.type==='kickoff'?keyframeTransition(state,next.enginePositions,next.fromPos,next.gameSecond,next.fromId,next.fromSide):null;
    if(placement){placement.sampleInterval={fromGameSecond:next.gameSecond,toGameSecond:next.gameSecond,phase:'restart-placement'};placement.carryId=null;placement.carrySide='none';placement.movementSource='derived-dead-ball-placement';}
    if(placement)state.active=placement;
    else if(transition)state.active=transition;
    else state.active=state.queue.shift();
    state.progress=0;state.eventStartBall=[...state.ball];state.startPositions=structuredClone(state.positions);
    state.activeDuration=duration(state.active);state.durationEvent=state.active;state.clipStart=presentationSeconds-remaining;state.clipStartTimestamp=now-remaining*tempo/M.speed*1000;state.contactObserved=null;state.arrivalObserved=null;state.rateSegments=[];
   }
   const e=state.active;
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
   else if(e.type==='enginePositionGap'){state.ball=lerp(e.fromPos,e.toPos,ease(p));state.carrier=e.carryId;state.side=e.carrySide;}
   else{const point=animationPoint(e,p,state.eventStartBall);if(point)state.ball=point;}
   const targets=e.enginePositions;
   if(targets)for(const [key,target] of Object.entries(targets)){
    const start=state.startPositions[key]||target;
    const fraction=pass&&key===String(e.fromId)?Math.min(1,p/.19):pass&&key===String(e.toId)?Math.min(1,p/.76):p;
    state.positions[key]=lerp(start,target,ease(fraction));
   }
   // A non-ball event can still contain movement of the actual ball carrier.
   // Keep the owned ball on that recorded root rather than leave it behind.
   if(!pass&&e.type!=='enginePositionGap'&&animationPoint(e,p,state.eventStartBall)==null&&state.carrier!=null&&state.positions[String(state.carrier)])state.ball=[...state.positions[String(state.carrier)]];
   state.ballState={...state.ballState,position:[...state.ball],ownerId:state.carrier,state:e.sampleInterval?.phase==='restart-placement'?'RESTART_SETUP':state.carrier==null?'LOOSE_BALL':'LIVE',height:aerialHeight(e,p),travelType:e.travelType||'ground',target:e.toPos||null,travelDuration:D};
   state.lastTime=now;state.presentationSeconds=presentationSeconds;state.presentationDelta=delta;
   if(p>=1-1e-8){
    if(e.type!=='enginePositionGap')finishPitchAction(state,e,now);else {state.carrier=e.endOwner;state.side=e.endSide;state.ballState.ownerId=state.carrier;}
    if(pass){const metres=Math.hypot((e.toPos[0]-e.fromPos[0])*1.05,(e.toPos[1]-e.fromPos[1])*.68);logs.push({eventId:e.eventId,gameSecond:e.gameSecond,metres,duration:D,flight:D*.57,tempo,speed:M.speed,screenDurationAtConstantSpeed:D*tempo/M.speed,screenFlightAtConstantSpeed:D*.57*tempo/M.speed,actualWallEnd:(now-wallOrigin)/1000,actualScreenDuration:(now-state.clipStartTimestamp)/1000,presentationEnd:presentationSeconds,observedFlightScreenDuration:(state.arrivalObserved-state.contactObserved)/1000,rateSegments:structuredClone(state.rateSegments),success:e.success,toId:e.toId,queue:state.queue.length,clock:'existing liveFrameStep → shared presentation seconds; atomic-minute backpressure'});}
    state.active=null;state.progress=0;
   }
  }
  if(window.MatchView)window.MatchView.publish(state);
 }
 window.ManagerStoryLive3D={beginMotionSample,endMotionSample,get inPositionUpdate(){return inPositionUpdate},get enabled(){return enabled},get tempo(){return tempo},get time(){return presentationSeconds},get logs(){return structuredClone(logs)},
  enable(){enabled=true;if(M){const s=currentPitchState();for(const id of [...M.active,...M.oppIds])s.positions[String(id)]??=eventPoint(id,typeof id==='string'?'opp':'user');s.eventScore??=[M.hg,M.ag];s.eventStatistics??={shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()};}},
  disable(){enabled=false;},setTempo(n){if(![1,4].includes(Number(n)))throw Error('Invalid tempo');tempo=Number(n)},step,
  duration, togglePause(){if(!M)return;if(M.pause)resumeLive();else pauseLive()},setSpeed(n){setMatchSpeed(n)}
 };
})();
