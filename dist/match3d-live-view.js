import {keeperPose} from './match3d-keeper.js';
import { metres,percent,clamp,smooth } from './match3d-pass-timeline.js';
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(v,k)=>v.map(x=>x*k),mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u);
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
// Pose state only. Every root and ball coordinate is read from the common MatchView frame.
export function createLivePoseSampler(){
 const previous=new Map();let lastTime=null,focus=null,span=11,lastPass=null,lastSample=null,lastSignature=null,netImpact=null;
 return (snapshot,{aspect=1}={})=>{
  const P=snapshot.presentation,raw=P?.activeEvent,k=P?.kickoffMotion,e=k?{...raw,type:'pass',...k,fromSide:raw.fromSide,toSide:raw.fromSide}:raw,p=k?.progress??P?.progress??0,time=P?.seconds??0,signature=JSON.stringify([time,e?.eventId,e?.type,p,snapshot.matchSeconds,snapshot.ball.displayPosition,aspect]);
  if(signature===lastSignature)return lastSample;
  const dt=lastTime==null?0:Math.max(0,time-lastTime);
  if(lastTime!=null&&time<lastTime){previous.clear();focus=null;lastPass=null;}lastTime=time;
  const pass=e&&(['pass','cross','corner','goalKick'].includes(e.type)||!!e.headerShot),ball=metres(snapshot.ball.displayPosition||snapshot.ball.engine.position);
  const shot=P?.shotMotion,kicking=pass||!!shot;
  const A=kicking||e?.type==='kickoff'?metres(e.fromPos):ball,B=pass?metres(e.toPos):shot?metres(shot.target||shot.result.fromPos):ball,len=Math.hypot(B[0]-A[0],B[2]-A[2]),u=clamp((p-.19)/.57),dir=len?[(B[0]-A[0])/len,0,(B[2]-A[2])/len]:[0,0,1],right=[dir[2],0,-dir[0]];
  const aerial=pass&&e.travelType==='aerial',tracking=pass&&(aerial||len>18);ball[1]=(!e||e.type==='enginePositionGap'?(snapshot.ball.presentationHeight??.15):.15)+(aerial?Math.sin(Math.PI*u)*clamp(len/12,1.2,3.8):0);
  if(shot)ball[1]=shot.height;
  if(P?.keeperControl||P?.keeperDistribution)ball[1]=snapshot.ball.presentationHeight;
  if(e?.headerShot){const v=clamp((p-.19)/.81);ball[1]=.15+(1.704-.15)*v+Math.sin(Math.PI*v)*2.4;}
  if(pass)lastPass=e;
  const reset=e?.goalReset||e?.restartReset,resetTime=reset?p*P.duration:0,placed=reset&&resetTime>=.15;
  if(placed&&lastSample?.resetPlaced!==true){previous.clear();focus=null;lastPass=null;}
  const poses=[],gaps=[];
  for(const player of snapshot.players){
   const key=`${player.side}:${player.id}`,root=metres(player.displayPosition||player.enginePosition),old=previous.get(key);
   const move=old?root.map((x,i)=>x-old.root[i]):[0,0,0],distance=Math.hypot(move[0],move[2]),travel=(old?.travel||0)+distance;
   const speed=dt>0?distance/dt:0,moving=!reset&&dt>0&&distance>1e-6,direction=moving?[move[0]/distance,0,move[2]/distance]:old?.direction||[player.attackDirection,0,0];
   let yaw=old?.yaw??Math.atan2(direction[0],direction[2]);
   if(moving)yaw=angle(yaw,Math.atan2(direction[0],direction[2]),1-Math.exp(-dt*12));
   const forward=[Math.sin(yaw),0,Math.cos(yaw)],lateral=[forward[2],0,-forward[0]];
   // Distance-driven stance anchors. Swing starts at the old plant and lands
   // ahead of the moving root; turns replant an unreachable foot, never a root.
   const stride=1.25,phase=(old?.gaitPhase||0)+(moving?distance/stride:0),run=clamp(speed/7);
   const feet=[-1,1].map((sign,i)=>{
    const q=phase+i*.5,cycle=Math.floor(q),f=q-cycle,plant=!moving||f<.5;
    const neutral=add(root,mul(lateral,sign*.102));neutral[1]=.09;
    let point=old?.feet[i]?.point,launch=old?.feet[i]?.launch;
    const unreachable=point&&Math.hypot(point[0]-root[0],point[2]-root[2])>.52;
    if(!moving)point=neutral;
    else if(!point||old.feet[i].cycle!==cycle||(!old.feet[i].plant&&plant)||unreachable)point=add(neutral,mul(forward,.25));
    if(!plant){if(!launch||old?.feet[i]?.plant||old?.feet[i]?.cycle!==cycle)launch=[...point];
     const swing=(f-.5)*2;point=mix(launch,add(neutral,mul(forward,.30)),smooth(swing));point[1]=.09+Math.sin(Math.PI*swing)*(.10+.08*run);
    }else {point=[point[0],.09,point[2]];launch=null;}
    return {point,cycle,plant,launch};
   });
   let left=feet[0].point,rightFoot=feet[1].point,arm=moving?Math.sin(phase*Math.PI*2)*(.16+.22*run):0;
   const turn=old?Math.atan2(Math.sin(yaw-old.yaw),Math.cos(yaw-old.yaw)):0;
   let pelvisHeight=.935-(moving?.025*run*Math.cos(phase*Math.PI*4):0),lean=moving?.07+.14*run:0,bodyRoll=moving?-.028*Math.sin(phase*Math.PI*2)-clamp(turn,-.10,.10):0,bodyTwist=moving?.035*Math.sin(phase*Math.PI*2):0,headPitch=0,leftHand=null,rightHand=null;
   if((kicking||e?.type==='kickoff')&&!shot?.header&&player.id===e.fromId&&player.side===e.fromSide){
    yaw=angle(yaw,Math.atan2(dir[0],dir[2]),smooth(p/.19));
    const contact=add(A,mul(dir,-.30));contact[1]=.16;
    const neutral=add(root,mul(right,.102));neutral[1]=.09;
    const support=add(add(e.goalKickRunUp?metres(e.goalKickRunUp.contact):root,mul(right,-.13)),mul(dir,.05));support[1]=.09;left=e.goalKickRunUp&&p<.19?mix(left,support,smooth((p-.10)/.09)):support;
    const prepare=smooth(p/.19),follow=clamp((p-.19)/.81);
    lean=p<.19?-.09*Math.sin(Math.PI*prepare):.16*Math.sin(Math.PI*follow);
    bodyTwist=p<.19?-.13*Math.sin(Math.PI*prepare):.14*Math.sin(Math.PI*follow);bodyRoll=-.035*Math.sin(Math.PI*p);arm=-.20*Math.sin(Math.PI*p);
    if(p<=.19){const prep=smooth(p/.19);const strike=mix(neutral,contact,prep);const windup=add(strike,mul(dir,-.28*Math.sin(Math.PI*prep)));windup[1]+=.10*Math.sin(Math.PI*prep);rightFoot=e.goalKickRunUp?mix(rightFoot,windup,smooth((p-.10)/.09)):windup;}
    else{const follow=clamp((p-.19)/.81);rightFoot=mix(contact,neutral,smooth(follow));rightFoot=add(rightFoot,mul(dir,.25*Math.sin(Math.PI*follow)));rightFoot[1]+=.12*Math.sin(Math.PI*follow);}
    gaps.push({id:player.id,kind:'source-root-to-contact',metres:Math.hypot(root[0]-A[0],root[2]-A[2])});
   }
   const carry=P?.carryMotion;
   if(carry&&player.id===e.fromId&&player.side===e.fromSide&&(!carry.heavyContact||p<.65)){
    // Reach only near a derived touch; intervening frames keep the distance-based gait.
    const phase=carry.touchPhase,weight=1-smooth(Math.min(phase,1-phase)/.12);
    const pathA=metres(e.fromPos),pathB=metres(e.toPos),n=Math.hypot(pathB[0]-pathA[0],pathB[2]-pathA[2])||1;
    const touchDir=[(pathB[0]-pathA[0])/n,0,(pathB[2]-pathA[2])/n];
    const contact=add(ball,mul(touchDir,-.30));contact[1]=.16;
    rightFoot=mix(rightFoot,contact,weight);
    gaps.push({id:player.id,kind:'derived-carry-touch',metres:Math.hypot(root[0]-ball[0],root[2]-ball[2]),phase,weight});
   }
   if(carry?.heavyContact&&player.id===e.fromId&&player.side===e.fromSide&&p>=.65){
    const contact=metres(carry.heavyContact),start=metres(e.fromPos),n=Math.hypot(contact[0]-start[0],contact[2]-start[2])||1;
    const direction=[(contact[0]-start[0])/n,0,(contact[2]-start[2])/n];yaw=Math.atan2(direction[0],direction[2]);
    const foot=add(contact,mul(direction,-.30));foot[1]=.16;
    if(p<=.76)rightFoot=mix(rightFoot,foot,smooth((p-.65)/.11));
    else{const neutral=add(root,mul([direction[2],0,-direction[0]],.102));neutral[1]=.09;rightFoot=mix(foot,neutral,smooth((p-.76)/.24));}
   }
   const contest=P?.contestMotion;
   let keeperMotion=null,pelvisRoll=0,poseRoot=root;
   const control=P?.keeperControl?.id===player.id&&P.keeperControl.side===player.side?P.keeperControl:null;
   const distribution=P?.keeperDistribution?.id===player.id&&P.keeperDistribution.side===player.side?P.keeperDistribution:null;
   if(player.role==='GK'&&(!(kicking&&player.id===e.fromId&&player.side===e.fromSide)||distribution)){
    const active=!!(shot&&shot.keeperIntervention&&player.id===e.goalkeeperId&&player.side!==e.fromSide);
    const target=active?metres(shot.target||shot.result.fromPos):[...ball];if(active)target[1]=shot.contactHeight;
    const d=distribution?{...distribution,release:[...metres(distribution.release).slice(0,1),1.05,metres(distribution.release)[2]]}:null;
    const kp=keeperPose({root,source:active?A:(Math.hypot(ball[0]-root[0],ball[2]-root[2])<.1?add(root,[player.attackDirection,0,0]):ball),target,ball,p:active?shot.progress:p,active,save:active&&shot.keeperIntervention,catchBall:active&&shot.result.saveType==='CATCH',stance:moving?[left,rightFoot]:null,control,distribution:d,dive:shot?.dive,forwardHint:active?shot.keeperForward:null});
    ({yaw,leftFoot:left,rightFoot,pelvisHeight,lean,bodyRoll,pelvisRoll,leftHand,rightHand,keeperMotion}=kp);poseRoot=kp.position;arm=0;
   }
   if(shot?.blocker&&player.id===shot.result.toId&&player.side===shot.result.toSide){
    const contact=metres(shot.target||shot.result.fromPos),face=[A[0]-contact[0],0,A[2]-contact[2]],n=Math.hypot(face[0],face[2])||1;face[0]/=n;face[2]/=n;
    yaw=Math.atan2(face[0],face[2]);const foot=add(contact,mul(face,-.30));foot[1]=.16;
    const reach=p<.76?smooth((p-.65)/.11):1-smooth((p-.76)/.24);rightFoot=mix(rightFoot,foot,reach);
   }
   const headEvent=shot?.header?e:e?.headerShot;
   if(headEvent&&player.id===headEvent.fromId&&player.side===headEvent.fromSide){
    lean=0;bodyRoll=0;bodyTwist=0;
    // New forehead is .054m higher in the standing rig. Crouch for the existing
    // incoming ball contact; do not move the ball or alter event timing.
    pelvisHeight-=.054;
    const end=shot?metres(shot.target||shot.result.fromPos):metres(headEvent.presentationTarget||headEvent.toPos),origin=metres(headEvent.fromPos);
    yaw=Math.atan2(end[0]-origin[0],end[2]-origin[2]);
    // Standing header: incoming arc and a small neck preparation are derived,
    // not engine jump telemetry. At contact the forehead is in neutral pose.
    const q=shot?p/.19:clamp((p-.76)/.24);headPitch=shot?(p<.19?-.18*Math.sin(Math.PI*q):.18*Math.sin(Math.PI*clamp((p-.19)/.30))):-.10*Math.sin(Math.PI*q);
   }
   if(contest&&player.id===contest.defenderId&&player.side===contest.defenderSide){
    const targetYaw=Math.atan2(ball[0]-root[0],ball[2]-root[2]);yaw=angle(yaw,targetYaw,smooth((p-.5)/.15));
    const reach=p<.76?smooth((p-.65)/.11):1-smooth((p-(contest.attackerKeepsBall?.76:.91))/.09);
    const facing=[Math.sin(yaw),0,Math.cos(yaw)],contact=add(ball,mul(facing,-.30));contact[1]=.16;
    rightFoot=mix(rightFoot,contact,reach);pelvisHeight-=.10*reach;lean=.10*reach;
   }
   if(contest&&player.id===contest.attackerId&&p<.76){
    const pressure=smooth((p-.35)/.30),opponent=snapshot.players.find(x=>x.id===contest.defenderId&&x.side===contest.defenderSide),other=opponent?metres(opponent.displayPosition):root;
    const turn=Math.sin(Math.atan2(other[0]-root[0],other[2]-root[2])-yaw);
    bodyTwist=-.16*pressure*turn;pelvisHeight-=.025*pressure;lean+=.035*pressure;
   }
   if(contest&&player.id===contest.attackerId&&!contest.attackerKeepsBall&&p>=.76){lean=-.06*Math.sin(Math.PI*clamp((p-.76)/.24));}
   const shield=P?.holdMotion;
   if(shield&&player.id===e.fromId&&player.side===e.fromSide){
    const opponent=snapshot.players.find(x=>x.id===shield.defenderId),other=opponent?metres(opponent.displayPosition):add(root,[1,0,0]);
    const targetYaw=Math.atan2(root[0]-other[0],root[2]-other[2]);yaw=angle(yaw,targetYaw,smooth(p/.65));
    const facing=[Math.sin(yaw),0,Math.cos(yaw)],side=[facing[2],0,-facing[0]],weight=p<.76?smooth(p/.19):1-smooth((p-.76)/.24);
    const foot=add(ball,mul(facing,-.30));foot[1]=.16;rightFoot=mix(rightFoot,foot,weight);
    pelvisHeight-=.055*weight;lean=.10*weight;arm=0;
    const hands=add(root,mul(facing,.10));hands[1]=1.1;
    leftHand=add(hands,mul(side,-(.12+.25*weight)));rightHand=add(hands,mul(side,.12+.25*weight));
   }
   if(e?.type==='recovery'&&player.id===e.toId&&player.side===e.toSide){
    const gap=Math.hypot(root[0]-ball[0],root[2]-ball[2]);
    yaw=angle(yaw,Math.atan2(ball[0]-root[0],ball[2]-root[2]),smooth((p-.5)/.26));
    const facing=[Math.sin(yaw),0,Math.cos(yaw)],foot=add(ball,mul(facing,-.30));foot[1]=.16;
    if(gap<.6)rightFoot=mix(rightFoot,foot,p<.76?smooth((p-.65)/.11):1-smooth((p-.91)/.09));
    gaps.push({id:player.id,kind:'recovery-contact',metres:gap});
   }
   const touch=e?.type==='firstTouch'&&lastPass?.success===true&&lastPass.toId===e.toId;
   let receiveEventYaw=old?.receiveEventYaw,receiveEventId=old?.receiveEventId;
   const receiving=(!e?.headerShot&&!e?.looseResultId&&pass&&p>.19&&player.id===e.toId&&player.side===e.toSide)||(touch&&player.id===e.toId&&player.side===e.toSide);
   if(receiving){
    const target=pass?B:metres(e.toPos),d=pass?dir:metres(lastPass.toPos).map((x,i)=>x-metres(lastPass.fromPos)[i]);
    const n=Math.hypot(d[0],d[2])||1,incoming=[-d[0]/n,0,-d[2]/n],gap=Math.hypot(root[0]-target[0],root[2]-target[2]);
    if(receiveEventId!==e.eventId){receiveEventId=e.eventId;receiveEventYaw=yaw;}
    yaw=touch?Math.atan2(incoming[0],incoming[2]):angle(receiveEventYaw,Math.atan2(incoming[0],incoming[2]),smooth((p-.35)/.41));
    const foot=add(target,mul(incoming,-.30));foot[1]=.16-(touch?.025*Math.sin(Math.PI*p):0);
    // No invented receiver path or success: reach only from actual root, otherwise report mismatch.
    if(gap<.6)rightFoot=mix(rightFoot,foot,pass?(p<.76?smooth((p-.65)/.11):e.deliveryTiming?1-smooth((p-.76)/.24):1):1);
    gaps.push({id:player.id,kind:pass?(e.success?'receiver':'interceptor'):'firstTouch',metres:gap});
   }
   poses.push({id:player.id,side:player.side,position:poseRoot,yaw,leftFoot:left,rightFoot,pelvisHeight,armSwing:arm,lean,bodyRoll,pelvisRoll,bodyTwist,headPitch,leftHand,rightHand,keeperMotion,motionSource:'derived-from-common-display-roots-and-event-phase'});
   previous.set(key,{root,travel,yaw,direction,feet,gaitPhase:phase,receiveEventId,receiveEventYaw});
  }
  // Read the kick and arrival beside the live ball. Long passes do not fit
  // both distant endpoints at once: retain the local source early, then the
  // actual visible receiver on approach. Camera still uses this shared time.
  const owner=poses.find(x=>x.id===snapshot.ball.displayOwnerId&&x.side===snapshot.ball.displaySide);
  const gap=actor=>Math.hypot(actor.position[0]-ball[0],actor.position[2]-ball[2]);
  let target=[...ball];target[1]=0;
  if(owner&&gap(owner)<4)target=mix(target,owner.position,.25);
  const actionSide=owner?.side||e?.fromSide;
  const defender=poses.filter(x=>x.side!==actionSide&&gap(x)<4).sort((a,b)=>gap(a)-gap(b))[0];
  if(defender)target=mix(target,defender.position,.12);
  let desiredSpan=12,context=null,contextWeight=0;
  if(pass){
   const source=poses.find(x=>x.id===e.fromId&&x.side===e.fromSide),receiver=poses.find(x=>x.id===e.toId&&x.side===e.toSide);
   context=p<.48?source:p>.50?receiver:null;
   if(context){const d=gap(context),local=1-smooth((d-6)/3),phase=p<.48?1-smooth((p-.32)/.16):smooth((p-.50)/.15);contextWeight=local*phase;
    if(contextWeight>0){target=mix(target,context.position,.45*contextWeight);target[1]=0;desiredSpan=Math.min(18,12+d*.55*contextWeight);}
   }
  }
  if(shot&&p>.19&&p<.76){const goalDirection=e.toPos[0]>50?1:-1;target[0]+=goalDirection*.8;}
  const distance=Math.hypot(24,38),safeAspect=Number.isFinite(aspect)&&aspect>0?aspect:1;
  span=shot?12:lastSample?span+(desiredSpan-span)*(1-Math.exp(-dt*5)):desiredSpan;
  span=Math.min(span,shot?13:18,2*distance*Math.tan(22*Math.PI/180)*safeAspect);
  if(!focus)focus=[...target];else if(dt>0){
   if(lastSample){focus[0]+=ball[0]-lastSample.ball[0];focus[2]+=ball[2]-lastSample.ball[2];}
   focus=mix(focus,target,1-Math.exp(-dt*10));
  }
  // Constrain the actual oblique frustum, rather than just its centre. Keep
  // far touchline advertising/grey stands outside these close pass frames.
  const tangent=span/(2*distance*safeAspect),far=distance*distance*tangent/(24-38*tangent),near=distance*distance*tangent/(24+38*tangent),halfWidth=span*.5*(1+far*38/(distance*distance));
  focus[0]=clamp(focus[0],-57.3+halfWidth,57.3-halfWidth);
  focus[2]=clamp(focus[2],-35.8+far,36-near);
  const opacity=reset?(placed&&lastSample?.resetPlaced!==true?0:resetTime<.15?1-smooth(resetTime/.15):smooth((resetTime-.15)/.15)):1;
  if(lastSample&&time<lastSample.seconds)netImpact=null;
  if(shot&&e.outcome==='goal'){
   const source=metres(shot.sourcePoint||e.fromPos),target=metres(shot.target||e.toPos),dir=target[0]>0?1:-1;
   const contact=dir*(54.8-.14),fraction=(contact-source[0])/(target[0]-source[0]);
   const contactP=.19+.57*fraction;
   if(p>=contactP&&fraction>=0&&fraction<=1&&netImpact?.eventId!==e.eventId){netImpact={dir,eventId:e.eventId,point:[dir*54.8,.15,source[2]+(target[2]-source[2])*fraction],seconds:time-(p-contactP)*P.duration,source:'derived-goal-ball/net-radius intersection'};}
  }
  lastSignature=signature;lastSample={poses,ball,seconds:time,netImpact,ballPercent:percent(ball),camera:{focus:[...focus],span},opacity,resetPlaced:!!placed,flightProgress:u,gaps,eventId:e?.eventId??null,type:e?.type??'idle',pass,estimatedHeight:aerial,ownerId:snapshot.ball.displayOwnerId,side:snapshot.ball.displaySide};return lastSample;
 };
}
