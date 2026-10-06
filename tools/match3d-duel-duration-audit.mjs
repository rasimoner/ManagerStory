// Read-only product audit. The continuous-start alternative exists ONLY in this
// isolated VM experiment: it is not loaded by the app or a second product clock.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{harness,playToEnd}=require('../tests/engine-harness.cjs');
export const sourceCommit='bd78b5e52ff24bb3d0247dcccae7ad67585c7038';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
export function setup(experiment=false,activate=true){
 const h=harness();let clock=fs.readFileSync('dist/match3d-live-clock.js','utf8');
 if(experiment){
  // Remove the coincident-root direction singularity to measure its cost.
  // This deliberately does NOT claim to solve boundary continuity or duration
  // conservation. Those are why this alternative is not shipped to the app.
  const original='let defender=p<.76?lerp(S,contact,ease(Math.max(0,Math.min(1,p/.76))))';
  if(!clock.includes(original))throw Error('Audit source no longer matches');
  clock=clock.replace(original,'const continuousStart=Math.hypot(S[0]-A[0],S[1]-A[1])<.70?A.map((v,i)=>v+normal[i]*.70):S;\n  let defender=p<.76?lerp(continuousStart,contact,ease(Math.max(0,Math.min(1,p/.76))))');
 }
 h.run(clock);h.run(fs.readFileSync('dist/match-view-adapter.js','utf8'));
 h.run('S=fresh();init();startMatch();resumeLive();window.qaWall=0;');if(activate)h.run('setMatchView("3d")');return h;
}
export function seek(h,seed=8800,id=72){h.run(`M.rand=R(${seed});for(let n=0;n<20000;n++){qaWall+=.01;ManagerStoryLive3D.step(.01,qaWall*1000);if(pitchV73.active?.eventId===${id})break;}if(pitchV73.active?.eventId!==${id})throw Error('Missing controlled example');`);}
function model(h){return h.run(`(()=>{const e=pitchV73.active,D=pitchV73.activeDuration,rows=[];let last=ManagerStoryLive3D.contestFrame(e,0);for(let i=1;i<=10000;i++){const p=i/10000,f=ManagerStoryLive3D.contestFrame(e,p);rows.push({p,a:last.attacker,b:f.attacker,c:last.defender,d:f.defender,x:last.ball,y:f.ball});last=f;}return {e,D,rows};})()`);}
export function chain(experiment=false){
 const h=setup(experiment);seek(h);const m=model(h),phases=[['preparation',0,.19],['approach',.19,.65],['reach',.65,.76],['contact/ownership',.76,.91],['recovery',.91,1]];
 const profile=phases.map(([phase,a,b])=>{const rows=m.rows.filter(r=>r.p>a&&r.p<=b);return {phase,seconds:(b-a)*m.D,peakAttacker:Math.max(...rows.map(r=>distance(r.a,r.b)*10000/m.D)),peakDefender:Math.max(...rows.map(r=>distance(r.c,r.d)*10000/m.D)),peakBall:Math.max(...rows.map(r=>distance(r.x,r.y)*10000/m.D))};});
 const resolution=[100,500,1000,10000].map(n=>({samples:n,...h.run(`(()=>{let peak=0,p=ManagerStoryLive3D.contestFrame(pitchV73.active,0),at=0;for(let i=1;i<=${n};i++){const f=ManagerStoryLive3D.contestFrame(pitchV73.active,i/${n}),v=Math.hypot((f.defender[0]-p.defender[0])*1.05,(f.defender[1]-p.defender[1])*.68)*${n};if(v>peak){peak=v;at=i/${n};}p=f;}return {peakNormalizedDefender:peak,peakPhase:at,derivedDuration:peak/24*1.02};})()`)}));
 h.run(`window.chainClips=[];window.lastClip=null;for(let n=0;n<10000;n++){const e=pitchV73.active;if(e&&e!==lastClip){chainClips.push({type:e.type,id:e.eventId,minute:e.minute,text:e.text,duration:pitchV73.activeDuration,phase:e.sampleInterval?.phase,from:e.fromPos,to:e.toPos,hold:e.type==='hold'});lastClip=e;}qaWall+=.01;ManagerStoryLive3D.step(.01,qaWall*1000);if(pitchV73.active?.eventId===81)break;}`);
 const clips=h.run('chainClips'),passes=clips.filter(e=>e.type==='pass').map(e=>({eventId:e.id,duration:e.duration,preparation:.19*e.duration,flight:.57*e.duration,recovery:.24*e.duration,metres:distance(e.from,e.to),meanDisplayBallSpeed:distance(e.from,e.to)/(.57*e.duration)}));
 return {experiment,seed:8800,eventIds:[72,73,74],videoSeedVerified:false,attacker:m.e.contest.attackerId,defender:m.e.contest.defenderId,start:m.e.contest.attackerStart,defenderStart:m.e.contest.defenderStart,end:m.e.contest.point,travelMetres:distance(m.e.contest.attackerStart,m.e.contest.point),duration:m.D,profile,resolution,clips,passes};
}
export function controls(){const rows=[];
 for(const view of ['2d','3d'])for(const speed of [.5,1,2]){const h=setup();seek(h);h.run(`setMatchView('${view}');setMatchSpeed(${speed});`);const a=h.run('JSON.stringify([pitchV73.progress,ManagerStoryLive3D.time,M.events,M.rand.state])');h.run('pauseLive();ManagerStoryLive3D.step(2,999999);');const frozen=h.run('JSON.stringify([pitchV73.progress,ManagerStoryLive3D.time,M.events,M.rand.state])')===a;h.run(`resumeLive();setMatchView('${view==='2d'?'3d':'2d'}');setMatchView('${view}');`);
  const frames=[];for(const dt of [1/60,.08,.12,2,1/60]){const before=h.run('ManagerStoryLive3D.time');h.run(`qaWall+=${dt};ManagerStoryLive3D.step(${dt},qaWall*1000);`);frames.push({dt,advance:h.run('ManagerStoryLive3D.time')-before});}
  rows.push({view,speed,pauseFrozen:frozen,frames,hiddenDebtAfterDelay:frames.at(-1).advance-(1/60*speed)});
 }return rows;}
