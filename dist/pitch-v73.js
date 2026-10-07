/* Presentation reads MatchEvents. It never advances the seeded simulation. */
let pitchV73 = null;
const PITCH_ACTIONS = new Set(['kickoff','pass','cross','interception','press','tackle','dribble','ballCarry','offBallRun','counterAttack','run','shot','save','block','post','wide','goal','throwIn','restart','goalKick','corner','freeKick','penalty','hold','ballOut','restartPosition','restartPlayers','restartWait','firstTouch','looseBall','recovery']);
const IMPORTANT_ACTIONS = new Set(['kickoff','shot','save','block','post','wide','goal','throwIn','goalKick','corner','offBallRun','dribble','ballCarry','tackle']);
const limitPitch = (n,min,max) => Math.max(min,Math.min(max,n));
const userDirection = () => M && M.secondHalf ? -1 : 1;
function basePitchPosition(id,side) {
  if (id == null || side==='none') return [50,50];
  const old=side==='user'?(M.matchPositions?.[id]||S.positions?.[id]||[50,50]):oppRadarPos(Math.max(0,Number(String(id).slice(1))||0));
  const x=100-old[1];
  return [limitPitch(M.secondHalf?100-x:x,3,97),limitPitch(old[0],5,95)];
}
function eventPoint(id,side) {
  if (id==null || side==='none') return [50,50];
  if (M.dynamicPositions && M.dynamicPositions[String(id)]) return [...M.dynamicPositions[String(id)]];
  return basePitchPosition(id,side);
}
const pitchDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function nearestMarker(side,point,exclude=null){
 const pool=side==='user'?M.active:M.oppIds;
 return pool.filter(id=>id!==exclude).map(id=>({id,d:pitchDistance(eventPoint(id,side),point)}))
   .sort((a,b)=>a.d-b.d)[0]||null;
}
function pitchSpace(point,side){
 const opponents=side==='user'?M.oppIds:M.active,allies=side==='user'?M.active:M.oppIds;
 const danger=opponents.reduce((n,id)=>n+Math.max(0,16-pitchDistance(eventPoint(id,side==='user'?'opp':'user'),point))/16,0);
 const support=allies.reduce((n,id)=>n+Math.max(0,17-pitchDistance(eventPoint(id,side),point))/17,0);
 return {danger,support};
}
function opponentAttitude(){
 const goals=M.userHome?M.ag-M.hg:M.hg-M.ag;
 return {press:goals<0&&M.min>=55?1.2:goals>0&&M.min>=72?.76:1,
  risk:goals<0&&M.min>=70?1.2:goals>0&&M.min>=70?.76:1};
}
function pitchInstructionTarget(id,side,ball,attacking) {
  const q=basePitchPosition(id,side),own=side==='user',dir=(own?1:-1)*userDirection();
  const role=own?M.matchRoles[id]:opponentPlayer(id)?.position||null;
  const p=playerAtMarker(id,side);
  const order=orderFor(id,side);
  let x=q[0],y=q[1];
  if (role==='GK' || (!own&&String(id)==='o0')) {
    const ownGoal=dir>0?5:95,threat=attacking!==side&&Math.abs(ball[0]-ownGoal)<29;
    const advanced=attacking===side ? (order==='sweeper'?7:3) : threat?5:0;
    x=limitPitch(q[0]+dir*advanced,4,96);
    return [x,limitPitch(50+(ball[1]-50)*.07,38,62)];
  }
  // The team block and individual offsets share one target; movement remains interpolated.
  {
    const T=tacticProfile(side);
    const mentality=T.mentality>0?8:T.mentality<0?-7:0;
    const defending=attacking!==side,backLine=['CB','LB','RB'].includes(role);
    // defensive line: back four step up/drop; the rest of the block follows a little (vertical compression)
    const block=backLine?T.line*8:mentality*(role==='ST'?1.1:.85)+T.line*2.5;
    x+=dir*(block+(defending&&T.press>0?5:defending&&T.press<0?-3:0)+(defending&&T.approach==='Kontra'?-3:0));
    if(T.compact){y+=(50-y)*(defending?.2:.12);if(defending)x+=dir*(backLine?2.5:role==='ST'?-2.5:0);}
    if(T.approach==='Kanatlar'&&attacking===side&&['LW','RW','LB','RB'].includes(role))y+=(y<50?-1:1)*4;
    if(T.approach==='Merkez'&&attacking===side)y+=(50-y)*.11;
    if(T.width>0)y+=(y<50?-1:1)*5;
    if(T.width<0)y+=(50-y)*.22;
  }
  if (attacking===side) x+=dir*(role==='CB'?3:role==='LB'||role==='RB'?5:7);
  else x-=dir*(role==='ST'?3:5);
  if (order==='stay') x-=dir*12;
  if (order==='step') x+=dir*10;
  if (order==='overlap'&&attacking===side) x+=dir*17;
  if (order==='runBehind'&&attacking===side) x+=dir*9;
  if (order==='creator'||order==='free') { x+=dir*4;y+=(50-y)*.3; }
  if (order==='inside') y+=(50-y)*.55;
  if (order==='wide') y+=(y<50?-1:1)*9;
  if(order==='press'&&attacking!==side){x+=(ball[0]-x)*.19;y+=(ball[1]-y)*.19;}
  if(attacking!==side&&tacticProfile(side).press>0&&role!=='GK'){   // the pressing team's own profile, either side
    const distance=Math.hypot(ball[0]-x,ball[1]-y);
    if(distance<34){x+=(ball[0]-x)*.25;y+=(ball[1]-y)*.25;}
  }
  const ballProximity=Math.max(0,1-Math.abs(q[1]-ball[1])/65);
  y+=(ball[1]-50)*(attacking===side?.08:.13)*ballProximity;
  x+=(ball[0]-50)*(attacking===side?.035:.03)*ballProximity;
  return [limitPitch(x,6,94),limitPitch(y,8,92)];
}
function eventAnimationTime(e) {
  if(e.presentationDuration)return e.presentationDuration;
  const a=e.fromPos||[50,50],b=e.toPos||a,dist=Math.hypot(a[0]-b[0],a[1]-b[1]);
  const viewing=typeof window!=='undefined'&&window.ManagerStoryLive3D?.enabled?1:M?.speed===.5?1.18:M?.speed===2?.85:1;
  if(e.type==='pass'||e.type==='cross') {
    const passing=playerAttribute(e.fromId,e.fromSide,'passing',69);
    const aerial=e.type==='cross'||e.travelType==='aerial'||e.passKind==='long'||dist>34;
    const base=aerial?.58+Math.sqrt(dist)*.028:.23+Math.sqrt(dist)*.038-(passing-70)*.001;
    return limitPitch(base*viewing,aerial?.55:.25,aerial?.9:.65);
  }
  if(e.type==='dribble'||e.type==='ballCarry') {
    const pace=playerAttribute(e.fromId,e.fromSide,'pace',70);
    return limitPitch((.42+dist*.012-(pace-70)*.002)*viewing,.38,.82);
  }
  if(e.type==='shot')return limitPitch(.36*viewing,.28,.5);
  if(e.type==='goal')return .28;
  if(['throwIn','goalKick','corner','freeKick'].includes(e.type))return limitPitch((.42+Math.sqrt(dist)*.038)*viewing,.45,.9);
  if(e.type==='restartPosition')return .44;
  if(e.type==='restartPlayers'||e.type==='restartWait'||e.type==='ballOut')return .38;
  if(e.type==='firstTouch')return limitPitch(.58-(playerAttribute(e.toId,e.toSide,'technique',67)-60)*.004,.31,.66);
  if(e.type==='looseBall'||e.type==='recovery')return .56;
  if(e.type==='offBallRun'||e.type==='counterAttack')return .7;
  if(e.type==='kickoff')return .8;
  return .44;
}
function currentPitchState() {
  if(!M)return null;
  if(!pitchV73||pitchV73.match!==M) {
    pitchV73={match:M,queue:[],active:null,progress:0,lastTime:null,positions:{},
      ball:[...(M.ballState?.position||eventPoint(M.ballOwner,M.ballSide))],carrier:M.ballOwner,side:M.ballSide,
      ballState:{position:[...(M.ballState?.position||eventPoint(M.ballOwner,M.ballSide))],ownerId:M.ballOwner,
        state:'LIVE',target:null,travelType:'ground',travelDuration:0,height:0},
      goalUntil:0,goalText:'',label:'',shotOutcome:''};
  }
  return pitchV73;
}
function enqueuePitchEvent(e) {
  if(!M||!PITCH_ACTIONS.has(e.type))return;
  const state=currentPitchState();
  if(e.type==='goal'&&!(typeof window!=='undefined'&&window.ManagerStoryLive3D?.enabled)){
    // Score/overlay are immediate, but an in-flight shot completes visually.
    state.queue.length=0;
    const scoringTeam=e.side===0?M.home:M.away;
    const goalIdentity=resolveClubIdentity('goal',{teamId:scoringTeam});
    state.goalTeam=goalIdentity.id;state.goalColors=[goalIdentity.primaryColor,goalIdentity.secondaryColor];
    state.goalVariant=Math.abs(Math.floor(Number(e.gameSecond)||Number(e.minute)*60||0))%4;
    state.goalText=goalIdentity.name+' • '+(e.scorer||'Gol')+' • '+e.minute+'’';
    state.goalUntil=(typeof performance!=='undefined'?performance.now():0)+1700;
  }
  if(state.queue.length>=36&&!(typeof window!=='undefined'&&window.ManagerStoryLive3D?.enabled)) {
    const old=state.queue.findIndex(x=>!IMPORTANT_ACTIONS.has(x.type));
    if(old>=0)state.queue.splice(old,1);
    else if(!IMPORTANT_ACTIONS.has(e.type))return;
  }
  if(typeof window!=='undefined'&&window.ManagerStoryLive3D?.enabled){
    // Transient read-only engine keyframes; never stored back in M.events or career saves.
    const enginePositions=Object.fromEntries([...M.active,...M.oppIds].map(id=>[String(id),eventPoint(id,typeof id==='string'?'opp':'user')]));
    const copy=structuredClone(e);copy.rawEnginePositions=structuredClone(enginePositions);copy.engineToPos=e.toPos?[...e.toPos]:null;copy.engineFromPos=e.fromPos?[...e.fromPos]:null;
    // The old kickoff declares a 3-percent tap that the engine never commits.
    // Retain the raw declaration for diagnostics; present the actual restart spot.
    if(e.type==='kickoff'){
      copy.declaredTarget=[...e.toPos];copy.toPos=[...(enginePositions[String(e.toId)]||e.fromPos)];copy.targetSource='actual-engine-restart-position';
      const ids=e.fromSide==='user'?M.active:M.oppIds,receiver=ids.filter(id=>id!==e.fromId&&!isKeeper(e.fromSide,id)).sort((a,b)=>pitchDistance(enginePositions[a],e.fromPos)-pitchDistance(enginePositions[b],e.fromPos))[0];
      if(receiver!=null){const point=[...enginePositions[receiver]];
       copy.kickoffExchange={receiverId:receiver,point,source:'derived-short-exchange-and-return; engine-has-no-receiver; no-new-pass-event-or-statistic'};enginePositions[String(receiver)]=point;}
    }
    // Raw restart coordinates are inset 2%; the visible ball is on the 1m arc.
    if(e.restartType==='CORNER'&&['restartPosition','restartPlayers','restartWait','corner'].includes(e.type)){
      copy.engineAnimationDuration=eventAnimationTime(e);
      const raw=e.type==='restartPosition'?e.toPos:e.fromPos,dx=(raw[0]>50?-1:1)*Math.SQRT1_2/1.05,dy=(raw[1]>50?-1:1)*Math.SQRT1_2/.68,origin=[(raw[0]>50?100:0)+dx,(raw[1]>50?100:0)+dy];
      copy.engineRestartPoint=[...raw];copy.restartDisplayPoint=origin;copy.restartMapping='derived-1m-corner-arc; immutable-engine-endpoints-and-outcome';
      if(e.type==='restartPosition')copy.toPos=origin;else{copy.fromPos=origin;if(['restartPlayers','restartWait'].includes(e.type))copy.toPos=origin;}
      if(e.fromId!=null)enginePositions[String(e.fromId)]=origin;
    }
    // Link immutable presentation copies only; engine events/save schema stay unchanged.
    if(['goal','save','wide','block','post'].includes(copy.type)){
      const shot=[...state.queue].reverse().find(x=>x.type==='shot'&&!x.shotResult&&x.fromId===copy.fromId&&x.gameSecond===copy.gameSecond&&x.outcome===copy.type);
      if(shot)shot.shotResult=structuredClone({...copy,enginePositions});
    }
    if(copy.type==='shot'&&copy.header){copy.text='Kafa vuruşu · gerçek korner topu';
      const incoming=[...state.queue].reverse().find(x=>x.type==='corner'&&x.toId===copy.fromId&&x.gameSecond===copy.gameSecond);
      if(incoming){copy.headerIncoming={fromId:incoming.fromId,eventId:incoming.eventId,fromPos:[...incoming.fromPos],toPos:[...incoming.toPos]};enginePositions[String(incoming.fromId)]=[...incoming.fromPos];incoming.headerShot=structuredClone(copy);incoming.enginePositions[String(copy.fromId)]=[...copy.fromPos];}
    }
    state.queue.push({...copy,enginePositions,sampleTime:{gameSecond:e.gameSecond,stage:window.ManagerStoryLive3D.inPositionUpdate?'during-position-update':'event-after-position-update',sequence:e.eventId},engineStatistics:{shots:[...M.shots],xg:[...M.stats.xg],possession:matchPossession()}});
  }else state.queue.push(e);
}
function pitchEventPhase(progress) {
  return progress<.19?'PREPARATION':progress<.76?'ACTION':progress<.91?'RESULT':'SETTLE';
}
function animationPoint(e,progress,previous) {
  const from=e.fromPos||eventPoint(e.fromId,e.fromSide),to=e.toPos||from;
  const phase=pitchEventPhase(progress),fraction=progress<.19?0:progress<.76?(progress-.19)/.57:1;
  if(['offBallRun','press','tackle','counterAttack','hold','restartPlayers','restartWait'].includes(e.type))return null;
  if(e.type==='presentationSync'){
    const eased=progress<.5?2*progress*progress:1-Math.pow(-2*progress+2,2)/2;
    return [from[0]+(to[0]-from[0])*eased,from[1]+(to[1]-from[1])*eased];
  }
  if(phase==='PREPARATION'&&previous)return [previous[0]+(from[0]-previous[0])*progress/.19,previous[1]+(from[1]-previous[1])*progress/.19];
  if(e.type==='goal'&&progress>=.76)return to;
  return [from[0]+(to[0]-from[0])*fraction,from[1]+(to[1]-from[1])*fraction];
}
function finishPitchAction(state,e,now) {
  // Score and goal feedback were committed by the GOAL event, not by this renderer.
  if(e.type==='kickoff') {state.ball=[50,50];state.carrier=e.toId;state.side=e.toSide;}
  else if(['restart','firstTouch','recovery','goalKick','corner','throwIn','freeKick'].includes(e.type)) {state.carrier=e.toId;state.side=e.toSide;}
  else if(e.type==='pass'||e.type==='cross'||e.type==='tackle'||e.type==='interception') {
    state.carrier=e.toId;state.side=e.toSide||e.ballSide;
  } else if(['shot','wide','post','block','goal','ballOut','restartPosition','looseBall'].includes(e.type)) {
    state.carrier=null;
  }
  state.ballState.ownerId=state.carrier;state.ballState.state=state.carrier==null?'LOOSE_BALL':'LIVE';
  state.label=e.type==='corner'?'KORNER':e.type==='throwIn'?'TAÇ':e.type==='goalKick'?'KALE VURUŞU':e.type==='shot'?'ŞUT':e.type==='save'?'KURTARIŞ':e.type==='block'?(presentationEvent(e).presentationLabel||'BLOK'):e.type==='post'?'DİREK':e.type==='goal'?'GOL':'';
}
function advancePitchPresentation(dt,now) {
  const state=currentPitchState();if(!state||M.pause||M.finished||M.lifecycle==='FINISHED'||M.reason==='half')return state;
  let remaining=limitPitch(dt,0,.12);
  while(remaining>0&&!M.finished) {
    if(!state.active) {state.active=state.queue.shift()||null;state.progress=0;state.eventStartBall=[...state.ball];if(!state.active)break;}
    const duration=eventAnimationTime(state.active);
    const advance=Math.min(remaining,(1-state.progress)*duration);
    state.progress+=advance/duration;remaining-=advance;
    const point=animationPoint(state.active,state.progress,state.eventStartBall);
    if(point){state.ball=point;state.ballState.position=point;}
    state.ballState.travelType=state.active.travelType||state.active.passKind||'ground';
    state.ballState.target=state.active.toPos||null;
    state.ballState.travelDuration=duration;
    state.ballState.height=aerialHeight(state.active,state.progress);
    if(state.progress>=.999999) {
      finishPitchAction(state,state.active,now);
      state.active=null;state.progress=0;
    }
  }
  return state;
}
function playerMoveRate(id,side) {
  const pace=playerAttribute(id,side,'pace',68),acc=playerAttribute(id,side,'acceleration',pace);
  const pressure=side==='user'&&M?.press==='Yüksek'&&M.ballSide==='opp'?1.16:1;
  return limitPitch((6+(pace-60)*.3+(acc-60)*.08)*pressure,3,27); // fitness/age/position already in the effective attributes
}
function moveTowards(current,target,max) {
  const dx=target[0]-current[0],dy=target[1]-current[1],dist=Math.hypot(dx,dy);
  if(dist<=max||dist<.01)return [...target];
  return [current[0]+dx/dist*max,current[1]+dy/dist*max];
}
function pitchFrameState(dt,now) {
  const state=advancePitchPresentation(dt,now),e=state?.active;if(!state)return null;
  if(M.pause||M.finished)return state;
  const phase=e?pitchEventPhase(state.progress):'SETTLE';
  const attacking=e?.fromSide||M.ballSide;
  for(const id of [...M.active,...M.oppIds]) {
    const side=typeof id==='string'?'opp':'user',key=String(id),origin=basePitchPosition(id,side);
    const here=state.positions[key]||origin;
    let target=M.dynamicPositions?.[key]||pitchInstructionTarget(id,side,state.ball,attacking);
    if(e) {
      if(e.type==='goalKick'&&key===String(e.fromId))target=e.fromPos||target;
      if(e.type==='restartPosition'&&key===String(e.toId))target=e.toPos||target;
      if(e.type==='restartPlayers'&&e.restartType==='CORNER'){
        const index=side==='user'?M.active.indexOf(id):M.oppIds.indexOf(id);
        if(index>0&&index<11){
          const attacking=side===e.fromSide,dir=(attacking?1:-1)*userDirection();
          const goalX=attacking?(dir>0?82:18):(dir>0?18:82);
          target=[goalX+(index%3)*3,34+(index%5)*8];
        }
      }
      if(e.type==='offBallRun'&&key===String(e.playerId))target=e.toPos||target;
      if(['dribble','ballCarry','counterAttack','run'].includes(e.type)&&key===String(e.fromId))
        target=e.toPos||target;
      if(e.type==='press'||e.type==='tackle') {
        if(key===String(e.defenderId))target=e.toPos||target;
        if(key===String(e.fromId)&&e.type==='tackle')target=e.fromPos||target;
      }
      if(e.type==='shot'&&key===String(e.goalkeeperId)&&phase!=='PREPARATION')
        target=[origin[0]+(state.ball[0]-origin[0])*.19,limitPitch(state.ball[1],34,66)];
      if(['pass','cross','goalKick','corner','throwIn'].includes(e.type)&&key===String(e.toId)&&phase==='ACTION')
        target=e.toPos||target;
    }
    const next=moveTowards(here,target,playerMoveRate(id,side)*Math.max(0,dt));
    state.positions[key]=next;
  }
  softenPlayerOverlap(state.positions);
  if(e&&['dribble','ballCarry'].includes(e.type)) {
    const path=animationPoint(e,state.progress,state.eventStartBall);
    if(path){const direction=(e.toPos?.[0]??path[0])-(e.fromPos?.[0]??path[0]);
      const ahead=Math.sign(direction||1)*(.55+.16*Math.sin(state.progress*17));
      state.ball=[path[0]+ahead,path[1]+.22*Math.sin(state.progress*21)];state.ballState.position=state.ball;
      const key=String(e.fromId),carrier=state.positions[key];
      if(carrier)state.positions[key]=moveTowards(carrier,[path[0]-ahead*.35,path[1]],playerMoveRate(e.fromId,e.fromSide)*Math.max(0,dt));}
  }
  return state;
}
function queuePresentationCatchup(state,target,gameSecond){
  if(!target)return;
  const distance=Math.hypot(target[0]-state.ball[0],target[1]-state.ball[1]);
  if(distance<.7)return;
  state.active={type:'presentationSync',eventId:'sync-'+gameSecond,gameSecond,
    fromPos:[...state.ball],toPos:[...target],presentationDuration:limitPitch(.16+distance*.004,.18,.34)};
  state.progress=0;state.eventStartBall=[...state.ball];
}
function synchronizePitchPresentation(state){
  if(!M||M.pause||M.finished)return;
  // At 1× one game minute is only 667 ms. Drop events that can no longer be
  // depicted at the authoritative clock instead of playing historical football.
  // At 0.5× allow up to two real seconds so a readable long ball can finish.
  // Faster modes drop crowded intermediate visuals to keep the pitch current.
  const earliest=matchSecond()-(M.speed===.5?90:45);
  const expired=state.active&&state.active.gameSecond<earliest;
  state.queue=state.queue.filter(e=>e.gameSecond>=earliest);
  if(expired){state.active=null;state.progress=0;queuePresentationCatchup(state,M.ballState?.position,Math.floor(matchSecond()));}
  if(!state.active&&!state.queue.length){
    queuePresentationCatchup(state,M.ballState?.position,Math.floor(matchSecond()));
    state.carrier=M.ballState?.ownerId??M.ballOwner??null;
    state.side=M.ballSide;
    state.ballState.ownerId=state.carrier;
    state.ballState.height=0;
  }
}
function paintLivePitch() {
  if(!M||typeof document==='undefined')return;
  const clock=document.querySelector('#live-clock');if(clock)clock.textContent=matchClock();
  const now=typeof performance!=='undefined'?performance.now():0;
  const state=currentPitchState();
  const dt=state.lastTime==null?0:limitPitch((now-state.lastTime)/1000,0,.1);
  state.lastTime=now;
  const dev=window.ManagerStoryLive3D?.enabled;
  if(!dev)synchronizePitchPresentation(state);
  const frame=dev?state:pitchFrameState(dt*MATCH_PLAYBACK_SCALE,now);
  if(typeof window!=='undefined'&&window.MatchView)window.MatchView.publish(frame);
  const score=document.querySelector('#live-score');
  if(score)score.textContent=(dev&&frame.eventScore||[M.hg,M.ag]).join('–');
  if(dev){
    if(clock)clock.textContent=clockFromSeconds(frame.displayMatchSeconds??matchSecond());
    const commentary=document.querySelector('[data-live-commentary]');
    if(commentary){commentary.replaceChildren(...liveCommentaryLines().map(text=>{const line=document.createElement('div');line.className='comment';line.textContent=text;return line;}));}
  }
  const pitch=document.querySelector('.livepitch');if(!pitch||!frame)return;
  const reset=frame.active?.goalReset||frame.active?.restartReset,t=frame.progress*(frame.activeDuration||0),smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
  pitch.style.opacity=reset?(t<.15?1-smooth(t/.15):smooth((t-.15)/.15)):1;
  const rect=pitch.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
  for(const node of pitch.querySelectorAll('[data-player]')) {
    const xy=frame.positions[node.dataset.player];
    if(!xy)continue;
    node.style.transform='translate3d('+(xy[0]/100*w-12)+'px,'+(xy[1]/100*h-12)+'px,0)';
    const e=frame.active,id=node.dataset.player;
    const visualCarrier=frame.active&&pitchEventPhase(frame.progress)==='ACTION'&&['pass','cross','shot'].includes(e.type)?e.fromId:frame.carrier;
    node.classList.toggle('carrier',id===String(visualCarrier)&&node.dataset.side===frame.side);
    const moving=!!e&&[e.fromId,e.toId,e.defenderId,e.playerId].some(x=>x!=null&&String(x)===id);
    node.classList.toggle('moving',moving);
    node.style.setProperty('--move-dir',e?.toPos&&e?.fromPos&&e.toPos[0]<e.fromPos[0]?'-1':'1');
  }
  const ball=pitch.querySelector('.liveball');
  const height=frame.ballState.height,shadow=pitch.querySelector('.ball-shadow');
  if(shadow){shadow.style.transform='translate3d('+(frame.ball[0]/100*w-5)+'px,'+(frame.ball[1]/100*h-3)+'px,0) scale('+(1+height*.38)+')';shadow.style.opacity=height?.42:0;}
  if(ball)ball.style.transform='translate3d('+(frame.ball[0]/100*w-6)+'px,'+(frame.ball[1]/100*h-6-height*14)+'px,0) scale('+(1+height*.34)+')';
  const banner=pitch.querySelector('.pitch-action');
  if(banner){banner.textContent=frame.label;banner.hidden=!frame.label||frame.goalUntil>now;}
  const overlay=pitch.querySelector('.pitch-goal-overlay');
  if(overlay){
    overlay.hidden=!(frame.goalUntil>now);
    const colors=frame.goalColors||['#55646b','#d8dedc'];
    overlay.style.setProperty('--goal-primary',colors[0]);overlay.style.setProperty('--goal-secondary',colors[1]);
    const variant=frame.goalVariant||0,identity=frame.goalTeam||'neutral';
    if(overlay.dataset.team!==identity||overlay.dataset.variant!==String(variant)){
      overlay.dataset.team=identity;overlay.dataset.variant=String(variant);
      const photo=overlay.querySelector('img');if(photo)photo.src=fanPhoto(identity);
    }
    const details=overlay.querySelector('small');if(details)details.textContent=frame.goalText;
  }
}
function resetPitchHalf() {
  if(!M)return;
  // Second half: sides swap. Stale first-half coordinates would leave both teams in the wrong half,
  // so authoritative positions fall back to the mirrored formation anchors.
  M.secondHalf=true;M.pitchMotion={};M.dynamicPositions={};M.looseBall=null;M.restart=null;
  M.passMemory=[];M.previousPossessionSide=null;M.pitchRunMinute={};M.regain=null;M.setPieceReturn=null;
  pitchV73=null;
}
function emitPitchKickoff(side) {
  if(!M||engineFrozen()||M.min>=90)return;
  runRestart('KICK_OFF',side,[50,50]);   // same ordered restart machine as every other restart
}
function nearestOpponent(fromSide,point) {
  const candidates=fromSide==='user'?M.oppIds:M.active;
  if(!candidates.length)return null;
  const side=fromSide==='user'?'opp':'user';
  return candidates.slice().sort((a,b)=>{
    const x=eventPoint(a,side),y=eventPoint(b,side);
    return Math.hypot(x[0]-point[0],x[1]-point[1])-Math.hypot(y[0]-point[0],y[1]-point[1]);
  })[0];
}
function recordPitchTackle(defender,defenderSide,carrier,carrierSide,success,point) {
  const origin=eventPoint(defender,defenderSide);
  matchEvent('press',M.min+'’ '+(defenderSide==='user'?S.players.find(p=>p.id===defender)?.name:'Rakip')+' topa baskıya çıktı.',
    {defenderId:defender,fromId:carrier,fromSide:carrierSide,toSide:defenderSide,fromPos:origin,toPos:point,ballSide:carrierSide});
  const p=defenderSide==='user'?S.players.find(x=>x.id===defender):null;
  if(p) {
    const st=M.playerStats[defender];st.tacklesAttempted++;if(success){st.tackles++;st.rating=clamp(st.rating+.08,1,10);}
  }
  if(success)M.stats.tackles[defenderSide==='user'?userSide():1-userSide()]++;
  matchEvent('tackle',M.min+'’ '+(p?.name||'Rakip')+(success?' topu kazandı.':' müdahaleyi kaçırdı.'),
    {side:defenderSide==='user'?userSide():1-userSide(),defenderId:defender,fromId:carrier,toId:success?defender:carrier,
      fromSide:carrierSide,toSide:success?defenderSide:carrierSide,ballSide:success?defenderSide:carrierSide,
      success,fromPos:origin,toPos:point});
}
function switchPitchOwner(id,side) {
  // Ownership can only move to a player who is on THAT side's pitch roster; anything else is repaired, never cross-team.
  const pool=side==='user'?M.active:M.oppIds;
  if(!pool.includes(id)||(typeof id==='number')!==(side==='user'))id=occupant(side,id);
  if(M.looseBall)M.looseBall=null;
  if(side==='user')setUserOwner(id);else setOppOwner(Number(String(id).slice(1)));
}
// The authoritative, transient positions are advanced by the existing match tick.
// Velocity and commitment persist across possession changes and are safe for old saves.
const LEASH={GK:[8,12],CB:[24,15],LB:[44,14],RB:[44,14],CM:[34,24],CAM:[34,26],LW:[36,12],RW:[36,12],ST:[32,22]};
function anchorLeash(role,anchor,target){
 const [rx,ry]=LEASH[role]||LEASH.CM;
 return [limitPitch(anchor[0]+limitPitch(target[0]-anchor[0],-rx,rx),4,96),limitPitch(anchor[1]+limitPitch(target[1]-anchor[1],-ry,ry),6,94)];
}
// Only the nearest few defenders may close the ball down; the block stays a block.
function nearestSet(side,point,count,filter){
 const pool=(side==='user'?M.active:M.oppIds).filter(id=>!isKeeper(side,id)&&(!filter||filter(id)));
 return new Set(pool.map(id=>({id,d:pitchDistance(eventPoint(id,side),point)})).sort((a,b)=>a.d-b.d).slice(0,count).map(x=>String(x.id)));
}
function evolvePitchPositions(){
 if(engineFrozen())return;
 M.dynamicPositions ??={};M.pitchMotion ??={};
 window.ManagerStoryLive3D?.beginMotionSample?.();
 const ball=M.ballState?.position||[50,50],attacking=M.ballSide;
 const previous=M.previousPossessionSide;
 if(previous&&previous!==attacking&&attacking!=='none')M.regain={side:attacking,min:M.min};
 if(previous&&previous!==attacking&&attacking!=='none'){
  const old=previous==='user'?M.active:M.oppIds,prevPress=tacticProfile(previous).press;
  for(const id of old){
   const here=eventPoint(id,previous),motion=M.pitchMotion[String(id)];
   if(motion&&pitchDistance(here,ball)<14&&
       (prevPress>0||orderFor(id,previous)==='press')){
    if(nearestSet(previous,ball,3).has(String(id))){motion.target=[...ball];motion.until=M.min+2;motion.action='counterPress';}
   }
  }
 }
 M.previousPossessionSide=attacking;
 const defendingSide=attacking==='user'?'opp':attacking==='opp'?'user':null;
 const pressers=defendingSide?nearestSet(defendingSide,ball,(()=>{const P=tacticProfile(defendingSide).press;return P>0?3:P<0?1:2;})()):new Set();
 const supporters=attacking==='user'||attacking==='opp'?nearestSet(attacking,ball,2,id=>{
   const r=attacking==='user'?M.matchRoles[id]:opponentPlayer(id)?.position;return r!=='CB'&&r!=='ST'&&id!==M.ballOwner}):new Set();
 for(const id of [...M.active,...M.oppIds]){
  const side=typeof id==='string'?'opp':'user',key=String(id);
  const here=M.dynamicPositions[key]||basePitchPosition(id,side);
  const motion=M.pitchMotion[key]||{vx:0,vy:0,until:0,target:null,action:'shape'};
  const role=side==='user'?M.matchRoles[id]:opponentPlayer(id)?.position;
  const dir=(side==='user'?1:-1)*userDirection();
  const player=playerAtMarker(id,side);
  const order=orderFor(id,side);
  const intelligence=playerAttribute(id,side,attacking===side?'offBall':'positioning',65);
  let target=pitchInstructionTarget(id,side,ball,attacking);
  let initiatedRun=false;
  if(motion.until>M.min&&motion.target)target=motion.target;
  else if(attacking===side&&role!=='GK'){
   const forward=['ST','LW','RW','CAM'].includes(role),fullback=['LB','RB'].includes(role);
   const ballNear=Math.abs(here[1]-ball[1])<25;
   const T=tacticProfile(side),quickBreak=transitionActive(side)&&(T.quick||T.approach==='Kontra');
   const advance=forward?8+(T.mentality>0?3:T.mentality<0?-3:0)+(quickBreak?4:0):fullback&&ballNear&&order!=='stay'&&T.mentality>=0&&
      (order==='overlap'||side==='opp'&&M.rand()<.32)?16:0;
   if(advance){
    const lanes=forward?[-11,0,11]:[0];
    const candidates=lanes.map(offset=>{
      const point=[limitPitch(target[0]+dir*advance,5,95),
        limitPitch(here[1]+offset+(role==='ST'?(ball[1]-here[1])*.22:0),8,92)];
      const space=pitchSpace(point,side);
      return {point,score:space.danger*1.8+space.support*.25+
        pitchDistance(point,here)*.008-(intelligence-60)*.012*(1-space.danger)};
    }).sort((a,b)=>a.score-b.score);
    target=candidates[0].point;
    motion.target=target;motion.until=M.min+(fullback?3:2);motion.action=fullback?'overlap':'supportRun';
    initiatedRun=true;
   }
   if(role==='CM'&&order==='stay')target=[limitPitch(target[0]-dir*9,5,95),target[1]];
   if(fullback&&order==='stay')target=[limitPitch(target[0]-dir*11,5,95),target[1]];
   if(!advance&&supporters.has(key)){
    // support the carrier: offer a passing angle diagonally behind/beside the ball, not on top of it
    const sp=[limitPitch(ball[0]-dir*7,5,95),limitPitch(ball[1]+(here[1]<ball[1]?-1:1)*13,8,92)];
    const blend=.12+normalizeAttribute(playerAttribute(id,side,'offBall',65))*.5;
    target=[target[0]*(1-blend)+sp[0]*blend,target[1]*(1-blend)+sp[1]*blend];motion.action='support';
   }
  }else if(attacking!==side&&role!=='GK'){
   const threat=pitchDistance(here,ball);
   const press=[.55,1,1.25][tacticProfile(side).press+1];
   const willing=order==='press'||order==='step'||(role!=='CB'&&press>1);
   if(threat<18*press&&willing&&pressers.has(key)){
    target=[...ball];motion.target=target;motion.until=M.min+2;motion.action='press';
   }else if(['CB','CM','LB','RB'].includes(role)){
    const opponent=nearestMarker(attacking,ball);
    const dangerPoint=opponent?eventPoint(opponent.id,attacking):ball;
    const cover=[limitPitch(dangerPoint[0]-dir*9,5,95),dangerPoint[1]];
    if(pitchDistance(here,cover)<26){
      const blend=.12+normalizeAttribute(intelligence)*.55;   // better positioning = tighter goal-side cover
      target=[target[0]*(1-blend)+cover[0]*blend,target[1]*(1-blend)+cover[1]*blend];
      motion.action='cover';
    }
   }
  }
  target=anchorLeash(isKeeper(side,id)?'GK':(role||'CM'),basePitchPosition(id,side),target);
  // after a corner/penalty the displaced players make a real recovery run (bounded by their own pace)
  const recovering=setPieceRecovering()&&pitchDistance(here,target)>14;
  const speed=recovering?limitPitch(topSpeed(id,side)*8,20,48):limitPitch(playerMoveRate(id,side)*.62,2,14);
  const dx=target[0]-here[0],dy=target[1]-here[1],length=Math.hypot(dx,dy)||1;
  const ax=dx/length*speed-motion.vx,ay=dy/length*speed-motion.vy;
  const turn=recovering?1:limitPitch(playerAttribute(id,side,'acceleration',70)/105, .35,.9);
  motion.vx=limitPitch(motion.vx+limitPitch(ax,-turn*speed,turn*speed),-speed,speed);
  motion.vy=limitPitch(motion.vy+limitPitch(ay,-turn*speed,turn*speed),-speed,speed);
  const next=[limitPitch(here[0]+motion.vx,4,96),limitPitch(here[1]+motion.vy,6,94)];
  if(length<1.5){motion.vx*=.45;motion.vy*=.45;}
  M.dynamicPositions[key]=next;M.pitchMotion[key]=motion;
  if(initiatedRun&&id!==M.ballOwner&&M.pitchRunMinute?.[side]!==M.min){
    M.pitchRunMinute ??={};M.pitchRunMinute[side]=M.min;
    if(side==='user'&&M.playerStats[id])M.playerStats[id].runs++;
    matchEvent('offBallRun',M.min+'’ '+(player?.name||'Rakip')+' boş alana koşuyor.',
     {playerId:side==='user'?id:null,fromId:id,toId:id,fromSide:side,toSide:side,
      ballSide:side,fromPos:here,toPos:next,carrierId:M.ballOwner});
  }
  if(side==='user'&&order==='runBehind'&&attacking===side&&M.playerStats[id]&&
     (target[0]-here[0])*dir>3&&M.min%3===1){
    M.playerStats[id].runs++;
    matchEvent('offBallRun',M.min+'’ '+player.name+' savunma arkasına koşuyor.',
      {playerId:id,fromId:id,toId:id,fromSide:side,toSide:side,ballSide:side,
       fromPos:here,toPos:next,carrierId:M.ballOwner});
  }
 }
 separatePlayers(M.dynamicPositions);
 if(M.ballOwner!=null&&M.ballSide!=='none'&&M.ballState?.state==='LIVE'){
  M.ballState.position=eventPoint(M.ballOwner,M.ballSide);
 }
 window.ManagerStoryLive3D?.endMotionSample?.();
}
function passLanePressure(a,b,side){
 const others=side==='user'?M.oppIds:M.active;
 let risk=0;
 for(const id of others){
  const p=eventPoint(id,side==='user'?'opp':'user');
  const segment=(b[0]-a[0])**2+(b[1]-a[1])**2||1;
  const t=limitPitch(((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/segment,0,1);
  if(t>.08&&t<.94)risk+=Math.max(0,8-pitchDistance(p,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]))/8;
 }
 return risk;
}
function weightedPitchChoice(options){
 const sum=options.reduce((n,x)=>n+Math.max(0,x.weight),0);
 let draw=M.rand()*sum;
 return options.find(x=>(draw-=Math.max(0,x.weight))<=0)||options.at(-1);
}
function passOptions(side,from,style){
 if(style===undefined)style=teamTactics(side).passingStyle;
 const T=tacticProfile(side),quickBreak=transitionActive(side)&&(T.quick||T.approach==='Kontra');
 const point=eventPoint(from,side),dir=(side==='user'?1:-1)*userDirection();
 const passer=playerAtMarker(from,side),vision=playerAttribute(from,side,'vision',68);
 const memory=(M.passMemory||[]).filter(m=>m.side===side).slice(-4);
 const lastPasser=memory.at(-1)?.side===side&&memory.at(-1)?.to===from?memory.at(-1).from:null;
 const own=Math.max(0,(dir>0?point[0]:100-point[0])),ownThird=own<34;
 const pressureNow=(nearestMarker(side==='user'?'opp':'user',point)?.d??99)<12;
 const candidates=(side==='user'?M.active:M.oppIds).filter(id=>id!==from&&pitchDistance(point,eventPoint(id,side))>=5);
 const raw=candidates.map(id=>{
  const target=eventPoint(id,side),range=pitchDistance(point,target),space=pitchSpace(target,side);
  const progress=(target[0]-point[0])*dir;
  const lane=passLanePressure(point,target,side),role=side==='user'?M.matchRoles[id]:opponentPlayer(id)?.position;
  const forward=progress>4&&['ST','CAM','LW','RW'].includes(role);
  // Vision = decision quality. High vision reads lanes/space accurately and values progression;
  // low vision misjudges them and drifts to the simple, nearby, safe option.
  const ve=attributeEdge(vision);
  const drive=(1+.25*T.mentality)*(T.patience?.7:1)*(quickBreak?1.9:1);   // tactics choose the preference, vision still judges it
  let weight=1+Math.max(-.65,progress*.038*(1+ve*1.4)*drive)-space.danger*.3*(1+ve)-lane*.35*(1+ve)*(1-.2*T.mentality);
  if(T.mentality<0&&progress<=8&&range<26)weight+=.3;
  if(T.patience)weight+=range<26?.5:-.4;
  if(style==='Direkt'&&range>30&&progress>12)weight+=.5;
  if(quickBreak&&progress>12&&lane<.7)weight+=.6;
  if(ve<0&&range<22)weight+=-ve*.9;
  if(ve>0&&progress>15&&lane<.6&&['ST','CAM','LW','RW','CM'].includes(role||''))weight+=ve*1.2;
  if(style==='Kısa')weight+=range<24?1.3:-.7;
  if(style==='Direkt')weight+=forward&&progress>15?1.25:-.3;
  if(T.width>0&&['LW','RW','LB','RB'].includes(role))weight+=.6;
  if(T.width<0&&['CM','CAM','ST'].includes(role))weight+=.6;
  if(T.approach==='Kanatlar'&&['LW','RW'].includes(role))weight+=.35;
  if(T.approach==='Merkez'&&['CAM','CM'].includes(role))weight+=.35;
  if(isKeeper(side,from)){
   const gkOrder=orderFor(from,side);
   if(gkOrder==='shortGK')weight+=range<30?1.1:-.7;
   else if(gkOrder==='longGK')weight+=progress>25?1.1:-.6;
  }
  // goalkeeper is a safety valve for defenders under pressure, not a normal outlet
  if(isKeeper(side,id)&&!isKeeper(side,from))weight*=(ownThird&&pressureNow&&['CB','LB','RB'].includes(role||''))?.55:.06;
  // no immediate return pass, and no A-B-A-B ping-pong, unless the carrier is genuinely pressed
  const oneTwoDone=memory.length>=2&&memory.at(-1).from===memory.at(-2).to&&memory.at(-1).to===memory.at(-2).from;
  if(id===lastPasser)weight*=oneTwoDone?(pressureNow?.35:.02):(pressureNow?.55:.18);
  else if(memory.slice(-3).some(m=>m.from===id&&m.to===from))weight*=.5;
  return {id,point:target,range,lane,space,weight:Math.max(.02,weight),forward,progress};
 });
 // prefer forward options when a usable one exists
 const usable=raw.some(o=>o.progress>10&&o.lane<.7&&o.range<58);
 return raw.filter(o=>o.range<=64).map(o=>o.progress<-6&&usable?{...o,weight:o.weight*.7}:o);
}
function pitchDribble(from,side,opponent){
 const owner=playerAtMarker(from,side),start=eventPoint(from,side),dir=(side==='user'?1:-1)*userDirection();
 const defendingSide=side==='user'?'opp':'user';
 const defender=(defendingSide==='user'?M.active:M.oppIds)
  .map(id=>({id,point:eventPoint(id,defendingSide)}))
  .filter(x=>(x.point[0]-start[0])*dir>-2)
  .map(x=>({id:x.id,d:pitchDistance(x.point,start)}))
  .sort((a,b)=>a.d-b.d)[0]||null;
 const pace=playerAttribute(from,side,'pace',70),acceleration=playerAttribute(from,side,'acceleration',pace);
 const distance=limitPitch(4+pace*.045+acceleration*.02,4,12);   // fitness/age/position are inside the effective values
 const lanes=[start[1]-6,start[1],start[1]+6].map(y=>{
  const point=[limitPitch(start[0]+dir*distance,6,94),limitPitch(y,7,93)];
  return {point,score:pitchSpace(point,side).danger*2+passLanePressure(start,point,side)*.4};
 }).sort((a,b)=>a.score-b.score);
 const end=lanes[0].point,near=defender&&pitchDistance(eventPoint(defender.id,defendingSide),end)<11;
 const chance=near?dribbleChance(from,side,defender.id,defendingSide,{pressure:Math.max(0,14-defender.d)/14}):1;
 // touch consistency: a free run can still end with a heavy touch; technique and dribbling make it rare
 const touchSkill=normalizeAttribute(playerAttribute(from,side,'technique',65)*.5+playerAttribute(from,side,'dribbling',65)*.5);
 const heavyTouch=!near&&M.rand()<clamp(.035-(touchSkill-.5)*.07,.004,.07);
 const success=!heavyTouch&&(!near||M.rand()<chance);
 const touchPresentation=heavyTouch&&window.ManagerStoryLive3D?.enabled?{carrierId:from,carrierSide:side,start:[...start],land:[...end],gameSecond:matchSecond(),source:'captured-before-heavy-touch-carrier-placement'}:null;
 const contestStart=near&&window.ManagerStoryLive3D?.enabled?[...eventPoint(defender.id,defendingSide)]:null;
 M.dynamicPositions[String(from)]=end;
 if(heavyTouch){
  const st=side==='user'?M.playerStats[from]:null;if(st)st.dribblesAttempted++;
  matchEvent('ballCarry',M.min+'’ '+(owner?.name||opponentName(from))+' topu açık bıraktı.',
   {playerId:side==='user'?from:null,fromId:from,toId:from,fromSide:side,toSide:side,ballSide:'none',fromPos:start,toPos:end,success:false});
  if(touchPresentation)window.ManagerStoryLive3D.captureHeavyTouch?.(touchPresentation);
  makeLooseBall(start,end,'touch',defendingSide);
  return false;
 }
 if(M.pitchMotion?.[String(from)]){
  M.pitchMotion[String(from)].target=end;M.pitchMotion[String(from)].until=M.min+2;
  M.pitchMotion[String(from)].action='dribble';
 }
 const stat=side==='user'?M.playerStats[from]:null;
 if(stat){stat.dribblesAttempted++;stat.distanceKm+=distance*.008;if(success){stat.dribbles++;stat.rating=clamp(stat.rating+.035,1,10);}}
 matchEvent(near?'dribble':'ballCarry',M.min+'’ '+(owner?.name||opponentName(from))+(success?' rakibini geçip topu taşıdı.':' müdahalede topu kaybetti.'),
  {playerId:side==='user'?from:null,fromId:from,toId:success?from:defender?.id,fromSide:side,
   toSide:success?side:defendingSide,ballSide:success?side:defendingSide,fromPos:start,toPos:end,success});
 if(near){
  M.dynamicPositions[String(defender.id)]=success?
    [limitPitch(end[0]-dir*4,4,96),end[1]]:end;
  recordPitchTackle(defender.id,defendingSide,from,side,!success,end);
  if(contestStart)window.ManagerStoryLive3D.linkDribbleContest({attackerId:from,attackerSide:side,defenderId:defender.id,defenderSide:defendingSide,attackerStart:[...start],point:[...end],defenderStart:contestStart,defenderEnd:[...M.dynamicPositions[String(defender.id)]],attackerKeepsBall:success});
  if(boxChallengePenalty(defender.id,defendingSide,from,side,end))return false; // stop the carry: a penalty is being taken
 }
 if(!success&&near){
  switchPitchOwner(defender.id,defendingSide);
  M.stats.possessionsWon[defendingSide==='user'?userSide():1-userSide()]++;
  setBallState(end,defender.id);
 }else setBallState(end,from);
 return success;
}
/* Existing tick owns all outcomes; each choice uses positions, skills, tactics and seeded RNG. */
function actionMinute(userPoss,effect,opponent){
 if(engineFrozen())return;
 evolvePitchPositions();
 if(M.looseBall)resolveLooseBall(8);
 else if(M.ballOwner==null||M.ballSide==='none')makeLooseBall(M.ballState?.position||[50,50],M.ballState?.position||[50,50],'recovery',userPoss?'user':'opp');
 if(M.ballOwner==null)return; // ball still in flight/loose: nobody may act with it
 const desired=userPoss?'user':'opp';
 if(M.ballOwner!=null&&M.ballSide!==desired){
  const carrier=M.ballOwner,side=M.ballSide,point=eventPoint(carrier,side),defSide=desired;
  const defender=nearestMarker(defSide,point);
  const reach=13*[.8,1,1.25][tacticProfile(defSide).press+1];   // pressure distance threshold
  if(defender&&defender.d<reach){
   const press=(()=>{const P=tacticProfile(defSide).press;return P>0?.11:P<0?-.07:0;})();
   const success=M.rand()<tackleChance(defender.id,defSide,carrier,side,{distance:defender.d,press});
   const gainStart=window.ManagerStoryLive3D?.enabled?{attackerId:carrier,attackerSide:side,defenderId:defender.id,defenderSide:defSide,attackerStart:[...point],point:[...point],defenderStart:[...eventPoint(defender.id,defSide)],decision:"actionMinute"}:null;
   M.dynamicPositions[String(defender.id)]=moveTowards(eventPoint(defender.id,defSide),point,defender.d);
   recordPitchTackle(defender.id,defSide,carrier,side,success,point);
   if(boxChallengePenalty(defender.id,defSide,carrier,side,point))return; // the penalty sequence owns the rest of this minute
   if(success){
    switchPitchOwner(defender.id,defSide);setBallState(point,defender.id);
    M.stats.possessionsWon[defSide==='user'?userSide():1-userSide()]++;
    matchEvent('interception',M.min+'’ '+(playerAtMarker(defender.id,defSide)?.name||'Rakip')+' topu kazandı.',
     {fromId:carrier,toId:defender.id,fromSide:side,toSide:defSide,ballSide:defSide,fromPos:point,toPos:point});
    if(gainStart)window.ManagerStoryLive3D.linkCarrierGain?.({...gainStart,defenderEnd:[...eventPoint(defender.id,defSide)]});
   }
  }
 }
 const Tm=tacticProfile(userPoss?'user':'opp');
 const count=M.rand()<(.19+Tm.tempo*.11-(Tm.patience?.05:0)+(transitionActive(userPoss?'user':'opp')&&(Tm.quick||Tm.approach==='Kontra')?.08:0))?2:1;
 for(let i=0;i<count;i++){
  let side=M.ballSide,from=M.ballOwner;if(from==null||side==='none')break;
  const owner=playerAtMarker(from,side),role=side==='user'?M.matchRoles[from]:owner?.position;
  const point=eventPoint(from,side),dir=(side==='user'?1:-1)*userDirection();
  const forward=dir>0?point[0]:100-point[0];
  const nearby=nearestMarker(side==='user'?'opp':'user',point);
  const pressure=nearby?Math.max(0,14-nearby.d)/14:0;
  const technique=playerAttribute(from,side,'technique',65);
  const composure=playerAttribute(from,side,'composure',65);
  const options=passOptions(side,from);
  const best=options.slice().sort((a,b)=>b.weight-a.weight)[0];
  const order=orderFor(from,side);
  const attitude=[.8,1,1.25][tacticProfile(side).mentality+1];
  const actions=[{type:'pass',weight:Math.max(.4,3-pressure*.7+(best?.weight||0)*.22)},
   {type:'carry',weight:role==='GK'?.03:Math.max(.08,(playerAttribute(from,side,'dribbling',65)-45)*.027*attitude+
       (order==='inside'||order==='wide'?.45:0)-pressure*.2)},
   {type:'hold',weight:pressure>.45&&(role==='ST'||order==='holdUp')?(.28+(playerAttribute(from,side,'strength',70)-50)*.015):.04},
   {type:'shoot',weight:forward>68&&role!=='GK'?Math.max(.1,(forward-65)*.045+
      (playerAttribute(from,side,'finishing',65)-55)*.008+
      (playerAttribute(from,side,'vision',65)*.5+playerAttribute(from,side,'composure',65)*.5-65)*.012-
      pitchSpace(point,side).danger*.14+(order==='shoot'?.65:0))*attitude:.0}];
  if(order==='riskPass')actions[0].weight*=1.18;
  if(order==='stay')actions[1].weight*=.6;
  const choice=weightedPitchChoice(actions);
  if(choice.type==='shoot'){chanceV73(side==='user');M.minuteShot=true;break;}
  if(choice.type==='hold'&&nearby&&nearby.d<8&&M.rand()>.75+.25*physicalContest(from,side,nearby.id,side==='user'?'opp':'user')){
   // shield lost: the ball runs loose and is contested for real
   matchEvent('hold',M.min+'’ '+(owner?.name||'Rakip')+' topu koruyamadı.',
    {fromId:from,toId:from,fromSide:side,toSide:side,ballSide:'none',fromPos:point,toPos:point,success:false});
   window.ManagerStoryLive3D?.captureShield?.({attackerId:from,attackerSide:side,defenderId:nearby.id,defenderSide:side==='user'?'opp':'user',point:[...point],defenderStart:[...eventPoint(nearby.id,side==='user'?'opp':'user')]});
   makeLooseBall(point,point,'shield',side==='user'?'opp':'user');
   break;
  }
  if(choice.type==='hold'){
   matchEvent('hold',M.min+'’ '+(owner?.name||'Rakip')+' topu koruyup destek bekledi.',
    {fromId:from,toId:from,fromSide:side,toSide:side,ballSide:side,fromPos:point,toPos:point});
   window.ManagerStoryLive3D?.captureShield?.({attackerId:from,attackerSide:side,defenderId:nearby?.id,defenderSide:side==='user'?'opp':'user',point:[...point],defenderStart:nearby?[...eventPoint(nearby.id,side==='user'?'opp':'user')]:null});
   continue;
  }
  if(choice.type==='carry'){
   let success=pitchDribble(from,side,opponent);
   if(success&&i===0&&M.rand()<.22&&pitchSpace(eventPoint(from,side),side).danger<1.4){
    success=pitchDribble(from,side,opponent);
   }
   if(!success)break;
   continue;
  }
  if(!options.length)break;
  const selected=weightedPitchChoice(options),target=selected.id,to=selected.point;
  M.passMemory??=[];if(M.passMemory.at(-1)&&M.passMemory.at(-1).side!==side)M.passMemory.length=0;
  M.passMemory.push({side,from,to:target});if(M.passMemory.length>8)M.passMemory.shift();
  const passer=playerAtMarker(from,side),range=selected.range;
  const passing=playerAttribute(from,side,'passing',opponent[4]);
  const accuracy=passSuccessProbability(from,side,selected,{pressure,effect,risk:order==='riskPass',tempo:tacticProfile(side).tempo});
  const stat=side==='user'?M.playerStats[from]:null,index=side==='user'?userSide():1-userSide();
  M.stats.passes[index]++;if(stat)stat.passesAttempted++;
  let success=M.rand()<accuracy,aerialLost=false,pendingThrow=null,pendingThrowSide=null,cutPresentation=null;
  const longBall=range>29||(['LW','RW'].includes(role)&&range>22&&forward>58);
  const contested=range>38||(['LW','RW'].includes(role)&&range>26&&forward>58);   // only genuinely high/long deliveries are contested
  if(success&&contested){
   // the pass reached the area; the header/first contact is a physical contest (strength, positioning, pace)
   const rival=nearestMarker(side==='user'?'opp':'user',to);
   if(rival&&rival.d<7){
    if(M.rand()>aerialWinProbability(target,side,rival.id,side==='user'?'opp':'user')){success=false;aerialLost=true;}
   }
  }
  if(aerialLost){
   makeLooseBall(point,to,'aerial',side);
  }else if(success){
   M.stats.completedPasses[index]++;if(stat){stat.passesCompleted++;if(selected.forward&&range>20)stat.keyPasses++;}
   switchPitchOwner(target,side);setBallState(to,target);
  }else{
   const defSide=side==='user'?'opp':'user',interceptor=nearestMarker(defSide,to);
   if(interceptor&&interceptor.d<18){
    if(window.ManagerStoryLive3D?.enabled)cutPresentation={id:interceptor.id,side:defSide,start:[...eventPoint(interceptor.id,defSide)],intendedTarget:[...to]};
    const gain=moveTowards(eventPoint(interceptor.id,defSide),to,Math.min(interceptor.d,10));
    M.dynamicPositions[String(interceptor.id)]=gain;
    switchPitchOwner(interceptor.id,defSide);setBallState(gain,interceptor.id);
    M.stats.possessionsWon[defSide==='user'?userSide():1-userSide()]++;
   }else if((to[1]<12||to[1]>88)&&M.rand()<.4){
    // the ball ran out over the touchline: the other team throws it in once the pass event has been logged
    pendingThrow=[to[0],to[1]<50?-3:103];pendingThrowSide=defSide;
    M.ballOwner=null;M.ballSide='none';M.looseBall=null;setBallState(to,null,'BALL_OUT');
   }else makeLooseBall(point,to,'pass',defSide);
  }
  const newOwner=M.ballOwner,newSide=M.ballSide,wing=['LW','RW'].includes(role);
  const landing=newOwner==null?[...(M.ballState?.position||to)]:eventPoint(newOwner,newSide);
  const cross=wing&&range>22&&forward>58;
  matchEvent(cross?'cross':'pass',M.min+'’ '+(passer?.name||'Rakip')+(cross?' orta yaptı.':' pas verdi.')+
    (success?'':aerialLost?' Havadaki mücadele ikinci topa düştü.':' Top rakibe geçti.'),{side:index,fromId:from,toId:newOwner,fromSide:side,toSide:newSide,
     ballSide:newSide,fromPos:point,toPos:success?to:landing,success,
     passKind:cross?'cross':selected.forward&&range>24?'through':range>29?'long':'short',travelType:longBall?'aerial':'ground',
     distance:range,passing});
  if(cutPresentation)window.ManagerStoryLive3D.linkPassCut?.(cutPresentation);
  if(success){
   const receiver=playerAtMarker(target,side);
   matchEvent('firstTouch',M.min+'’ '+(receiver?.name||'Rakip')+' topu kontrol etti.',
    {fromId:target,toId:target,fromSide:side,toSide:side,ballSide:side,fromPos:to,toPos:to});
  }
  if(pendingThrow)startPitchRestart('THROW_IN',pendingThrowSide,pendingThrow);
 }
 if(M.ballSide==='user')M.userPossTicks++;else M.oppPossTicks++;
}
function chanceV73(user) {
  if(engineFrozen())return;
  const r=currentOpponent(),side=user?userSide():1-userSide();
  const sideName=user?'user':'opp';
  if(M.ballOwner==null)return;
  if(M.ballSide!==sideName){
    const spot=eventPoint(M.ballOwner,M.ballSide),defender=nearestMarker(sideName,spot);
    if(!defender||defender.d>19)return;
    const previous=M.ballOwner,previousSide=M.ballSide;
    const gainStart=window.ManagerStoryLive3D?.enabled?{attackerId:previous,attackerSide:previousSide,defenderId:defender.id,defenderSide:sideName,attackerStart:[...spot],point:[...spot],defenderStart:[...eventPoint(defender.id,sideName)],decision:"chanceV73"}:null;
    M.dynamicPositions[String(defender.id)]=moveTowards(eventPoint(defender.id,sideName),spot,Math.min(10,defender.d));
    recordPitchTackle(defender.id,sideName,previous,previousSide,true,spot);
    switchPitchOwner(defender.id,sideName);
    M.stats.possessionsWon[side]++;
    matchEvent('interception',M.min+'’ '+(playerAtMarker(defender.id,sideName)?.name||'Rakip')+' topu kazandı.',
      {fromId:previous,toId:defender.id,fromSide:previousSide,toSide:sideName,
       ballSide:sideName,fromPos:spot,toPos:eventPoint(defender.id,sideName)});
    if(gainStart)window.ManagerStoryLive3D.linkCarrierGain?.({...gainStart,defenderEnd:[...eventPoint(defender.id,sideName)]});
  }
  let carrier=M.ballOwner;
  const carrierSide=M.ballSide,dir=(user?1:-1)*userDirection();
  let before=eventPoint(carrier,carrierSide),progress=dir>0?before[0]:100-before[0];
  const prevPass=(M.passMemory||[]).at(-1);
  if(progress<48){
    const advancing=(sideName==='user'?M.active:M.oppIds)
     .filter(id=>id!==carrier&&!isKeeper(sideName,id))
     .map(id=>({id,point:eventPoint(id,sideName)}))
     .filter(x=>(dir>0?x.point[0]:100-x.point[0])>52&&pitchDistance(before,x.point)<69)
     .filter(x=>x.id!==(prevPass&&prevPass.side===sideName&&prevPass.to===carrier?prevPass.from:null))
     .sort((a,b)=>{const pen=id=>['CB','LB','RB'].includes(sideName==='user'?M.matchRoles[id]:opponentPlayer(id)?.position)?25:0;
       return pitchDistance(before,a.point)+pen(a.id)-pitchDistance(before,b.point)-pen(b.id)})[0];
    if(!advancing)return;
    M.passMemory??=[];M.passMemory.push({side:sideName,from:carrier,to:advancing.id});if(M.passMemory.length>8)M.passMemory.shift();
    const origin=before,passing=playerAttribute(carrier,sideName,'passing',65);
    matchEvent('pass',M.min+'’ Hücum bölgesine uzun pas.',
      {fromId:carrier,toId:advancing.id,fromSide:sideName,toSide:sideName,ballSide:sideName,
       fromPos:origin,toPos:advancing.point,success:true,passKind:'long',
       distance:pitchDistance(origin,advancing.point),passing});
    switchPitchOwner(advancing.id,sideName);
    M.stats.passes[side]++;M.stats.completedPasses[side]++;
    carrier=advancing.id;before=advancing.point;
    progress=dir>0?before[0]:100-before[0];
  }
  const candidate=(user?M.active:M.oppIds).filter(id=>
    id!==carrier&&!isKeeper(sideName,id))
   .map(id=>({id,point:eventPoint(id,sideName)}))
   .filter(x=>pitchDistance(before,x.point)<24&&
     (dir>0?x.point[0]:100-x.point[0])>progress-8)
   .sort((a,b)=>pitchSpace(a.point,sideName).danger-pitchSpace(b.point,sideName).danger)[0];
  const carrierRole=user?M.matchRoles[carrier]:opponentPlayer(carrier)?.position;
  const shooter=carrierRole==='GK'&&candidate?candidate.id:carrier;
  const target=eventPoint(shooter,sideName);
  const shooterPlayer=playerAtMarker(shooter,sideName);
  const p=user?shooterPlayer:{...(shooterPlayer||{}),name:shooterPlayer?.name||r[0]+' forvet',
    finishing:shooterPlayer?.shooting??r[3],physical:shooterPlayer?.overall??r[8],fitness:shooterPlayer?.fitness??90};
  if(!p)return;
  // the DEFENDING team's line decides the offside trap, for either side
  const defLine=tacticProfile(user?'opp':'user').line;
  if(defLine>0&&M.rand()<.065){
    matchEvent('offside',user?`${M.min}’ ${p.name} savunma çizgisinin arkasına erken koştu; ofsayt.`:`${M.min}’ Rakip forvet savunma çizgisinin arkasına erken koştu; ofsayt.`,
      {side:user?userSide():1-userSide(),playerId:user?p.id:shooter,fromId:shooter,fromSide:user?'user':'opp',fromPos:target,toPos:target});
    startPitchRestart('FREE_KICK',user?'opp':'user',target);
    return;
  }
  if(carrier!==shooter) {
    matchEvent('offBallRun',M.min+'’ '+p.name+' şut için boş alana koştu.',
      {fromId:shooter,toId:shooter,playerId:user?p.id:null,fromSide:user?'user':'opp',
        toSide:user?'user':'opp',ballSide:carrierSide,carrierId:carrier,fromPos:target,toPos:target});
    matchEvent('pass',M.min+'’ '+(carrierSide==='user'?S.players.find(x=>x.id===carrier)?.name||'Takım':'Rakip')+
      ' hücum oyuncusuna oynadı.',{fromId:carrier,toId:shooter,fromSide:carrierSide,toSide:user?'user':'opp',
        ballSide:user?'user':'opp',fromPos:before,toPos:target,success:true,passKind:'through',
        distance:Math.hypot(target[0]-before[0],target[1]-before[1]),passing:playerAttribute(carrier,carrierSide,'passing',70)});
    if(carrierSide==='user'&&M.playerStats[carrier]) {
      const st=M.playerStats[carrier];st.passesAttempted++;st.passesCompleted++;st.keyPasses++;
      M.stats.passes[userSide()]++;M.stats.completedPasses[userSide()]++;
      st.rating=clamp(st.rating+.06,1,10);
    }
  }
  return resolveShot(user,shooter,p);
}

/* Shared shot resolution: open play (chanceV73), corner headers and penalties all end here. */
function resolveShot(user,shooter,p,opts={}) {
  if(engineFrozen()||!p)return;
  const r=currentOpponent(),side=user?userSide():1-userSide(),sideName=user?'user':'opp';
  const dir=(user?1:-1)*userDirection();
  const defLine=tacticProfile(user?'opp':'user').line;
  switchPitchOwner(shooter,sideName);
  const shotStart=window.ManagerStoryLive3D?.enabled?[...eventPoint(shooter,sideName)]:null;
  if(opts.source)M.dynamicPositions[String(shooter)]=[...opts.source];
  const source=opts.source?[...opts.source]:eventPoint(shooter,sideName);
  const destination=[dir>0?98:2,50+(M.rand()-.5)*16],opponentGK=keeperId(user?'opp':'user');
  const effects=tacticalEffects(),key=orderFor(shooter,sideName);
  let qMod=1;
  if(user) {
    qMod=effects.attack;
    if(key==='runBehind'&&r[2]==='high')qMod*=1.07;
    if(key==='holdUp'&&playerAttribute(shooter,'user','strength',70)>=75)qMod*=1.04;
    if(key==='shoot')qMod*=.97;
    M.playerStats[p.id].shots++;
  } else qMod=1/effects.defence;
  qMod*=1+.04*defLine;   // high line = more space behind, low line = less
  // the ACTIVE keeper decides saves: never a hardcoded id, never a sent-off / substituted keeper
  const keeperSide=user?'opp':'user';
  const gk=S.players.find(x=>x.id===keeperId('user'));
  const keeper=playerRecord(opponentGK,keeperSide)?keeperRating(opponentGK,keeperSide):(user?r[6]:30);
  const distance=dir>0?100-source[0]:source[0];
  const pressure=pitchSpace(source,sideName).danger;
  const shot=shotProbabilities(shooter,sideName,{qMod,distance,angle:Math.abs(source[1]-50),pressure,keeper});
  let onProbability=shot.onTarget,goalProbability=shot.goal;
  if(opts.penalty){
    // penalty: execution (finishing, composure) against the ACTIVE keeper; no distance/pressure/block
    const finN=normalizeAttribute(playerAttribute(shooter,sideName,'finishing',65)),compN=normalizeAttribute(playerAttribute(shooter,sideName,'composure',65)),kN=normalizeAttribute(keeper);
    onProbability=clamp(.84+(finN-.5)*.14+(compN-.5)*.10,.62,.97);
    goalProbability=clamp(.83+(finN-.5)*.10-(kN-.5)*.22,.55,.94);
  }else if(opts.header){
    onProbability=clamp(onProbability*.85+.03,.15,.8);   // headers are harder to direct than feet
  }
  const xg=onProbability*goalProbability;
  M.stats.xg[side]+=xg;if(xg>=.20)M.stats.bigChances[side]++;
  M.shots[side]++;
  const on=M.rand()<onProbability;
  if(on)M.ont[side]++;
  const goal=on&&M.rand()<goalProbability;
  let outcome=goal?'goal':on?'save':(opts.penalty?false:M.rand()<.19)?'block':M.rand()<(opts.penalty?.22:.16)?'post':'wide';
  // the woodwork is a real outcome: the ball reaches the frame at an exact spot and rebounds from it
  const frame=outcome==='post'?(M.rand()<.4?'crossbar':'post'):null;
  if(outcome==='wide')destination[1]=destination[1]<50?28:72;
  if(outcome==='post')destination[1]=frame==='crossbar'?50+(M.rand()-.5)*10:(destination[1]<50?39:61);
  matchEvent('shot',M.min+'’ '+p.name+' şut çekti.',{side,playerId:user?p.id:null,fromId:shooter,
    fromSide:user?'user':'opp',ballSide:user?'user':'opp',fromPos:source,toPos:destination,
    goalkeeperId:opponentGK,xg,onTarget:on,outcome,frame,restartType:opts.restartType||null,header:!!opts.header,penalty:!!opts.penalty});
  if(shotStart)window.ManagerStoryLive3D.captureShotStart?.(shotStart);
  if(!goal)matchEvent('chance',M.min+'’ '+p.name+' şutunun sonucu: '+({save:'kurtarış',block:'blok',post:'direk',wide:'aut'}[outcome])+'.',
    {side,playerId:user?p.id:null,xg,onTarget:on,outcome});
  if(goal) {

    const netPoint=[dir>0?101.4:-1.4,destination[1]];
    matchEvent('goal','⚽ '+M.min+'’ '+p.name+' vurdu... GOL!',{side,playerId:user?p.id:null,
      scorer:p.name,xg,fromId:shooter,fromSide:user?'user':'opp',ballSide:'none',
      fromPos:destination,toPos:netPoint,inNet:true,penalty:!!opts.penalty,header:!!opts.header});
    M.ballOwner=null;M.ballSide='none';setBallState(netPoint,null,'GOAL_NET');
    M.goalScene={scorer:p.name,minute:M.min};
    if(user){
      p.goals=(p.goals||0)+1;p.morale=Math.min(100,p.morale+2);p.form=Math.min(100,p.form+2);
      M.playerStats[p.id].goals++;
      M.playerStats[p.id].rating=clamp(M.playerStats[p.id].rating+1,1,10);
    }else if(gk)M.playerStats[gk.id].rating=clamp(M.playerStats[gk.id].rating-.35,1,10);
    emitPitchKickoff(user?'opp':'user');
    return;
  }
  if(outcome==='save') {
    const catchP=clamp(.53+(normalizeAttribute(keeperHandling(opponentGK,user?'opp':'user'))-.5)*.36,.25,.8);
    const saveType=M.rand()<catchP?'CATCH':M.rand()<.64?'PARRY':'DEFLECT_CORNER';
    matchEvent('save',M.min+'’ '+(user?opponentName(opponentGK):gk?.name||'Kaleci')+' kurtardı.',
      {side,playerId:user?null:gk?.id,fromId:shooter,toId:opponentGK,
        fromSide:user?'user':'opp',toSide:user?'opp':'user',ballSide:user?'opp':'user',
        fromPos:destination,toPos:basePitchPosition(opponentGK,user?'opp':'user'),saveType});
    if(saveType==='CATCH')switchPitchOwner(opponentGK,user?'opp':'user');
    else if(saveType==='PARRY')makeLooseBall(destination,[destination[0]-dir*10,limitPitch(destination[1]+5,18,82)],'parry',user?'opp':'user');
    else {M.stats.corners[side]++;startPitchRestart('CORNER',user?'user':'opp',[dir>0?102:-2,destination[1]<50?-3:103]);}
    if(!user&&gk){M.playerStats[gk.id].saves++;M.playerStats[gk.id].rating=clamp(M.playerStats[gk.id].rating+.12,1,10);}
  } else if(outcome==='block') {
    const blocker=nearestOpponent(user?'user':'opp',destination);
    matchEvent('block',M.min+'’ Savunmacı şutu engelledi.',{side,fromId:shooter,toId:blocker,
      fromSide:user?'user':'opp',toSide:user?'opp':'user',ballSide:user?'opp':'user',
      fromPos:destination,toPos:eventPoint(blocker,user?'opp':'user')});
    // ONE outcome per block: either it deflects behind for a corner, or it drops as a contested second ball.
    if(M.rand()<.42){
      M.stats.corners[side]++;
      startPitchRestart('CORNER',user?'user':'opp',[dir>0?102:-2,source[1]<50?-3:103]);
    }else makeLooseBall(destination,blocker!=null?eventPoint(blocker,user?'opp':'user'):destination,'block',user?'opp':'user');
  } else if(outcome==='post') {
    const rebound=frame==='crossbar'?[destination[0]-dir*10,limitPitch(destination[1]+(M.rand()-.5)*10,30,70)]:
      [destination[0]-dir*6,limitPitch(destination[1]+(destination[1]<50?-1:1)*(6+M.rand()*6),20,80)];
    matchEvent('post',M.min+'’ '+(frame==='crossbar'?'Şut üst direkten döndü!':'Şut direkten döndü!'),{side,fromId:shooter,
      fromSide:user?'user':'opp',ballSide:'none',fromPos:destination,toPos:rebound,frame,hitFrame:true});
    makeLooseBall(destination,rebound,frame||'post',user?'opp':'user');
  } else {
    matchEvent('wide',M.min+'’ Top auta çıktı.',{side,fromId:shooter,
      fromSide:user?'user':'opp',ballSide:'none',fromPos:source,toPos:destination});
    const keeperSide=user?'opp':'user';
    startPitchRestart('GOAL_KICK',keeperSide,[dir>0?102:-2,destination[1]]);
  }
  if(user&&outcome==='save')M.playerStats[p.id].rating=clamp(M.playerStats[p.id].rating+.05,1,10);
  if(user&&outcome!=='save'&&xg>=.18)M.playerStats[p.id].rating=clamp(M.playerStats[p.id].rating-.11,1,10);
}
