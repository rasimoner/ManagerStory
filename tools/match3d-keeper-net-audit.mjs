import fs from 'node:fs';
import {setup} from './match3d-minute-audit.mjs';
import {createLivePoseSampler} from '../dist/match3d-live-view.js';
import {createFootballer} from '../dist/match3d-player.js';
import {poseFootballer} from '../dist/match3d-football-pose.js';
import {netDisplacement} from '../dist/match3d-net.js';
import * as T from '../dist/vendor/three/three.module.min.js';
global.document={createElement:()=>({width:256,height:256,getContext:()=>({fillText(){}})})};
export function audit(){
 const examples=[];
 for(const seed of [8800,1]){
  const h=setup();h.run(`M.rand=R(${seed});ManagerStoryLive3D.setTempo(1);`);
  const snapshots=h.run(`(()=>{const frames=[];for(let i=0;i<22000;i++){
   const e=pitchV73.active,p=pitchV73.progress;let dt=.08;
   const boundary=e?.shotResult?[.19,.38,.60,.76,.90,.9999].find(x=>x>p+1e-8):null;
   if(boundary)dt=Math.min(dt,(boundary-p)*pitchV73.activeDuration+1e-10);
   ManagerStoryLive3D.step(dt,0);const s=MatchView.read();
   if(s.presentation.shotMotion&&[.19,.38,.60,.76,.90,.9999].some(x=>Math.abs(s.presentation.progress-x)<1e-7))frames.push(s);
   if(M.min>=30||M.reason==='injury')break;
  }return frames;})()`);
  const sampler=createLivePoseSampler();
  for(const s of snapshots){const e=s.presentation.activeEvent,shot=s.presentation.shotMotion,v=sampler(s),k=v.poses.find(x=>x.id===e.goalkeeperId&&x.side!==e.fromSide);if(!k)continue;
   const m=createFootballer({id:k.id,side:k.side,number:1,kit:s.teams.home,goalkeeper:true}),c=poseFootballer(m,k),b=m.userData.bones;
   const limbs=['left','right'].map(side=>{const shoulder=b[side+'Shoulder'].getWorldPosition(new T.Vector3()),elbow=b[side+'Elbow'].getWorldPosition(new T.Vector3()),hand=b[side+'Hand'].getWorldPosition(new T.Vector3());const forward=new T.Vector3(Math.sin(k.yaw),0,Math.cos(k.yaw));return {upper:shoulder.distanceTo(elbow),lower:elbow.distanceTo(hand),handForward:hand.clone().sub(shoulder).dot(forward),gap:hand.distanceTo(new T.Vector3(...v.ball))};});
   const impact=v.netImpact;examples.push({seed,id:e.eventId,resultId:shot.result.eventId,outcome:e.outcome,saveType:shot.result.saveType,goalDirection:e.toPos[0]>50?1:-1,p:s.presentation.progress,height:v.ball[1],kind:k.keeperMotion?.kind,phase:k.keeperMotion?.phase,body:k.position,ball:v.ball,limbs,netImpact:impact?.eventId===e.eventId?impact:null,netDeflection:impact?.eventId===e.eventId?netDisplacement(impact.point,impact,v.seconds+.07,impact.dir):0,contactGap:Math.min(c.leftHand.distanceTo(new T.Vector3(...v.ball)),c.rightHand.distanceTo(new T.Vector3(...v.ball)))});
  }
 }
 return {environment:'CPU approved rig/world coordinates; not WebGL or iPhone proof',missing:['engine physical contact height','dive/landing telemetry','measured keeper uniform data; contrast fallback used','GPU/mobile motion approval'],examples};
}
if(process.argv[1]?.endsWith('match3d-keeper-net-audit.mjs')){const result=audit();fs.mkdirSync('docs/qa-keeper-net',{recursive:true});fs.writeFileSync('docs/qa-keeper-net/measurements.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.examples.filter(e=>Math.abs(e.p-.76)<1e-7).map(e=>({seed:e.seed,id:e.id,result:e.resultId,outcome:e.outcome,save:e.saveType,dir:e.goalDirection,gap:e.contactGap,height:e.height,limbs:e.limbs})),null,2));}
