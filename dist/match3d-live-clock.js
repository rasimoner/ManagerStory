/* Opt-in presentation scheduler on the EXISTING liveFrameStep. No RNG or second engine. */
(() => {
 let enabled=false,tempo=4,presentationSeconds=0,wallSeconds=0,logs=[],observedMatch=null,wallOrigin=0;
 const lerp=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),ease=u=>u*u*(3-2*u);
 const duration=e=>eventAnimationTime(e);
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
   const idle=Math.min(delta,(60-matchSecond()%60)/90);
   advanceLive(idle/M.speed);remaining-=idle;
   if(!state.queue.length){state.ball=[...(M.ballState.position)];state.carrier=M.ballOwner;state.side=M.ballSide;}
  }
  while(remaining>1e-9&&(state.active||state.queue.length)){
   if(!state.active){
    const next=state.queue[0];
    const gap=next.fromPos&&['pass','cross'].includes(next.type)?Math.hypot((next.fromPos[0]-state.ball[0])*1.05,(next.fromPos[1]-state.ball[1])*.68):0;
    if(gap>.2){state.active={type:'enginePositionGap',fromPos:[...state.ball],toPos:[...next.fromPos],presentationDuration:Math.max(.15,gap/12),gameSecond:next.gameSecond,gapMetres:gap};}
    else state.active=state.queue.shift();
    state.progress=0;state.eventStartBall=[...state.ball];state.startPositions=structuredClone(state.positions);
    state.activeDuration=duration(state.active);state.durationEvent=state.active;state.clipStart=presentationSeconds-remaining;state.clipStartTimestamp=now-remaining*tempo/M.speed*1000;state.contactObserved=null;state.arrivalObserved=null;state.rateSegments=[];
   }
   const e=state.active;
   if(Number.isFinite(e.homeGoals)&&Number.isFinite(e.awayGoals))state.eventScore=[e.homeGoals,e.awayGoals];
   if(e.engineStatistics)state.eventStatistics=e.engineStatistics;
   const D=state.activeDuration,take=Math.min(remaining,(1-state.progress)*D);
   state.progress+=take/D;remaining-=take;
   const p=state.progress,pass=['pass','cross'].includes(e.type),u=p<.19?0:p<.76?(p-.19)/.57:1;
   if(pass){
    if(state.rateSegments.at(-1)?.speed!==M.speed||state.rateSegments.at(-1)?.tempo!==tempo)state.rateSegments.push({progress:p,speed:M.speed,tempo});
    if(p>=.19&&state.contactObserved==null)state.contactObserved=now;
    if(p>=.76&&state.arrivalObserved==null)state.arrivalObserved=now;
    state.ball=lerp(e.fromPos,e.toPos,flight(u));state.carrier=p<.19?e.fromId:p<.76?null:e.toId;state.side=p<.19?e.fromSide:p<.76?'none':e.toSide;}
   else if(e.type==='enginePositionGap'){state.ball=lerp(e.fromPos,e.toPos,ease(p));state.carrier=null;state.side='none';}
   else{const point=animationPoint(e,p,state.eventStartBall);if(point)state.ball=point;}
   const targets=e.enginePositions;
   if(targets)for(const [key,target] of Object.entries(targets)){
    const start=state.startPositions[key]||target;
    const fraction=pass&&key===String(e.fromId)?Math.min(1,p/.19):pass&&key===String(e.toId)?Math.min(1,p/.76):p;
    state.positions[key]=lerp(start,target,ease(fraction));
   }
   state.ballState={...state.ballState,position:[...state.ball],ownerId:state.carrier,state:state.carrier==null?'LOOSE_BALL':'LIVE',height:aerialHeight(e,p),travelType:e.travelType||'ground',target:e.toPos||null,travelDuration:D};
   state.lastTime=now;state.presentationSeconds=presentationSeconds;state.presentationDelta=delta;
   if(p>=1-1e-8){
    if(e.type!=='enginePositionGap')finishPitchAction(state,e,now);
    if(pass){const metres=Math.hypot((e.toPos[0]-e.fromPos[0])*1.05,(e.toPos[1]-e.fromPos[1])*.68);logs.push({eventId:e.eventId,gameSecond:e.gameSecond,metres,duration:D,flight:D*.57,tempo,speed:M.speed,screenDurationAtConstantSpeed:D*tempo/M.speed,screenFlightAtConstantSpeed:D*.57*tempo/M.speed,actualWallEnd:(now-wallOrigin)/1000,actualScreenDuration:(now-state.clipStartTimestamp)/1000,presentationEnd:presentationSeconds,observedFlightScreenDuration:(state.arrivalObserved-state.contactObserved)/1000,rateSegments:structuredClone(state.rateSegments),success:e.success,toId:e.toId,queue:state.queue.length,clock:'existing liveFrameStep → shared presentation seconds; atomic-minute backpressure'});}
    state.active=null;state.progress=0;
   }
  }
  if(window.MatchView)window.MatchView.publish(state);
 }
 window.ManagerStoryLive3D={get enabled(){return enabled},get tempo(){return tempo},get time(){return presentationSeconds},get logs(){return structuredClone(logs)},
  enable(){enabled=true;if(M){const s=currentPitchState();for(const id of [...M.active,...M.oppIds])s.positions[String(id)]??=eventPoint(id,typeof id==='string'?'opp':'user');s.eventScore??=[M.hg,M.ag];s.eventStatistics??={shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()};}},
  disable(){enabled=false;},setTempo(n){if(![1,4].includes(Number(n)))throw Error('Invalid tempo');tempo=Number(n)},step,
  duration, togglePause(){if(!M)return;if(M.pause)resumeLive();else pauseLive()},setSpeed(n){setMatchSpeed(n)}
 };
})();
