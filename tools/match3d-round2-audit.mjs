import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {harness} from '../tests/engine-harness.cjs';
export const baseline='0e6edecc7d3de3a518eee0e64bdf7ba815a61380';
const files=['match-support.js','career-events.js','live-match.js','opponents-v731.js','pitch-v73.js','pitch-v731.js','app.js'];
const read=(name,before)=>before?execFileSync('git',['show',`${baseline}:dist/${name}`],{encoding:'utf8'}):fs.readFileSync(`dist/${name}`,'utf8');
export function setup(before=false){
 const h=harness(new Map(),files.map(f=>read(f,before)));
 let clock=read('match3d-live-clock.js',before);
 // Read-only boundary instrumentation in QA, not a second product clock.
 clock=clock.replace('state.shotPreStatistics=structuredClone(state.eventStatistics);',`window.qaClips.push({type:state.active.type,id:state.active.eventId??null,linked:[state.active.shotResult?.eventId,state.active.consumedContinuationId,state.active.contest?.press?.eventId,state.active.contest?.tackle?.eventId,state.active.contest?.result?.eventId,...(state.active.motionEvents||[]).map(e=>e.eventId)].filter(x=>x!=null),looseResultId:state.active.looseResultId??state.active.keeperLooseResult??null,source:state.active.continuitySource||null,from:state.active.fromPos,to:state.active.toPos,startBall:[...state.ball],startPositions:structuredClone(state.positions),startOwner:state.carrier,contest:state.active.contest?structuredClone(state.active.contest):null,actor:state.active.shotResult&&typeof shotInterventionActor==='function'?shotInterventionActor(state.active.shotResult):null,result:state.active.shotResult?structuredClone(state.active.shotResult):null});state.shotPreStatistics=structuredClone(state.eventStatistics);`);
 clock=clock.replace('if(clockProgress>=1-1e-8){','if(clockProgress>=1-1e-8){const q=window.qaClips.at(-1);if(q)Object.assign(q,{endBall:[...state.ball],endPositions:structuredClone(state.positions),endOwner:state.carrier,duration:D});');
 h.run('window.qaClips=[];');h.run(clock);h.run(read('match-view-adapter.js',before));
 h.run('S=fresh();init();startMatch();resumeLive();setMatchView("3d");window.qaWall=0;');
 return h;
}
const sub=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];
export function full(h,seed){
 h.run(`M.rand=R(${seed});window.qaSub=${JSON.stringify(sub)};window.qaClips=[];`);
 return h.run(`(()=>{let wall=0;for(let i=0;i<120000;i++){if(M.reason==='half')startSecondHalf();else if(M.reason==='injury')eval(qaSub);else if(M.pause&&!M.finished)resumeLive();wall+=.08;ManagerStoryLive3D.step(.08,wall*1000);if(M.finished&&!ManagerStoryLive3D.finishing)break;}const result={wall,finished:M.finished,pending:ManagerStoryLive3D.finishing,raw:JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state}),events:structuredClone(M.events),clips:structuredClone(qaClips),defaultView:M.fieldView};finishMatch();result.career=JSON.stringify(S);const once=result.career;finishMatch();result.singleResult=once===JSON.stringify(S);return result;})()`);
}

