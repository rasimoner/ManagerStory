import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {setup} from './match3d-minute-audit.mjs';
export function audit(){
 const h=setup();h.run("M.rand=R(1)");const rows=new Map();let prev=null,maxCarrySpeed=0,maxCarryBoundary=0;
 for(let i=1;i<=40000;i++){
  h.run(`ManagerStoryLive3D.step(.01,${i*10})`);const s=h.run('MatchView.read()'),e=s.presentation.activeEvent;
  if(e&&['dribble','ballCarry'].includes(e.type)){
   let r=rows.get(e.eventId);if(!r){r={eventId:e.eventId,type:e.type,success:e.success,fromId:e.fromId,toId:e.toId,from:e.fromPos,to:e.toPos,startWall:i*.01,duration:s.presentation.duration*4,maxRootBall:0,maxSpeed:0,maxLead:0,contacts:0};rows.set(e.eventId,r);}
   const root=s.players.find(p=>p.id===e.fromId).displayPosition,ball=s.ball.displayPosition,d=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
   if(s.ball.displayOwnerId===e.fromId)r.maxRootBall=Math.max(r.maxRootBall,d(root,ball));r.maxLead=Math.max(r.maxLead,s.presentation.carryMotion?.leadMetres||0);
   if(prev?.id===e.eventId){r.maxSpeed=Math.max(r.maxSpeed,d(prev.root,root)/.01);maxCarrySpeed=Math.max(maxCarrySpeed,r.maxSpeed);if(prev.phase>.9&&(s.presentation.carryMotion?.touchPhase??1)<.1)r.contacts++;}
   else if(prev){maxCarryBoundary=Math.max(maxCarryBoundary,d(prev.ball,ball));}
   prev={id:e.eventId,root,ball,phase:(s.presentation.carryMotion?.touchPhase??1)};
  }else {prev={id:null,ball:s.ball.displayPosition};}
  if(rows.size>=3&&[...rows.values()].some(r=>r.success===true)&&[...rows.values()].some(r=>r.success===false)&&!e)break;
  if(h.run('M.min')>=7)break;
 }
 return {minute:h.run("M.min"),seed:1,tempo:4,speed:1,sampleSeconds:.01,events:[...rows.values()],maxCarrySpeed,maxCarryBoundary,engineEvents:h.run('structuredClone(M.events)'),stats:h.run('structuredClone(M.stats)')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const a=audit();fs.writeFileSync('docs/qa-stage3e/carry.json',JSON.stringify(a,null,2));console.log(JSON.stringify({...a,engineEvents:undefined,stats:undefined},null,2));}
