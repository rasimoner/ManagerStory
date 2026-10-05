// Deterministic presentation of a recorded event. No engine, RNG or possession decisions.
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,k)=>a.map(x=>x*k),mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u);
export const metres=xy=>[(xy[0]/100-.5)*105,0,(xy[1]/100-.5)*68];
export const percent=p=>[(p[0]/105+.5)*100,(p[2]/68+.5)*100];
const yaw=v=>Math.atan2(v[0],v[2]);
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
function flight(u){ // Same arrival time and endpoint, continuous velocity, gentle final braking.
 if(u<.7)return u*1.15;
 const t=(u-.7)/.3;return (2*t*t*t-3*t*t+1)*.805+(t*t*t-2*t*t+t)*.345+(-2*t*t*t+3*t*t);
}
function footOnPath(start,dir,side,distance,offset,sign){
 const stride=1.2,q=distance/stride+offset,cycle=Math.floor(q),phase=q-cycle;
 const planted=phase<.5,u=clamp((phase-.5)/.5),advance=(cycle-offset+.25+(planted?0:smooth(u)))*stride;
 const point=add(add(start,mul(dir,advance)),mul(side,sign*.102));point[1]=.09+(planted?0:Math.sin(Math.PI*u)*.12);
 return {point,planted,key:`${sign}:${cycle}`,phase};
}
export function samplePass(record,time){
 const e=record.event,A=metres(e.fromPos),B=metres(e.toPos),delta=B.map((x,i)=>x-A[i]),length=Math.hypot(delta[0],delta[2]);
 const dir=[delta[0]/(length||1),0,delta[2]/(length||1)],right=[dir[2],0,-dir[0]],D=record.duration,C=record.contactAt,R=record.arrivalAt;
 const success=e.success===true&&record.firstTouch?.toId===e.toId;
 const u=clamp((time-C)/(R-C)),p=smooth((time+.35)/(.35+C));
 const f=flight(u),aerial=e.travelType==='aerial'||['long','cross','lofted'].includes(e.passKind);
 const ball=mix(A,B,f);ball[1]=.15+(aerial?Math.sin(Math.PI*u)*clamp(length/12,1.2,3.8):0);
 const sourceRoot=add(add(A,mul(dir,-.32)),mul(right,-.102));
 const sourceAnkle=add(A,mul(dir,-.30));sourceAnkle[1]=.16;
 const neutral=add(sourceRoot,mul(right,.102));neutral[1]=.09;
 let kick;
 if(time<=C){kick=mix(neutral,sourceAnkle,p);kick=add(kick,mul(dir,-.32*Math.sin(Math.PI*p)));kick[1]+=.10*Math.sin(Math.PI*p);}
 else{const q=clamp((time-C)/Math.max(.001,D-C));kick=mix(sourceAnkle,neutral,smooth(q));kick=add(kick,mul(dir,.30*Math.sin(Math.PI*q)));kick[1]+=.13*Math.sin(Math.PI*q);}
 const support=add(sourceRoot,mul(right,-.102));support[1]=.09;
 const targetRoot=add(add(B,mul(dir,.32)),mul(right,.102)),runDir=mul(right,-1),runSide=[runDir[2],0,-runDir[0]],runLength=aerial?Math.max(.7,R*2.6):.7,start=add(targetRoot,mul(runDir,-runLength));
 const run=smooth(time/R),distance=runLength*run,receiverRoot=mix(start,targetRoot,run),turn=smooth((time/R-.55)/.45);
 const left=footOnPath(start,runDir,runSide,distance,0,-1),rfoot=footOnPath(start,runDir,runSide,distance,.5,1);
 const settle=smooth((time/R-.68)/.32),leftFinal=add(targetRoot,mul(right,.102));leftFinal[1]=.09;
 const receiveAnkle=add(B,mul(dir,.30));receiveAnkle[1]=success?.16:.09;
 const absorb=success?smooth((time-R)/Math.max(.001,record.endAt-R)):0;
 // The recorded firstTouch endpoint is stationary; deceleration is completed before arrival.
 const receiverRight=mix(rfoot.point,receiveAnkle,settle);receiverRight[1]-=success?.025*Math.sin(Math.PI*absorb):0;
 const receiverLeft=mix(left.point,leftFinal,settle);
 const phase=time<C?'HAZIRLIK':time<R?'PAS':!success?(e.success===false?'KESİLEN PAS':'KONTROL VERİSİ YOK'):time<D?'KARŞILAMA':time<record.endAt?'KONTROL':'TAMAM';
 const focus=aerial?mix(A,B,smooth(u)):mix(A,B,.5);
 return {time,eventId:e.eventId,phase,ball,ballPercent:percent(ball),flightProgress:u,resultOwnerId:e.toId,resultOwnerSide:e.toSide,displayOwnerId:time<C?e.fromId:time<D?null:e.toId,displayOwnerSide:time<C?e.fromSide:time<D?'none':e.toSide,
  controlSuccessful:success&&time>=R,source:{id:e.fromId,side:e.fromSide,position:sourceRoot,pelvisHeight:.935,yaw:yaw(dir)-.25*(1-p),leftFoot:support,rightFoot:kick,armSwing:-.23*Math.sin(Math.PI*p),lean:.08*Math.sin(Math.PI*p)},
  receiver:{id:e.toId,side:e.toSide,position:receiverRoot,pelvisHeight:.865+.075*settle,yaw:angle(yaw(runDir),yaw(mul(dir,-1)),turn),leftFoot:receiverLeft,rightFoot:receiverRight,armSwing:Math.sin(distance/1.2*Math.PI*2)*.25*(1-settle),lean:0,
   planted:[left.planted&&settle===0,rfoot.planted&&settle===0],plantKeys:[left.key,rfoot.key]},
  camera:{focus,span:aerial?12+Math.sin(Math.PI*u)**2*3:Math.max(11,length+3)},estimatedHeight:aerial,sourceToeTarget:add(sourceAnkle,mul(dir,.17)),arrivalAt:R,contactAt:C,endAt:record.endAt};
}
export function createReplayClock(start=-.35){
 let time=start,speed=1,paused=true;
 return {get time(){return time},get speed(){return speed},get paused(){return paused},setSpeed(x){if(![.5,1,2].includes(x))throw Error('Unsupported playback speed');speed=x},pause(){paused=true},play(){paused=false},seek(x){time=x},advance(dt){if(!paused)time+=Math.max(0,dt)*speed;return time}};
}
