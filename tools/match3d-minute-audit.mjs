// Real seed-8800 engine. Measurements of the existing scheduler, not another product simulation.
import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {setup as currentSetup} from './match3d-continuity-audit.mjs';
const require=createRequire(import.meta.url),{harness}=require('../tests/engine-harness.cjs');
const reference=JSON.parse(fs.readFileSync(new URL('./fixtures/stage3c-presentation.json',import.meta.url),'utf8'));
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
export function setup(baseline=false){if(!baseline)return currentSetup();const h=harness();h.run(reference.enqueue);h.run(reference.clock);h.run(fs.readFileSync('dist/match-view-adapter.js','utf8'));h.run('S=fresh();init();ManagerStoryLive3D.enable();startMatch();resumeLive()');return h;}
export function audit(baseline=false){
 const h=setup(baseline),boundaries=[],minutes=[],idleRuns=[],speeds=[],kickoff=[];let wall=0,idle=0,idleStart=null,old=null,maxLead=0,maxQueue=0,maxRootSpeed=0,maxTransitionSpeed=0,maxBoundaryJump=0,maxOwnedGap=0,minWall=0,oldMinute=0,oldestStart=null,maxQueueAge=0;
 for(let i=1;i<20000;i++){
  const dt=.01;wall=i*dt;h.run(`ManagerStoryLive3D.step(${dt},${wall*1000})`);const s=h.run('MatchView.read()'),P=s.presentation,e=P.activeEvent,roots=Object.fromEntries(s.players.map(p=>[String(p.id),p.displayPosition||p.enginePosition])),display=P.matchSeconds??s.matchSeconds;
  if(!e){idle+=dt;idleStart??=wall;}else if(idleStart!=null){idleRuns.push({start:idleStart,end:wall,seconds:wall-idleStart});idleStart=null;}
  if(P.queuedEventIds.length||e)oldestStart??=wall;else oldestStart=null;
  maxQueueAge=Math.max(maxQueueAge,oldestStart==null?0:wall-oldestStart);maxLead=Math.max(maxLead,s.matchSeconds-display);maxQueue=Math.max(maxQueue,P.queuedEventIds.length);
  if(Math.floor(s.matchSeconds/60)!==oldMinute){oldMinute=Math.floor(s.matchSeconds/60);minutes.push({minute:oldMinute,wall,display,rawLead:s.matchSeconds-display,queue:P.queuedEventIds.length,previousBatchWall:wall-minWall});minWall=wall;oldestStart=wall;}
  let rootSpeed=0;
  if(old){for(const [id,p] of Object.entries(roots))if(old.roots[id])rootSpeed=Math.max(rootSpeed,distance(p,old.roots[id])/dt);
   maxRootSpeed=Math.max(maxRootSpeed,rootSpeed);if(e?.type==='enginePositionGap')maxTransitionSpeed=Math.max(maxTransitionSpeed,rootSpeed);
   if(old.signature!==`${e?.type}:${e?.eventId??''}`){const jump=distance(s.ball.displayPosition,old.ball);maxBoundaryJump=Math.max(maxBoundaryJump,jump);boundaries.push({wall,from:old.type,to:e?.type,eventId:e?.eventId,ballStepMetres:jump,rootSpeed,rawSeconds:s.matchSeconds,displaySeconds:display});}
  }
  if(e?.type==='enginePositionGap'&&s.ball.displayOwnerId!=null&&roots[String(s.ball.displayOwnerId)])maxOwnedGap=Math.max(maxOwnedGap,distance(s.ball.displayPosition,roots[String(s.ball.displayOwnerId)]));
  if(e?.type==='kickoff'||old?.type==='kickoff')kickoff.push({wall,type:e?.type,progress:P.progress,ball:s.ball.displayPosition,owner:s.ball.displayOwnerId,root:roots['6'],raw:s.matchSeconds,display});
  if(e?.type==='enginePositionGap'&&(i%20===0))speeds.push({wall,metresPerSecond:rootSpeed,phase:e.sampleInterval?.phase||'legacy-gap',sampleInterval:e.sampleInterval,rawSeconds:s.matchSeconds,displaySeconds:display});
  old={signature:`${e?.type}:${e?.eventId??''}`,type:e?.type,ball:s.ball.displayPosition,roots};
  if(h.run('ManagerStoryLive3D.logs.length')>=6)break;
 }
 const logs=h.run('ManagerStoryLive3D.logs'),events=h.run('structuredClone(M.events)');
 return {sourceCommit:baseline?reference.sourceCommit:'working-tree',baseline,seed:8800,speed:1,tempo:4,sampleStepSeconds:.01,wallEnd:wall,technicalIdleSeconds:idle,idleRuns,maxEngineLeadGameSeconds:maxLead,maxQueue,maxQueueAgeSeconds:maxQueueAge,maxRootSpeed,maxTransitionSpeed,maxBoundaryJumpMetres:maxBoundaryJump,maxOwnedBallRootGapMetres:maxOwnedGap,boundaries,minutes,kickoff,speeds,passes:logs,events,finalStats:h.run('structuredClone({score:[M.hg,M.ag],stats:M.stats})')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const out=process.argv[2]||'docs/qa-stage3d';fs.mkdirSync(out,{recursive:true});const before=audit(true),after=audit(false);fs.writeFileSync(out+'/minute-continuity.json',JSON.stringify({before,after},null,2));console.log(JSON.stringify([before,after].map(({baseline,wallEnd,technicalIdleSeconds,maxEngineLeadGameSeconds,maxQueue,maxQueueAgeSeconds,maxRootSpeed,maxTransitionSpeed,maxBoundaryJumpMetres,maxOwnedBallRootGapMetres,minutes,passes})=>({baseline,wallEnd,technicalIdleSeconds,maxEngineLeadGameSeconds,maxQueue,maxQueueAgeSeconds,maxRootSpeed,maxTransitionSpeed,maxBoundaryJumpMetres,maxOwnedBallRootGapMetres,minutes,passIds:passes.map(p=>p.eventId)})),null,2));}
