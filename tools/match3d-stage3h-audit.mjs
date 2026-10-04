import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {setup} from './match3d-minute-audit.mjs';import {createLivePoseSampler} from '../dist/match3d-live-view.js';import {poseFootballer} from '../dist/match3d-football-pose.js';import * as T from '../dist/vendor/three/three.module.min.js';import {JOINTS} from '../dist/match3d-player.js';
const require=createRequire(import.meta.url),{harness}=require('../tests/engine-harness.cjs');
export const examples=[{kind:'post',seed:2,id:19,start:19,end:23},{kind:'block',seed:2,id:62,start:62,end:66},{kind:'header',seed:10,id:41,start:40,end:45}];
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
function model(){const root=new T.Group(),bones=JOINTS.map(([name,,x,y,z])=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);return b;});JOINTS.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.userData.bones=Object.fromEntries(bones.map(b=>[b.name,b]));return root;}
export function seek(h,x){h.run(`M.rand=R(${x.seed});window.qaWall=0;let guard=0;while(guard++<25000){qaWall+=.1;ManagerStoryLive3D.step(.1,qaWall*1000);if(pitchV73.active?.eventId===${x.start}&&pitchV73.progress<.19)break;}if(guard>=25000)throw Error('Missing real example');`);}
export function audit(x){const h=setup();seek(h,x);const sample=createLivePoseSampler(),m=model(),rows=[],boundaries=[],phases=[];let wall=h.run('qaWall'),old=null,maxSpeed=0,maxPreResultOwnerErrors=0,preReleaseMovement=0,maxFlightDeviation=0,earlyIncomingOwnership=0;const visited=new Set();
for(let i=0;i<20000;i++){
 const before=h.run('MatchView.read()'),e=before.presentation.activeEvent,p=before.presentation.progress;let dt=.02;
 if(e&&e.eventId>=x.start&&e.eventId<=x.end){const b=[.19,.65,.76,.91,.999999].find(v=>v>p+1e-8);if(b)dt=Math.min(dt,(b-p)*before.presentation.duration*4+1e-10);}
 wall+=dt;h.run(`ManagerStoryLive3D.step(${dt},${wall*1000})`);const s=h.run('MatchView.read()'),P=s.presentation,e1=P.activeEvent,view=sample(s),roots=Object.fromEntries(s.players.map(p=>[String(p.id),p.displayPosition]));
 const f={id:e1?.eventId,type:e1?.type,p:P.progress,ball:s.ball.displayPosition,ball3d:view.ball,roots,owner:s.ball.displayOwnerId,score:P.eventScore,wall};
 if(old){let speed=Math.max(...Object.keys(roots).map(id=>distance(old.roots[id],roots[id])/dt));maxSpeed=Math.max(maxSpeed,speed);if(old.id!==f.id||old.type!==f.type)boundaries.push({from:old.id??old.type,to:f.id??f.type,ballStep:distance(old.ball,f.ball),heightStep:Math.abs(old.ball3d[1]-f.ball3d[1]),rootStep:Math.max(...Object.keys(roots).map(id=>distance(old.roots[id],roots[id])))});}
 if(e1?.headerShot&&P.progress>=.19&&f.owner!=null)earlyIncomingOwnership++;
 if(e1?.eventId===x.id){const shot=P.shotMotion;if(!shot)throw Error('Unlinked real shot');if(P.progress<.19){preReleaseMovement=Math.max(preReleaseMovement,distance(f.ball,shot.sourcePoint));if(f.owner!==(x.kind==='header'?null:e1.fromId))maxPreResultOwnerErrors++;}else if(P.progress<.76&&f.owner!=null)maxPreResultOwnerErrors++;
 if(P.progress>=.19&&P.progress<=.76){const u=(P.progress-.19)/.57,expected=shot.sourcePoint.map((v,i)=>v+(shot.target[i]-v)*u);maxFlightDeviation=Math.max(maxFlightDeviation,distance(expected,f.ball));}
 for(const t of [.19,.65,.76,.91,.999999])if(Math.abs(P.progress-t)<1e-7&&!phases.some(v=>v.threshold===t)){
 const shooter=poseFootballer(m,view.poses.find(p=>p.id===e1.fromId)),toe=shooter.rightToe.clone(),head=shooter.forehead.clone();let blockToe=null;if(shot.blocker)blockToe=poseFootballer(m,view.poses.find(p=>p.id===shot.result.toId)).rightToe.distanceTo(new T.Vector3(...view.ball));
 const goalX=e1.toPos[0]>50?52.5:-52.5,z=shot.target[1]*.68-34,frameDistance=e1.frame==='crossbar'?Math.hypot(view.ball[0]-goalX,view.ball[1]-2.44):Math.hypot(view.ball[0]-goalX,view.ball[2]-(e1.toPos[1]<50?-3.66:3.66));
 phases.push({threshold:t,ball:f.ball,ball3d:view.ball,owner:f.owner,toeBall:toe.distanceTo(new T.Vector3(...view.ball)),foreheadBall:head.distanceTo(new T.Vector3(...view.ball)),blockToe,frameDistance,rawEventId:shot.result.eventId,target:shot.target});}
 }
 if(e1?.eventId!=null)visited.add(e1.eventId);if(i%5===0)rows.push(f);old=f;if(e1?.eventId===x.end&&P.progress>=.19)break;
}
const minute=h.run('M.min'),newState=h.run('structuredClone({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})');
const raw=harness(),oldSource=execFileSync('git',['show','87d8b89:dist/pitch-v73.js'],{encoding:'utf8'});raw.run(oldSource.slice(oldSource.indexOf('function resolveShot(')));raw.run(oldSource.slice(oldSource.indexOf('function enqueuePitchEvent('),oldSource.indexOf('function pitchEventPhase(')));
raw.run(`S=fresh();init();startMatch();M.rand=R(${x.seed});resumeLive();for(let n=0;n<${minute};n++)advanceLive(60/90)`);const oldState=raw.run('structuredClone({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})');
return {...x,minute,wall,maxSpeed,preReleaseMovement,maxPreResultOwnerErrors,maxFlightDeviation,earlyIncomingOwnership,visited:[...visited],boundaries,phases,preserved:JSON.stringify(newState)===JSON.stringify(oldState),newState,oldState,rows};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const a=examples.map(audit);fs.writeFileSync('docs/qa-stage3h/measurements.json',JSON.stringify(a,null,2));console.log(JSON.stringify(a.map(({rows,newState,oldState,...r})=>r),null,2));}
