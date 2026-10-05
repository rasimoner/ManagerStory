import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {setup} from './match3d-minute-audit.mjs';
const require=createRequire(import.meta.url),{harness,playToEnd}=require('../tests/engine-harness.cjs');
const substitute=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];
export function audit(seed){const h=setup();h.run(`M.rand=R(${seed});window.qaSub=${JSON.stringify(substitute)}`);
 const result=h.run(`(()=>{
 const entered=[],completed=[],represented=[],duplicates=[],controls=[],terminalRows=[];let wall=0,prior=null,half=false,control=false,engineAtEnd=null,terminalRenders=0;
 const originalRender=render;render=function(){if(M?.finished&&!livePresentationPending())terminalRenders++;return originalRender()};
 const signature=()=>JSON.stringify([pitchV73.active,pitchV73.queue,pitchV73.batchEnd,pitchV73.positions,pitchV73.ball,pitchV73.carrier,pitchV73.progress,ManagerStoryLive3D.time]);
 const raw=()=>JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state});
 for(let i=0;i<120000;i++){
  if(M.reason==='half'&&!half){half=true;startSecondHalf();}else if(M.reason==='injury')eval(qaSub);else if(M.pause&&!M.finished)resumeLive();
  if(M.finished&&!control){
   engineAtEnd=raw();control=true;const current=signature(),phase=pitchV73.progress,fixture=S.fixture;finishMatch();const earlyFinishBlocked=S.fixture===fixture&&!!M;
   pauseLive();const paused=signature();ManagerStoryLive3D.step(2,wall*1000+2000);const pauseFrozen=signature()===paused;resumeLive();
   const rates=[];for(const speed of [.5,1,2]){setMatchSpeed(speed);const p=pitchV73.progress,D=pitchV73.activeDuration;ManagerStoryLive3D.step(.001,wall*1000);rates.push({speed,advance:pitchV73.progress-p,expected:.001*speed/4/D,durationPreserved:D===pitchV73.activeDuration});}setMatchSpeed(1);
   controls.push({phase,earlyFinishBlocked,pauseFrozen,resumePreserved:current===paused,rates,engineStillFinished:M.finished&&M.lifecycle==='FINISHED'&&M.pause});
  }
  const before=pitchV73.active;wall+=.08;ManagerStoryLive3D.step(.08,wall*1000);const s=pitchV73,e=s.active;
  if(e!==prior){if(e?.eventId!=null){if(entered.includes(e.eventId))duplicates.push(e.eventId);entered.push(e.eventId);}prior=e;}
  if(before&&before!==e){if(before.eventId!=null)completed.push(before.eventId);if(before.motionEvents)represented.push(...before.motionEvents.map(x=>x.eventId));if(before.shotResult)represented.push(before.shotResult.eventId);if(before.consumedContinuationId)represented.push(before.consumedContinuationId);if(before.contest)represented.push(before.contest.press.eventId,before.contest.tackle.eventId,before.contest.result?.eventId);}
  if(M.finished){terminalRows.push({id:e?.eventId??null,type:e?.type??null,p:s.progress,owner:s.carrier,queue:s.queue.map(x=>x.eventId),settlement:!!s.batchEnd,phase:s.terminalPhase,score:s.eventScore});if(!ManagerStoryLive3D.finishing)break;}
 }
 const terminal=MatchView.read(),stable=signature(),stableRaw=raw(),stableComment=JSON.stringify(liveCommentaryLines());for(let i=0;i<10;i++){advanceLive(20);tick();ManagerStoryLive3D.step(20,(wall+20+i)*1000);}const frozen=stable===signature(),engineFrozen=stableRaw===raw()&&engineAtEnd===raw(),narrativeFrozen=stableComment===JSON.stringify(liveCommentaryLines());
 const state=JSON.parse(raw());const ui=matchUI(),endCount=M.events.filter(e=>e.type==='end').length;finishMatch();const career=JSON.stringify(S),fixture=S.fixture;finishMatch();const careerOnce=JSON.stringify(S)===career;return {seed:${seed},wall,entered,completed,represented,duplicates,controls,terminalRows,terminal:{phase:terminal.presentation.terminalPhase,queue:terminal.presentation.queuedEventIds,settlement:terminal.presentation.pendingMinuteSettlement,active:terminal.presentation.activeEvent,owner:terminal.ball.displayOwnerId,score:terminal.score,displayScore:terminal.presentation.eventScore,seconds:terminal.matchSeconds,clock:terminal.presentation.matchSeconds},frozen,engineFrozen,narrativeFrozen,terminalRenders,endCount,finishButton:ui.includes('onclick="finishMatch()"'),careerOnce,fixture,career,state};
 })()`);
 const base=harness();const oldLive=execFileSync('git',['show','3d568e3:dist/live-match.js'],{encoding:'utf8'});base.run(oldLive.slice(oldLive.indexOf('function finalizeMatch(){'),oldLive.indexOf('function matchSyncDebug(){')));const oldApp=execFileSync('git',['show','3d568e3:dist/app.js'],{encoding:'utf8'});base.run(oldApp.split('\n').find(s=>s.startsWith('function finishMatch(){')));base.run(`S=fresh();init();startMatch();M.rand=R(${seed});resumeLive()`);playToEnd(base);const old=base.run('JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})');result.enginePreserved=old===JSON.stringify(result.state);base.run('finishMatch()');result.careerPreserved=base.run('JSON.stringify(S)')===result.career;delete result.career;
 const expected=seed===1?[498,499,500,501]:[507,508,509,510,511,513,514,515];result.expected=expected;result.missing=expected.filter(id=>!result.completed.includes(id)&&!result.represented.includes(id));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){fs.mkdirSync('docs/qa-stage3-finalize',{recursive:true});const results=[audit(1),audit(8800)];fs.writeFileSync('docs/qa-stage3-finalize/terminal-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({state,entered,completed,represented,terminalRows,...r})=>r),null,2));}
