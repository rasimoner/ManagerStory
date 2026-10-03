// Reproducible real-engine audit; no renderer, RNG substitution or new match loop in the product.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import * as T from '../dist/vendor/three/three.module.min.js';
import {JOINTS} from '../dist/match3d-player.js';
import {poseFootballer} from '../dist/match3d-football-pose.js';
import {createLivePoseSampler} from '../dist/match3d-live-view.js';
const require=createRequire(import.meta.url),{harness}=require('../tests/engine-harness.cjs');
const dist=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
export function setup(baseline=false){
 const h=harness(),reference=baseline?JSON.parse(fs.readFileSync(new URL('./fixtures/stage3b-presentation.json',import.meta.url),'utf8')):null;
 if(baseline)h.run(reference.enqueue);
 h.run(baseline?reference.clock:fs.readFileSync('dist/match3d-live-clock.js','utf8'));
 h.run(fs.readFileSync('dist/match-view-adapter.js','utf8'));h.run('S=fresh();init();ManagerStoryLive3D.enable();startMatch();resumeLive()');return h;
}
function skeleton(){const root=new T.Group(),bones=JOINTS.map(([name,,x,y,z])=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);return b;});JOINTS.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.userData.bones=Object.fromEntries(bones.map(b=>[b.name,b]));return root;}
export function audit(baseline=false){
 const h=setup(baseline),sample=createLivePoseSampler(),model=skeleton(),passes=[],transitions=[];let wall=0,previous=null,activeRow=null,maxStep=0;
 for(let guard=0;guard<30000&&passes.filter(p=>p.end).length<6;guard++){
  let dt=.01;const before=h.run('MatchView.read()'),e=before.presentation.activeEvent,p=before.presentation.progress;
  if(e&&['pass','cross'].includes(e.type)){const boundary=[.19,.76,1].find(x=>x>p+1e-9);if(boundary)dt=Math.min(dt,(boundary-p)*before.presentation.duration*4);}
  wall+=dt;h.run(`ManagerStoryLive3D.step(${dt},${wall*1000})`);const s=h.run('MatchView.read()'),event=s.presentation.activeEvent,pose=sample(s);
  const frame={wall,canonical:s.presentation.seconds,motorSeconds:s.matchSeconds,eventId:event?.eventId,type:event?.type,progress:s.presentation.progress,ball:s.ball.displayPosition,owner:s.ball.displayOwnerId,positions:Object.fromEntries(s.players.map(p=>[p.id,p.displayPosition||p.enginePosition]))};
  if(previous){frame.ballStepMetres=dist(previous.ball,frame.ball);maxStep=Math.max(maxStep,frame.ballStepMetres);}
  if(event?.type==='enginePositionGap'&&previous?.type!=='enginePositionGap')transitions.push({wall,event:structuredClone(event),previous});
  if(event&&['pass','cross'].includes(event.type)){
   if(activeRow?.eventId!==event.eventId){activeRow={eventId:event.eventId,success:event.success,event:structuredClone(event),start:frame,previous,rawRootGap:dist(frame.positions[event.fromId],event.fromPos),boundaryBallStepMetres:frame.ballStepMetres,maxPreparationRootSpeed:0,rawTargetGap:dist(event.enginePositions[event.toId]||event.toPos,event.toPos),phases:[]};passes.push(activeRow);}
   if(previous?.eventId===event.eventId&&frame.progress<=.19+1e-8)activeRow.maxPreparationRootSpeed=Math.max(activeRow.maxPreparationRootSpeed,dist(previous.positions[event.fromId],frame.positions[event.fromId])/dt);
   for(const [name,boundary] of [['contact',.19],['arrival',.76]])if(Math.abs(frame.progress-boundary)<1e-8&&!activeRow[name]){
    const who=name==='contact'?event.fromId:event.toId,side=name==='contact'?event.fromSide:event.toSide,p=pose.poses.find(x=>x.id===who&&x.side===side);
    const toe=p?poseFootballer(model,p).rightToe.distanceTo(new T.Vector3(...pose.ball)):null;
    activeRow[name]={...frame,engineBall:s.ball.engine,engineRoot:s.players.find(p=>p.id===who)?.enginePosition,adapterRoot:frame.positions[who],viewRoot:p?.position,rootGapMetres:dist(frame.positions[who]||frame.ball,frame.ball),toeBallMetres:toe};
   }
   if(frame.progress<.76&&frame.progress>=.19&&frame.owner!=null)throw Error('Premature ownership '+event.eventId);
  }
  if(activeRow&&!activeRow.end&&previous?.eventId===activeRow.eventId&&frame.eventId!==activeRow.eventId)activeRow.end={...frame,previous};
  previous=frame;
 }
 return {seed:h.run('8800+S.fixture*97'),fixture:h.run('S.fixture'),tempo:4,speed:1,baseline,passes,transitions,maxSampledBallStepMetres:maxStep,events:h.run('structuredClone(M.events)'),tolerances:{boundaryContinuityMetres:.02,rootAtContactArrivalMetres:.02,toeBallMetres:.22,derivedMovementMaxMetresPerSecondAt1xTempo4:6}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const out=process.argv[2]||'docs/qa-stage3c';fs.mkdirSync(out,{recursive:true});const before=audit(true),after=audit(false);fs.writeFileSync(out+'/continuity.json',JSON.stringify({before,after},null,2));console.log(JSON.stringify([before,after].map(a=>({baseline:a.baseline,seed:a.seed,passes:a.passes.map(p=>({id:p.eventId,rootStart:p.rawRootGap,contact:p.contact?.rootGapMetres,toe:p.contact?.toeBallMetres,arrival:p.arrival?.rootGapMetres,receiverToe:p.arrival?.toeBallMetres,start:p.start.wall,end:p.end?.wall})),gap11:a.transitions.find(t=>t.event.toPos?.[0]===a.passes.find(p=>p.eventId===11)?.event.fromPos[0])?.event})),null,2));}
