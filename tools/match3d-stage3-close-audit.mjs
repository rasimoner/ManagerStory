import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {setup} from './match3d-minute-audit.mjs';import {createLivePoseSampler} from '../dist/match3d-live-view.js';import {poseFootballer} from '../dist/match3d-football-pose.js';import * as T from '../dist/vendor/three/three.module.min.js';import {JOINTS} from '../dist/match3d-player.js';
const require=createRequire(import.meta.url),{harness}=require('../tests/engine-harness.cjs');
const phaseToClock=(P,p)=>{const t=P.contestMotion?.timing;if(!t)return p;for(let i=1;i<t.poseBoundaries.length;i++)if(p<=t.poseBoundaries[i])return t.boundaries[i-1]+(t.boundaries[i]-t.boundaries[i-1])*(p-t.poseBoundaries[i-1])/(t.poseBoundaries[i]-t.poseBoundaries[i-1]);return 1;};
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
function model(){const root=new T.Group(),bones=JOINTS.map(([name,,x,y,z])=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);return b;});JOINTS.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.userData.bones=Object.fromEntries(bones.map(b=>[b.name,b]));return root;}
export function audit(baseline=false){
 const h=setup();if(baseline)h.run(fs.readFileSync('tools/fixtures/stage3i-clock.js','utf8')+'\nManagerStoryLive3D.enable()');if(baseline)h.run(fs.readFileSync('tools/fixtures/stage3i-adapter.js','utf8'));
 h.run('M.rand=R(1)');const sample=createLivePoseSampler(),m=model(),phases=[],boundaries=[],visited=[],rows=[];let old,wall=0,maxSpeed=0,earlyOwnerChanges=0,metadataLeak=false,startGap=null,minSeparation=Infinity;
 for(let i=0;i<30000;i++){
  const before=h.run('MatchView.read()'),e=before.presentation.activeEvent,p=before.presentation.progress;let dt=.01;
  if(e?.eventId>=3&&e.eventId<=13){const b=[.1,.65,.759999,.76,.91,.999999].find(x=>x>p+1e-8);if(b)dt=Math.min(dt,(phaseToClock(before.presentation,b)-(before.presentation.clockProgress??p))*before.presentation.duration*4+1e-10);}
  if(e?.eventId>=3&&e.eventId<=13&&p>=.999999)dt=Math.min(dt,1e-6);
  wall+=dt;h.run(`ManagerStoryLive3D.step(${dt},${wall*1000})`);const s=h.run('MatchView.read()'),P=s.presentation,event=P.activeEvent,view=sample(s),roots=Object.fromEntries(s.players.map(p=>[String(p.id),p.displayPosition]));
  const f={id:event?.eventId,type:event?.type,p:P.progress,owner:s.ball.displayOwnerId,ball:s.ball.displayPosition,roots,wall};
  if(old&&((event?.eventId>=3&&event.eventId<=13)||(old.id>=3&&old.id<=13))){maxSpeed=Math.max(maxSpeed,...Object.keys(roots).map(id=>distance(old.roots[id],roots[id])/dt));if(old.id!==f.id||old.type!==f.type)boundaries.push({from:old.id??old.type,to:f.id??f.type,ballStep:distance(old.ball,f.ball),rootStep:Math.max(...Object.keys(roots).map(id=>distance(old.roots[id],roots[id])))});}
  if(event?.eventId!=null&&visited.at(-1)!==event.eventId)visited.push(event.eventId);
  if([3,6,7,8].includes(event?.eventId)){minSeparation=Math.min(minSeparation,distance(roots["6"],roots.o10));if(startGap==null)startGap=distance(roots.o10,[50.29731347691869,49.033443025429925]);const expected=event.eventId===3?(P.progress<.76?6:'o10'):event.eventId===6?(P.progress<.76?'o10':null):event.eventId===7?null:P.progress<.76?null:6;if(f.owner!==expected)earlyOwnerChanges++;
   for(const threshold of [.1,.65,.759999,.76,.91,.999999])if(Math.abs(P.progress-threshold)<1e-7&&!phases.some(x=>x.threshold===threshold&&x.eventId===event.eventId)){
    const who=event.eventId===8?6:'o10',pose=view.poses.find(p=>p.id===who),toe=poseFootballer(m,pose).rightToe;
    phases.push({eventId:event.eventId,threshold,owner:f.owner,attacker:roots['6'],defender:roots.o10,ball:f.ball,toeBall:toe.distanceTo(new T.Vector3(...view.ball)),clearance:distance(roots['6'],roots.o10),winnerGap:distance(roots[String(who)],f.ball),contest:P.contestMotion?{independent:P.contestMotion.independent,decision:P.contestMotion.decision,eventId:P.contestMotion.event.eventId}:null});
   }
  }
  if(i%5===0&&event?.eventId>=3&&event.eventId<=13)rows.push(f);old=f;if(event?.eventId===15&&P.progress>=.19)break;
 }
 const minute=h.run('M.min'),newState=h.run('structuredClone({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})');metadataLeak=newState.events.some(e=>e.contest||e.enginePositions||e.gainStart);
 const raw=harness(),source=execFileSync('git',['show','805cc0b:dist/pitch-v73.js'],{encoding:'utf8'});raw.run(source.slice(source.indexOf('function actionMinute('),source.indexOf('function chanceV73(')));raw.run(source.slice(source.indexOf('function chanceV73('),source.indexOf('function resolveShot(')));
 raw.run(`S=fresh();init();startMatch();M.rand=R(1);resumeLive();for(let n=0;n<${minute};n++)advanceLive(60/90)`);const oldState=raw.run('structuredClone({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})');
 return {baseline,seed:1,minute,wall,startGap,minSeparation,maxSpeed,earlyOwnerChanges,metadataLeak,visited,phases,boundaries,preserved:JSON.stringify(newState)===JSON.stringify(oldState),newState,oldState,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result={before:audit(true),after:audit()};fs.writeFileSync('docs/qa-stage3-close/measurements.json',JSON.stringify(result,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,{newState,oldState,rows,...v}])=>[k,v])),null,2));}
