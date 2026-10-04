import { metres,percent,clamp,smooth } from './match3d-pass-timeline.js';
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(v,k)=>v.map(x=>x*k),mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u);
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
// Pose state only. Every root and ball coordinate is read from the common MatchView frame.
export function createLivePoseSampler(){
 const previous=new Map();let lastTime=null,focus=null,span=14,lastPass=null,lastSample=null,lastSignature=null;
 return snapshot=>{
  const P=snapshot.presentation,e=P?.activeEvent,p=P?.progress||0,time=P?.seconds??0,signature=JSON.stringify([time,e?.eventId,e?.type,p,snapshot.matchSeconds,snapshot.ball.displayPosition]);
  if(signature===lastSignature)return lastSample;
  const dt=lastTime==null?0:Math.max(0,time-lastTime);
  if(lastTime!=null&&time<lastTime){previous.clear();focus=null;lastPass=null;}lastTime=time;
  const pass=e&&['pass','cross'].includes(e.type),ball=metres(snapshot.ball.displayPosition||snapshot.ball.engine.position);
  const shot=P?.shotMotion,kicking=pass||!!shot;
  const A=kicking||e?.type==='kickoff'?metres(e.fromPos):ball,B=pass?metres(e.toPos):shot?metres(shot.result.fromPos):ball,len=Math.hypot(B[0]-A[0],B[2]-A[2]),u=clamp((p-.19)/.57),dir=len?[(B[0]-A[0])/len,0,(B[2]-A[2])/len]:[0,0,1],right=[dir[2],0,-dir[0]];
  const aerial=pass&&e.travelType==='aerial',tracking=pass&&(aerial||len>18);ball[1]=.15+(aerial?Math.sin(Math.PI*u)*clamp(len/12,1.2,3.8):0);
  if(shot)ball[1]=shot.height;
  if(pass)lastPass=e;
  const poses=[],gaps=[];
  for(const player of snapshot.players){
   const key=`${player.side}:${player.id}`,root=metres(player.displayPosition||player.enginePosition),old=previous.get(key);
   const move=old?root.map((x,i)=>x-old.root[i]):[0,0,0],distance=Math.hypot(move[0],move[2]),travel=(old?.travel||0)+distance;
   const moving=dt>0&&distance>1e-6,direction=moving?[move[0]/distance,0,move[2]/distance]:old?.direction||[player.attackDirection,0,0];
   let yaw=old?.yaw??Math.atan2(direction[0],direction[2]);
   if(moving)yaw=angle(yaw,Math.atan2(direction[0],direction[2]),1-Math.exp(-dt*12));
   const forward=[Math.sin(yaw),0,Math.cos(yaw)],lateral=[forward[2],0,-forward[0]];
   const feet=[-1,1].map((sign,i)=>{
    const q=travel/1.25+i*.5,cycle=Math.floor(q),phase=q-cycle,plant=phase<.5;
    let point=old?.feet[i]?.point;
    if(!point||old.feet[i].cycle!==cycle||!old.feet[i].plant&&plant)point=add(add(root,mul(lateral,sign*.102)),mul(forward,.27));
    if(!plant&&moving){point=add(add(root,mul(lateral,sign*.102)),mul(forward,(smooth((phase-.5)*2)-.5)*.54));point[1]=.09+Math.sin(Math.PI*(phase-.5)*2)*.13;}
    else if(plant)point=[point[0],.09,point[2]];
    return {point,cycle,plant};
   });
   let left=feet[0].point,rightFoot=feet[1].point,arm=moving?Math.sin(travel/1.25*Math.PI*2)*.24:0;
   if((kicking||e?.type==='kickoff')&&player.id===e.fromId&&player.side===e.fromSide){
    yaw=angle(yaw,Math.atan2(dir[0],dir[2]),smooth(p/.19));
    const contact=add(A,mul(dir,-.30));contact[1]=.16;
    const neutral=add(root,mul(right,.102));neutral[1]=.09;
    if(p<=.19){const prep=smooth(p/.19);rightFoot=mix(neutral,contact,prep);rightFoot=add(rightFoot,mul(dir,-.28*Math.sin(Math.PI*prep)));rightFoot[1]+=.10*Math.sin(Math.PI*prep);}
    else{const follow=clamp((p-.19)/.81);rightFoot=mix(contact,neutral,smooth(follow));rightFoot=add(rightFoot,mul(dir,.25*Math.sin(Math.PI*follow)));rightFoot[1]+=.12*Math.sin(Math.PI*follow);}
    gaps.push({id:player.id,kind:'source-root-to-contact',metres:Math.hypot(root[0]-A[0],root[2]-A[2])});
   }
   const carry=P?.carryMotion;
   if(carry&&player.id===e.fromId&&player.side===e.fromSide){
    // Reach only near a derived touch; intervening frames keep the distance-based gait.
    const phase=carry.touchPhase,weight=1-smooth(Math.min(phase,1-phase)/.12);
    const pathA=metres(e.fromPos),pathB=metres(e.toPos),n=Math.hypot(pathB[0]-pathA[0],pathB[2]-pathA[2])||1;
    const touchDir=[(pathB[0]-pathA[0])/n,0,(pathB[2]-pathA[2])/n];
    const contact=add(ball,mul(touchDir,-.30));contact[1]=.16;
    rightFoot=mix(rightFoot,contact,weight);
    gaps.push({id:player.id,kind:'derived-carry-touch',metres:Math.hypot(root[0]-ball[0],root[2]-ball[2]),phase,weight});
   }
   const contest=P?.contestMotion;
   let pelvisHeight=.935,lean=0,leftHand=null,rightHand=null;
   if(shot&&player.id===e.goalkeeperId){
    yaw=Math.atan2(A[0]-root[0],A[2]-root[2]);
    const ready=[Math.sin(yaw),0,Math.cos(yaw)],reach=shot.progress<.19?0:smooth((shot.progress-.19)/.57);
    left=add(root,[-.16,.09,0]);rightFoot=add(root,[.16,.09,0]);
    pelvisHeight=.90;lean=.12;
    const neutral=add(root,mul(ready,.30));neutral[1]=1.05;
    const handTarget=shot.result.type==='save'?[...ball]:add(root,mul(ready,.48));handTarget[1]=shot.result.type==='save'?Math.max(.7,ball[1]):1.1;
    leftHand=mix(add(neutral,[0,0,-.08]),add(handTarget,[0,0,-.06]),reach);
    rightHand=mix(add(neutral,[0,0,.08]),add(handTarget,[0,0,.06]),reach);
   }
   if(contest&&player.id===contest.defenderId&&player.side===contest.defenderSide){
    const targetYaw=Math.atan2(ball[0]-root[0],ball[2]-root[2]);yaw=angle(yaw,targetYaw,smooth((p-.5)/.15));
    const reach=p<.76?smooth((p-.65)/.11):1-smooth((p-(contest.attackerKeepsBall?.76:.91))/.09);
    const facing=[Math.sin(yaw),0,Math.cos(yaw)],contact=add(ball,mul(facing,-.30));contact[1]=.16;
    rightFoot=mix(rightFoot,contact,reach);pelvisHeight-=.10*reach;lean=.10*reach;
   }
   if(contest&&player.id===contest.attackerId&&!contest.attackerKeepsBall&&p>=.76){lean=-.06*Math.sin(Math.PI*clamp((p-.76)/.24));}
   const touch=e?.type==='firstTouch'&&lastPass?.success===true&&lastPass.toId===e.toId;
   let receiveEventYaw=old?.receiveEventYaw,receiveEventId=old?.receiveEventId;
   const receiving=(pass&&p>.19&&player.id===e.toId&&player.side===e.toSide)||(touch&&player.id===e.toId&&player.side===e.toSide);
   if(receiving){
    const target=pass?B:metres(e.toPos),d=pass?dir:metres(lastPass.toPos).map((x,i)=>x-metres(lastPass.fromPos)[i]);
    const n=Math.hypot(d[0],d[2])||1,incoming=[-d[0]/n,0,-d[2]/n],gap=Math.hypot(root[0]-target[0],root[2]-target[2]);
    if(receiveEventId!==e.eventId){receiveEventId=e.eventId;receiveEventYaw=yaw;}
    yaw=touch?Math.atan2(incoming[0],incoming[2]):angle(receiveEventYaw,Math.atan2(incoming[0],incoming[2]),smooth((p-.35)/.41));
    const foot=add(target,mul(incoming,-.30));foot[1]=.16-(touch?.025*Math.sin(Math.PI*p):0);
    // No invented receiver path or success: reach only from actual root, otherwise report mismatch.
    if(gap<.6)rightFoot=mix(rightFoot,foot,pass?smooth((p-.65)/.11):1);
    gaps.push({id:player.id,kind:pass?(e.success?'receiver':'interceptor'):'firstTouch',metres:gap});
   }
   poses.push({id:player.id,side:player.side,position:root,yaw,leftFoot:left,rightFoot,pelvisHeight,armSwing:arm,lean,leftHand,rightHand});
   previous.set(key,{root,travel,yaw,direction,feet,receiveEventId,receiveEventYaw});
  }
  let target=pass?(tracking?add(ball,mul(dir,len*.03*Math.sin(Math.PI*u))):mix(A,B,.5)):[...ball];target[1]=0;
  let desired=pass&&!tracking?Math.max(12,len+4):12+3*Math.sin(Math.PI*u)**2;
  // Existing side-camera framing: do not lose the approaching real defender off screen.
  const contest=P?.contestMotion,defender=contest&&poses.find(p=>p.id===contest.defenderId&&p.side===contest.defenderSide);
  if(defender){target=mix(ball,defender.position,.5);target[1]=0;desired=Math.max(12,Math.hypot(ball[0]-defender.position[0],ball[2]-defender.position[2])+4);}
  if(shot){
   // Same outcome-blind anticipation for every shot. Keep source legible, then
   // reveal the goal while the ball is still travelling; no whole-path fit.
   const goal=metres([e.toPos[0]>50?100:0,50]),anticipation=smooth(u/.28);
   const remaining=Math.abs(goal[0]-ball[0]),lead=Math.min(8,remaining*.5)*anticipation;
   target=[ball[0]+Math.sign(goal[0]-ball[0])*lead,0,ball[2]+(goal[2]-ball[2])*.5*anticipation];
   desired=14+12*smooth(u/.30);
  }
  if(!focus){focus=[...target];span=desired;}
  else if(dt>0){focus=mix(focus,target,1-Math.exp(-dt*20));span+= (desired-span)*(1-Math.exp(-dt*4));}
  lastSignature=signature;lastSample={poses,ball,ballPercent:percent(ball),camera:{focus:[...focus],span},flightProgress:u,gaps,eventId:e?.eventId??null,type:e?.type??'idle',pass,estimatedHeight:aerial,ownerId:snapshot.ball.displayOwnerId,side:snapshot.ball.displaySide};return lastSample;
 };
}