export function full(experiment,seed){const h=setup(experiment);h.run(`M.rand=R(${seed});`);const sub=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];h.run(`window.qaSub=${JSON.stringify(sub)}`);
 const end=h.run(`(()=>{let wall=0;for(let n=0;n<120000;n++){if(M.reason==='half')startSecondHalf();else if(M.reason==='injury')eval(qaSub);else if(M.pause&&!M.finished)resumeLive();wall+=.08;ManagerStoryLive3D.step(.08,wall*1000);if(M.finished&&!ManagerStoryLive3D.finishing)break;}return {wall,pending:ManagerStoryLive3D.finishing,finished:M.finished,endCount:M.events.filter(e=>e.type==='end').length};})()`);
 const raw='JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})',base=setup(false,false);base.run(`M.rand=R(${seed})`);playToEnd(base);const engineEqual=h.run(raw)===base.run(raw);h.run('finishMatch()');base.run('finishMatch()');const careerEqual=h.run('JSON.stringify(S)')===base.run('JSON.stringify(S)'),career=h.run('JSON.stringify(S)');h.run('finishMatch()');return {experiment,seed,...end,engineEqual,careerEqual,singleCareerApply:career===h.run('JSON.stringify(S)')};}
export function audit(){const result={sourceCommit,environment:'CPU real MatchEngine and existing shared clock; no GPU or device FPS evidence',video:{file:'ScreenRecording_10-06-2026 23-55-56_1(1).mp4',observed:'15: Sinan Erdem loses → Taylan presses → wins; 16: Taylan pass; 17: Mensah pass',seedVerified:false},before:chain(),isolatedAlternative:chain(true),controls:controls(),fullMatches:[full(false,1),full(false,8800),full(true,1),full(true,8800)]};
 for(const row of result.fullMatches){assert.ok(row.engineEqual&&row.careerEqual&&row.singleCareerApply&&row.finished&&!row.pending);assert.equal(row.endCount,1);}
 for(const row of result.controls){assert.ok(row.pauseFrozen);for(const frame of row.frames)assert.ok(Math.abs(frame.advance-Math.min(frame.dt,.12)*row.speed)<1e-9);assert.ok(Math.abs(row.hiddenDebtAfterDelay)<1e-9);}
 for(const seed of [1,8800])assert.ok(Math.abs(result.fullMatches.find(r=>r.seed===seed&&!r.experiment).wall-(seed===1?451.76:469.20))<1e-6);
 return result;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=audit(),out=process.argv[2]||'docs/qa-duel-duration';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/measurements.json',JSON.stringify(result,null,2));console.log(JSON.stringify({duration:[result.before.duration,result.isolatedAlternative.duration],phases:[result.before.profile,result.isolatedAlternative.profile],fullMatches:result.fullMatches},null,2));}
