import fs from 'node:fs';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {setup} from './match3d-minute-audit.mjs';
const require=createRequire(import.meta.url),{harness,playToEnd}=require('../tests/engine-harness.cjs');
const substitute=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];
const supported=['kickoff','pass','cross','shot','firstTouch','dribble','ballCarry','run','looseBall','recovery','hold','enginePositionGap'];
export function inventory(seed){const h=setup();h.run(`M.rand=R(${seed});window.qaSub=${JSON.stringify(substitute)};window.inventorySupported=${JSON.stringify(supported)}`);
 const result=h.run(`(()=>{
  const rows=[],counts={},unsupported={},ownerErrors=[],ownerOffsetAlerts=[],duplicates=[],consumed=new Set(),entered=new Set(),stops=[];let previous=null,wall=0,signature='',completed=false,half=false,maxQueue=0,maxActiveSeconds=0,activeStart=0,frames=0;
  for(let i=0;i<60000;i++){
   if(M.reason==='half'&&!half){stops.push({minute:M.min,reason:'half'});half=true;startSecondHalf();}
   else if(M.reason==='injury'){stops.push({minute:M.min,reason:'injury'});eval(qaSub);}
   else if(M.pause&&!M.finished)resumeLive();
   wall+=.08;ManagerStoryLive3D.step(.08,wall*1000);frames++;
   const s=currentPitchState(),e=s.active,p=s.progress,key=e?.eventId!=null?'event:'+e.eventId:e?e.type+':'+s.clipStart:'idle';maxQueue=Math.max(maxQueue,s.queue.length);
   if(key!==signature){signature=key;activeStart=wall;if(e?.eventId!=null){if(entered.has(e.eventId))duplicates.push(e.eventId);entered.add(e.eventId);counts[e.type]=(counts[e.type]||0)+1;const isSupported=inventorySupported.includes(e.type)||!!e.contest||!!e.shotResult||!!e.headerShot;rows.push({id:e.eventId,type:e.type,supported:isSupported});if(!isSupported)unsupported[e.type]=(unsupported[e.type]||0)+1;
    if(e.shotResult){consumed.add(e.shotResult.eventId);if(e.consumedContinuationId)consumed.add(e.consumedContinuationId);}if(e.contest){consumed.add(e.contest.tackle.eventId);if(e.contest.press.eventId!==e.eventId)consumed.add(e.contest.press.eventId);if(e.contest.result)consumed.add(e.contest.result.eventId);}
   }if(e?.motionEvents)for(const x of e.motionEvents)consumed.add(x.eventId);}
   if(e)maxActiveSeconds=Math.max(maxActiveSeconds,wall-activeStart);
   let expected,rule=null;
   if(e?.contest){const c=e.contest;expected=p>=.76&&!c.attackerKeepsBall?c.defenderId:c.attackerId;rule='contest';}
   else if(e?.type==='hold'){expected=e.success===false&&p>=.76?null:e.fromId;rule='hold';}
   else if(e?.type==='looseBall'){expected=null;rule='loose';}
   else if(e?.type==='recovery'){expected=p<.76?null:e.toId;rule='recovery';}
   else if(['pass','cross'].includes(e?.type)&&!e.headerShot){expected=p<.19?e.fromId:p<.76?null:e.toId;rule='pass';}
   else if(e?.type==='shot'&&e.shotResult){expected=p<.19&&!e.headerIncoming?e.fromId:e.outcome==='save'&&e.shotResult.saveType==='CATCH'&&p>=.76?e.goalkeeperId:null;rule='shot';}
   if(rule&&s.carrier!==expected&&ownerErrors.length<30)ownerErrors.push({id:e.eventId,type:e.type,p,expected,actual:s.carrier});
   if(s.carrier!=null&&!(s.side==='user'?M.active:M.oppIds).includes(s.carrier)&&ownerErrors.length<30)ownerErrors.push({id:e?.eventId,rule:'wrong-side-roster',owner:s.carrier,side:s.side});
   if(s.carrier!=null){const o=s.visualOffsets?.[String(s.carrier)]||[0,0],gap=Math.hypot(o[0]*1.05,o[1]*.68);if(gap>.02&&ownerOffsetAlerts.length<20)ownerOffsetAlerts.push({id:e?.eventId,type:e?.type,p,owner:s.carrier,offsetMetres:gap});}
   if(M.finished){completed=true;break;}
  }
  const s=currentPitchState(),endSignature=JSON.stringify([s.active,s.queue,s.progress]);ManagerStoryLive3D.step(.08,(wall+.08)*1000);const terminalFrozen=JSON.stringify([s.active,s.queue,s.progress])===endSignature;return {terminalFrozen,seed:${seed},wall,frames,finished:M.finished,minute:M.min,lifecycle:M.lifecycle,completed,maxQueue,maxActiveSeconds,counts,unsupported,ownerErrors,ownerOffsetAlerts,duplicates,consumed:[...consumed],entered:[...entered],stops,rows,terminal:{active:s.active?{id:s.active.eventId,type:s.active.type,p:s.progress}:null,queued:s.queue.map(e=>({id:e.eventId,type:e.type})),batchEnd:!!s.batchEnd},state:structuredClone({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})};
 })()`);
 const raw=harness(),source=execFileSync('git',['show','805cc0b:dist/pitch-v73.js'],{encoding:'utf8'});raw.run(source.slice(source.indexOf('function actionMinute('),source.indexOf('function chanceV73(')));raw.run(`S=fresh();init();startMatch();M.rand=R(${seed});resumeLive()`);playToEnd(raw);const old=raw.run('structuredClone({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})');
 result.enginePreserved=JSON.stringify(old)===JSON.stringify(result.state);result.rawTypeCounts=result.state.events.reduce((a,e)=>(a[e.type]=(a[e.type]||0)+1,a),{});result.notPresented=result.state.events.filter(e=>e.eventId&&!result.entered.includes(e.eventId)&&!result.consumed.includes(e.eventId)).map(e=>({id:e.eventId,type:e.type}));return result;
}
const result=[inventory(1),inventory(8800)];fs.writeFileSync('docs/qa-stage3-close/full-match-inventory.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.map(({state,rows,entered,consumed,...r})=>r),null,2));
