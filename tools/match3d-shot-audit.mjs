import fs from 'node:fs';import {pathToFileURL} from 'node:url';
import {setup} from './match3d-minute-audit.mjs';import {createLivePoseSampler} from '../dist/match3d-live-view.js';import {poseFootballer} from '../dist/match3d-football-pose.js';import * as T from '../dist/vendor/three/three.module.min.js';import {JOINTS} from '../dist/match3d-player.js';
const dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
function model(){const root=new T.Group(),bones=JOINTS.map(([name,,x,y,z])=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);return b;});JOINTS.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.userData.bones=Object.fromEntries(bones.map(b=>[b.name,b]));return root;}
export function audit(){const h=setup(),sampler=createLivePoseSampler(),m=model(),rows=new Map();h.run('M.rand=R(8800)');let wall=0,old=null;
 for(let i=0;i<160000;i++){
  const before=h.run('MatchView.read()'),e=before.presentation.activeEvent,p=before.presentation.progress;let dt=.02;
  if(e?.shotResult){const boundary=[.19,.76,.999999].find(x=>x>p+1e-8);if(boundary)dt=Math.min(dt,(boundary-p)*before.presentation.duration*4+1e-10);}
  wall+=dt;h.run(`ManagerStoryLive3D.step(${dt},${wall*1000})`);const s=h.run('MatchView.read()'),P=s.presentation,f=P.shotMotion,poses=sampler(s);
  if(f){const e=P.activeEvent;let r=rows.get(e.eventId);if(!r){r={eventId:e.eventId,resultId:e.shotResult.eventId,outcome:e.outcome,saveType:e.shotResult.saveType,duration:P.duration*4,preContactBallMovement:0,earlyOwnerChanges:0,earlyScoreChanges:0,peakKeeperSpeed:0,maxBallStep:0,phases:[]};rows.set(e.eventId,r);}
   const keeper=s.players.find(p=>p.id===e.goalkeeperId).displayPosition;
   if(P.progress<.19-1e-7){r.preContactBallMovement=Math.max(r.preContactBallMovement,dist(s.ball.displayPosition,e.fromPos));if(s.ball.displayOwnerId!==e.fromId)r.earlyOwnerChanges++;}
   if(e.outcome==='goal'&&!f.goalCrossed&&JSON.stringify(P.eventScore)!==JSON.stringify([e.homeGoals,e.awayGoals]))r.earlyScoreChanges++;
   if(old?.id===e.eventId){r.peakKeeperSpeed=Math.max(r.peakKeeperSpeed,dist(keeper,old.keeper)/dt);r.maxBallStep=Math.max(r.maxBallStep,dist(s.ball.displayPosition,old.ball));}
   for(const threshold of [.19,.76,.999999])if(Math.abs(P.progress-threshold)<1e-7&&!r.phases.some(x=>x.threshold===threshold)){
    const shooter=poses.poses.find(p=>p.id===e.fromId),k=poses.poses.find(p=>p.id===e.goalkeeperId),toe=poseFootballer(m,shooter).rightToe.clone(),hands=poseFootballer(m,k);
    r.phases.push({threshold,ball:s.ball.displayPosition,height:poses.ball[1],toeBall:toe.distanceTo(new T.Vector3(...poses.ball)),handBall:Math.min(hands.leftHand.distanceTo(new T.Vector3(...poses.ball)),hands.rightHand.distanceTo(new T.Vector3(...poses.ball))),score:P.eventScore,owner:s.ball.displayOwnerId,goalCrossed:f.goalCrossed,keeper});
   }
   old={id:e.eventId,ball:s.ball.displayPosition,keeper};
  }else {if(old&&rows.has(old.id)){rows.get(old.id).endBoundaryStep=dist(old.ball,s.ball.displayPosition);rows.get(old.id).endBoundarySourceError=P.activeEvent?.type==='looseBall'?dist(old.ball,h.run('[...pitchV73.eventStartBall]')):dist(old.ball,s.ball.displayPosition);}old=null;}
  if(h.run('M.min')>=26)break;
 }
 return {seed:8800,tempo:4,speed:1,wall,minute:h.run('M.min'),rows:[...rows.values()],events:h.run('structuredClone(M.events)'),stats:h.run('structuredClone(M.stats)'),score:h.run('[M.hg,M.ag]'),rng:h.run('M.rand.state')};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const a=audit();fs.writeFileSync('docs/qa-stage3f/measurements.json',JSON.stringify(a,null,2));console.log(JSON.stringify({...a,events:undefined,stats:undefined},null,2));}