export function seek(h,seed,id){h.run(`M.rand=R(${seed});window.qaSub=${JSON.stringify(sub)};for(let i=0;i<100000;i++){if(M.reason==='half')startSecondHalf();else if(M.reason==='injury')eval(qaSub);else if(M.pause&&!M.finished)resumeLive();qaWall+=.01;ManagerStoryLive3D.step(.01,qaWall*1000);if(pitchV73.active?.eventId===${id})break;}if(pitchV73.active?.eventId!==${id})throw Error('Missing real action ${seed}/${id}');`);}
export function audit(){
 const matches=[1,8800].map(seed=>{const before=full(setup(true),seed),after=full(setup(),seed);return {seed,before,after,preserved:before.raw===after.raw&&before.career===after.career};});
 return {baseline,environment:'CPU real engine/shared clock; motion visually awaiting user approval',matches};
}
if(process.argv[1]?.endsWith('match3d-round2-audit.mjs')){
 const a=audit();fs.mkdirSync('docs/qa-round2',{recursive:true});fs.writeFileSync('/tmp/round2-full.json',JSON.stringify(a));
 const summary={baseline,environment:a.environment,matches:a.matches.map(({seed,before,after,preserved})=>({seed,preserved,beforeSeconds:before.wall,afterSeconds:after.wall,beforeClipSeconds:before.clips.reduce((n,c)=>n+(c.duration||0),0),afterClipSeconds:after.clips.reduce((n,c)=>n+(c.duration||0),0),singleResult:after.singleResult,finished:after.finished,pending:after.pending,events:after.events.length,clips:after.clips.length,interventions:after.clips.filter(c=>c.result&&['save','block'].includes(c.result.type)).map(c=>({id:c.id,result:c.result.eventId,type:c.result.type,saveType:c.result.saveType,actor:c.actor,corner:after.events.some(e=>e.gameSecond===c.result.gameSecond&&e.restartType==='CORNER')}))}))};
 fs.writeFileSync('docs/qa-round2/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}
export async function motionExamples(){
 const {createLivePoseSampler}=await import('../dist/match3d-live-view.js'),{createFootballer}=await import('../dist/match3d-player.js'),{poseFootballer}=await import('../dist/match3d-football-pose.js'),T=await import('../dist/vendor/three/three.module.min.js');
 global.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 const examples=[];
 for(const [seed,id] of [[8800,49],[8800,99],[8800,427],[2,62],[24,356]]){
  const h=setup();seek(h,seed,id);const sampler=createLivePoseSampler(),snapshots=h.run(`(()=>{const frames=[];for(let i=0;i<3000&&pitchV73.active?.eventId===${id};i++){const p=pitchV73.progress,stop=[.10,.35,.58,.72,.76,.78,.89,.99].find(x=>x>p+1e-7),dt=stop?Math.min(.01,(stop-p)*pitchV73.activeDuration*ManagerStoryLive3D.tempo/matchPlaybackRate()):.01;ManagerStoryLive3D.step(dt,0);if(pitchV73.active?.eventId===${id})frames.push(MatchView.read());}return frames;})()`);
  for(const s of snapshots){const v=sampler(s),e=s.presentation.activeEvent,shot=s.presentation.shotMotion;if(![.10,.35,.58,.72,.76,.78,.89,.99].some(p=>Math.abs(p-s.presentation.progress)<1e-7))continue;
   const actor=shot.result.toId,k=v.poses.find(x=>x.id===actor&&x.side===shot.result.toSide),m=createFootballer({id:actor,side:shot.result.toSide,number:1,kit:s.teams.home,goalkeeper:k.keeperMotion!=null}),contacts=poseFootballer(m,k),bones=m.userData.bones;
   const lengths=['left','right'].flatMap(side=>{const sh=bones[side+'Shoulder'].getWorldPosition(new T.Vector3()),el=bones[side+'Elbow'].getWorldPosition(new T.Vector3()),hand=bones[side+'Hand'].getWorldPosition(new T.Vector3()),hip=bones[side+'Hip'].getWorldPosition(new T.Vector3()),knee=bones[side+'Knee'].getWorldPosition(new T.Vector3()),ankle=bones[side+'Ankle'].getWorldPosition(new T.Vector3());return [sh.distanceTo(el),el.distanceTo(hand),hip.distanceTo(knee),knee.distanceTo(ankle)];});
   examples.push({seed,id,result:shot.result.eventId,type:shot.result.type,saveType:shot.result.saveType,actor,side:shot.result.toSide,p:s.presentation.progress,direction:e.toPos[0]>50?1:-1,kind:k.keeperMotion?.kind||'field-block',phase:k.keeperMotion?.phase||'field-reach',roll:k.pelvisRoll||0,root:k.position,ball:v.ball,feet:[k.leftFoot,k.rightFoot],pelvis:k.pelvisHeight,lengths,owner:s.ball.displayOwnerId,height:v.ball[1],contactGap:Math.min(contacts.leftHand.distanceTo(new T.Vector3(...v.ball)),contacts.rightHand.distanceTo(new T.Vector3(...v.ball)))});
  }
 }
 return examples;
}
