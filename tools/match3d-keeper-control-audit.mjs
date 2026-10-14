import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import {harness} from '../tests/engine-harness.cjs';
import {createLivePoseSampler} from '../dist/match3d-live-view.js';import {createFootballer} from '../dist/match3d-player.js';import {poseFootballer} from '../dist/match3d-football-pose.js';import * as T from '../dist/vendor/three/three.module.min.js';
export const baseline='70d0d71caec295d180a29892eb2a2cab3806da4f';
global.document={createElement:()=>({width:256,height:256,getContext:()=>({fillText(){}})})};
let historical;
async function oldSampler(){if(historical)return historical;const dir='/tmp/ms-keeper-control-baseline';fs.mkdirSync(dir,{recursive:true});for(const name of ['match3d-keeper.js','match3d-live-view.js']){let code=execFileSync('git',['show',baseline+':dist/'+name],{encoding:'utf8'});code=code.replace(/from '(\.\/[^']+)'/g,(_,file)=>`from '${pathToFileURL(file==='./match3d-keeper.js'?dir+'/match3d-keeper.mjs':process.cwd()+'/dist/'+file.slice(2)).href}'`);fs.writeFileSync(dir+'/'+name.replace('.js','.mjs'),code);}historical=(await import(pathToFileURL(dir+'/match3d-live-view.mjs').href)).createLivePoseSampler;return historical;}
export function setup(before=false){const h=harness();for(const name of ['match3d-live-clock.js','match-view-adapter.js'])h.run(before?execFileSync('git',['show',baseline+':dist/'+name],{encoding:'utf8'}):fs.readFileSync('dist/'+name,'utf8'));h.run('S=fresh();init();startMatch();resumeLive();setMatchView("3d");M.rand=R(8800);window.qaWall=0;');return h;}
export async function chain(before,id,speed=1,view='3d'){
 const h=setup(before),make=before?await oldSampler():createLivePoseSampler,sampler=make();h.run(`setMatchView('${view}');setMatchSpeed(${speed});for(let n=0;n<30000;n++){qaWall+=.02;ManagerStoryLive3D.step(.02,qaWall*1000);if(pitchV73.active?.eventId===${id})break;}if(pitchV73.active?.eventId!==${id})throw Error('Missing real save');`);
 const initial=h.run('MatchView.read()'),shotDuration=initial.presentation.duration,keeperId=initial.presentation.activeEvent.goalkeeperId,side=initial.presentation.activeEvent.shotResult.toSide,model=createFootballer({id:keeperId,side,number:1,kit:initial.teams.home,goalkeeper:true});
 const phases=[],boundaries=[];let old=null,maxHeldGap=0,maxRootSpeed=0,maxHeldBallSpeed=0,minHeldHeight=Infinity,distribution=null,seen=[],heldFrames=0,heldPauseFrozen=null;
 for(let n=0;n<12000;n++){
  const s=h.run('MatchView.read()'),P=s.presentation,e=P.activeEvent,p=P.progress,v=sampler(s),pose=v.poses.find(x=>x.id===keeperId&&x.side===side),c=poseFootballer(model,pose),gap=Math.min(c.leftHand.distanceTo(new T.Vector3(...v.ball)),c.rightHand.distanceTo(new T.Vector3(...v.ball))),key=`${e?.type}:${e?.eventId}`;
  const held=before?s.ball.displayOwnerId===keeperId&&(e?.eventId!==id||p>=.76):!!P.keeperControl;
  if(e?.eventId!=null&&seen.at(-1)!==e.eventId)seen.push(e.eventId);
  if(e?.type==='pass'&&e.fromId===keeperId)distribution??={id:e.eventId,realSuccess:e.success,source:e.keeperDistribution?.source||'previous-foot-pass',D:P.duration};
  if(held&&!before&&heldPauseFrozen===null){const frozen=h.run('JSON.stringify([MatchView.read().ball,pitchV73.positions,pitchV73.keeperControl,ManagerStoryLive3D.time])');h.run('pauseLive();ManagerStoryLive3D.step(2,999999);setMatchView("2d");setMatchView("3d");');heldPauseFrozen=frozen===h.run('JSON.stringify([MatchView.read().ball,pitchV73.positions,pitchV73.keeperControl,ManagerStoryLive3D.time])');h.run(`setMatchView('${view}');resumeLive();`);}
  if(held){maxHeldGap=Math.max(maxHeldGap,gap);minHeldHeight=Math.min(minHeldHeight,v.ball[1]);heldFrames++;}
  const root=pose.position;
  if(old){const rootStep=Math.hypot(...root.map((x,i)=>x-old.root[i])),ballStep=Math.hypot(...v.ball.map((x,i)=>x-old.ball[i])),dt=P.seconds-old.time;
   if(held&&e?.eventId!==id&&dt>0){maxRootSpeed=Math.max(maxRootSpeed,rootStep/dt);maxHeldBallSpeed=Math.max(maxHeldBallSpeed,ballStep/dt);}
   if(old.key!==key)boundaries.push({from:old.key,to:key,rootStep,ballStep,height:v.ball[1],held,gap});
  }
  if(n%12===0)phases.push({event:e?.eventId,type:e?.type,p,held,height:v.ball[1],gap,phase:pose.keeperMotion?.phase,root,ball:v.ball});
  old={key,time:P.seconds,root:[...root],ball:[...v.ball]};
  if(distribution&&e?.eventId===distribution.id&&p>.999)break;
  h.run(`{let dt=.01;const e=pitchV73.active,b=e?.eventId===${id}||e?.type==='pass'?[.19,.76,.9999].find(x=>x>pitchV73.progress+1e-8):null;if(b)dt=Math.min(dt,(b-pitchV73.progress)*pitchV73.activeDuration/M.speed);qaWall+=dt;ManagerStoryLive3D.step(dt,qaWall*1000);}`);
 }
 const frozen=h.run('JSON.stringify([MatchView.read().ball,pitchV73.positions,pitchV73.keeperControl,ManagerStoryLive3D.time])');h.run('pauseLive();ManagerStoryLive3D.step(2,999999);setMatchView("2d");setMatchView("3d");');const pauseFrozen=frozen===h.run('JSON.stringify([MatchView.read().ball,pitchV73.positions,pitchV73.keeperControl,ManagerStoryLive3D.time])');
 return {before,seed:8800,shot:id,shotDuration,gatherSeconds:.24*shotDuration,keeperId,view,speed,distribution,seen,heldFrames,maxHeldGap,minHeldHeight,maxRootSpeed,maxHeldBallSpeed,boundaries,phases,pauseFrozen,heldPauseFrozen};
}
export async function audit(){const examples=[];for(const id of [49,99])examples.push({before:await chain(true,id),after:await chain(false,id)});const controls=[];for(const view of ['2d','3d'])for(const speed of [.5,1,2])for(const id of [49,99]){const c=await chain(false,id,speed,view);delete c.phases;controls.push(c);}return {baseline,environment:'CPU real engine + actual approved rig; not video identification or WebGL/iPhone proof',examples,controls};}
if(process.argv[1]?.endsWith('match3d-keeper-control-audit.mjs')){const a=await audit();fs.mkdirSync('docs/qa-keeper-control',{recursive:true});fs.writeFileSync('docs/qa-keeper-control/measurements.json',JSON.stringify(a,null,2));console.log(JSON.stringify(a.examples.map(x=>({id:x.after.shot,pass:x.after.distribution,heldGap:[x.before.maxHeldGap,x.after.maxHeldGap],heldHeight:[x.before.minHeldHeight,x.after.minHeldHeight],rootPeak:[x.before.maxRootSpeed,x.after.maxRootSpeed],boundary:x.after.boundaries})),null,2));}
