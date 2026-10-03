import { samplePass,createReplayClock,percent } from './match3d-pass-timeline.js';
// One inspection clock drives all posed players, ball, camera and radar.
export function createPassReplay({view,recordings,players,onFrame}){
 const clock=createReplayClock();let kind='short',entry=recordings.examples[kind],raf=0,last=null,disposed=false,lastSample=null;
 function paint(){
   const s=samplePass(entry.record,clock.time);lastSample=s;
   const metrics=view.applyPassSample(s);view.render();
   const renderedPlayers=[...view.footballers.values()].map(p=>({id:p.userData.id,side:p.userData.side,position:percent(p.position.toArray())}));
   onFrame({sample:s,metrics,entry,kind,clock,players:renderedPlayers});return {s,metrics};
 }
 function select(key){
   clock.pause();kind=key;entry=recordings.examples[key];clock.seek(-.35);last=null;
   for(const p of players){const root=view.footballers.get(`${p.side}:${p.id}`);root.position.set((p.position[0]/100-.5)*105,0,(p.position[1]/100-.5)*68);Object.values(root.userData.bones).forEach(b=>b.quaternion.identity());root.userData.bones.pelvis.position.y=.94;}
   paint();
 }
 function loop(now){if(disposed)return;const dt=last==null?0:(now-last)/1000;last=now;
   if(!clock.paused){clock.advance(dt);if(clock.time>=entry.record.endAt+.35){clock.seek(entry.record.endAt+.35);clock.pause();}paint();}
   raf=requestAnimationFrame(loop);
 }
 raf=requestAnimationFrame(loop);select(kind);
 return {clock,paint,select,get record(){return entry.record},get kind(){return kind},get sample(){return lastSample},seek(t){clock.seek(t);last=null;return paint()},play(){if(clock.time>=entry.record.endAt+.35)clock.seek(-.35);last=null;clock.play()},pause(){clock.pause()},dispose(){disposed=true;cancelAnimationFrame(raf)}};
}
