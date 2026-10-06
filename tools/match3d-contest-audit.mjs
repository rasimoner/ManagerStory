import fs from 'node:fs';import {pathToFileURL} from 'node:url';
import {setup} from './match3d-minute-audit.mjs';
import {createLivePoseSampler} from '../dist/match3d-live-view.js';
import * as T from '../dist/vendor/three/three.module.min.js';import {JOINTS} from '../dist/match3d-player.js';import {poseFootballer} from '../dist/match3d-football-pose.js';
const phaseToClock=(P,p)=>{const t=P.contestMotion?.timing;if(!t)return p;for(let i=1;i<t.poseBoundaries.length;i++)if(p<=t.poseBoundaries[i])return t.boundaries[i-1]+(t.boundaries[i]-t.boundaries[i-1])*(p-t.poseBoundaries[i-1])/(t.poseBoundaries[i]-t.poseBoundaries[i-1]);return 1;};
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
function skeleton(){const root=new T.Group(),bones=JOINTS.map(([name,,x,y,z])=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);return b;});JOINTS.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.userData.bones=Object.fromEntries(bones.map(b=>[b.name,b]));return root;}
export function audit(){const h=setup(),sample=createLivePoseSampler(),model=skeleton(),rows=new Map();h.run('M.rand=R(1)');let wall=0,old=null,lastContest=null;
 for(let i=0;i<30000;i++){
  const before=h.run('MatchView.read()'),e=before.presentation.activeEvent,p=before.presentation.progress;let dt=.01;
  if(e?.contest){const boundary=[.65,.76,.91,.999999].find(x=>x>p+1e-8);if(boundary)dt=Math.min(dt,(phaseToClock(before.presentation,boundary)-(before.presentation.clockProgress??p))*before.presentation.duration*4+1e-10);}
  wall+=dt;h.run(`ManagerStoryLive3D.step(${dt},${wall*1000})`);const s=h.run('MatchView.read()'),P=s.presentation,c=P.contestMotion?.independent?null:P.contestMotion,poses=sample(s),root=id=>s.players.find(p=>p.id===id).displayPosition;
  if(c){let r=rows.get(P.activeEvent.eventId);if(!r){r={eventId:P.activeEvent.eventId,tackleId:c.tackle.eventId,keepsBall:c.attackerKeepsBall,defenderStart:c.defenderStart,defenderEnd:c.defenderEnd,startWall:wall,duration:P.duration*4,minClearance:Infinity,maxRootSpeed:0,maxBallStep:0,earlyOwnerChanges:0,maxWinnerBallGapAfterControl:0,phases:[]};rows.set(r.eventId,r);}
   r.minClearance=Math.min(r.minClearance,distance(root(c.attackerId),root(c.defenderId)));
   if(old?.eventId===r.eventId){r.maxRootSpeed=Math.max(r.maxRootSpeed,distance(root(c.attackerId),old.attacker)/dt,distance(root(c.defenderId),old.defender)/dt);r.maxBallStep=Math.max(r.maxBallStep,distance(s.ball.displayPosition,old.ball));}
   if(P.progress<.76-1e-8&&s.ball.displayOwnerId!==c.attackerId)r.earlyOwnerChanges++;
   if(P.progress>=.91)r.maxWinnerBallGapAfterControl=Math.max(r.maxWinnerBallGapAfterControl,distance(root(s.ball.displayOwnerId),s.ball.displayPosition));
   for(const threshold of [.65,.76,.91,.999999])if(Math.abs(P.progress-threshold)<1e-7&&!r.phases.some(x=>x.threshold===threshold)){
    const pose=poses.poses.find(p=>p.id===c.defenderId),foot=poseFootballer(model,pose),toe=foot.rightToe.toArray();
    r.phases.push({threshold,wall,progress:P.progress,owner:s.ball.displayOwnerId,attacker:root(c.attackerId),defender:root(c.defenderId),ball:s.ball.displayPosition,clearance:distance(root(c.attackerId),root(c.defenderId)),toeBallMetres:Math.hypot(...toe.map((x,i)=>x-poses.ball[i]))});
   }
   lastContest={eventId:r.eventId,attackerId:c.attackerId,defenderId:c.defenderId};old={eventId:r.eventId,attacker:root(c.attackerId),defender:root(c.defenderId),ball:s.ball.displayPosition};
  }else {if(lastContest){const row=rows.get(lastContest.eventId);row.minFollowingClearance=Math.min(row.minFollowingClearance??Infinity,distance(root(lastContest.attackerId),root(lastContest.defenderId)));if(s.ball.displayOwnerId===lastContest.defenderId)row.maxFollowingWinnerBallGap=Math.max(row.maxFollowingWinnerBallGap||0,distance(root(lastContest.defenderId),s.ball.displayPosition));}if(old&&rows.has(old.eventId)){const r=rows.get(old.eventId);r.endBoundaryBallStep=distance(old.ball,s.ball.displayPosition);}old=null;}
  if(h.run('M.min')>=6)break;
 }
 return {seed:1,tempo:4,speed:1,minute:h.run('M.min'),wall,rows:[...rows.values()],events:h.run('structuredClone(M.events)'),stats:h.run('structuredClone(M.stats)'),rngState:h.run('M.rand.state')};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const a=audit();fs.writeFileSync('docs/qa-stage3e-contest/measurements.json',JSON.stringify(a,null,2));console.log(JSON.stringify({...a,events:undefined,stats:undefined},null,2));}
