import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {harness} from '../tests/engine-harness.cjs';
export const baseline='2bad70b599c6ebd8733ed9adc10d4c1254ee87e5';
const files=['match-support.js','career-events.js','live-match.js','opponents-v731.js','pitch-v73.js','pitch-v731.js','app.js'];
const read=(name,before)=>before?execFileSync('git',['show',`${baseline}:dist/${name}`],{encoding:'utf8'}):fs.readFileSync(`dist/${name}`,'utf8');
export function setup(before=false){
 const h=harness(new Map(),files.map(f=>read(f,before)));
 let clock=read('match3d-live-clock.js',before);
 // Read-only boundary instrumentation in QA, not a second product clock.
 clock=clock.replace('state.shotPreStatistics=structuredClone(state.eventStatistics);',`window.qaClips.push({type:state.active.type,id:state.active.eventId??null,linked:[state.active.shotResult?.eventId,state.active.consumedContinuationId,state.active.contest?.press?.eventId,state.active.contest?.tackle?.eventId,state.active.contest?.result?.eventId,...(state.active.motionEvents||[]).map(e=>e.eventId)].filter(x=>x!=null),looseResultId:state.active.looseResultId??state.active.keeperLooseResult??null,source:state.active.continuitySource||null,from:state.active.fromPos,to:state.active.toPos,startBall:[...state.ball],startPositions:structuredClone(state.positions),startOwner:state.carrier});state.shotPreStatistics=structuredClone(state.eventStatistics);`);
 clock=clock.replace('if(clockProgress>=1-1e-8){','if(clockProgress>=1-1e-8){const q=window.qaClips.at(-1);if(q)Object.assign(q,{endBall:[...state.ball],endPositions:structuredClone(state.positions),endOwner:state.carrier,duration:D});');
 h.run('window.qaClips=[];');h.run(clock);h.run(read('match-view-adapter.js',before));
 h.run('S=fresh();init();startMatch();resumeLive();setMatchView("3d");');
 return h;
}
const sub=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];
export function full(h,seed){
 h.run(`M.rand=R(${seed});window.qaSub=${JSON.stringify(sub)};window.qaClips=[];`);
 return h.run(`(()=>{let wall=0;for(let i=0;i<120000;i++){if(M.reason==='half')startSecondHalf();else if(M.reason==='injury')eval(qaSub);else if(M.pause&&!M.finished)resumeLive();wall+=.08;ManagerStoryLive3D.step(.08,wall*1000);if(M.finished&&!ManagerStoryLive3D.finishing)break;}const result={wall,finished:M.finished,pending:ManagerStoryLive3D.finishing,raw:JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state}),events:structuredClone(M.events),clips:structuredClone(qaClips),defaultView:M.fieldView};finishMatch();result.career=JSON.stringify(S);const once=result.career;finishMatch();result.singleResult=once===JSON.stringify(S);return result;})()`);
}
export function audit(){
 const matches=[1,8800].map(seed=>{const before=full(setup(true),seed),after=full(setup(),seed);return {seed,before,after,preserved:before.raw===after.raw&&before.career===after.career};});
 return {baseline,environment:'CPU actual engine and presentation; no WebGL or iPhone visual approval',matches};
}
if(process.argv[1]?.endsWith('match3d-round1-audit.mjs')){
 const a=audit();fs.mkdirSync('docs/qa-round1',{recursive:true});
 fs.writeFileSync('/tmp/round1-full.json',JSON.stringify(a));
 const summary={baseline,environment:a.environment,matches:a.matches.map(({seed,before,after,preserved})=>({seed,preserved,beforeSeconds:before.wall,afterSeconds:after.wall,beforeClipSeconds:before.clips.reduce((n,c)=>n+(c.duration||0),0),afterClipSeconds:after.clips.reduce((n,c)=>n+(c.duration||0),0),singleResult:after.singleResult,finished:after.finished,pending:after.pending,events:after.events.length,clips:after.clips.length,causalDeliveries:after.clips.filter(c=>c.looseResultId!=null).map(c=>({id:c.id,loose:c.looseResultId,from:c.from,to:c.to}))}))};
 fs.writeFileSync('docs/qa-round1/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}
