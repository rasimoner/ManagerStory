// Offline developer recording of real deterministic MatchEngine events.
const fs=require('node:fs'),{harness}=require('../tests/engine-harness.cjs');
const h=harness();h.run(fs.readFileSync('dist/match-view-adapter.js','utf8'));
h.run('S=fresh();init();startMatch();resumeLive()');
const examples={};
for(let tick=0;tick<40&&Object.keys(examples).length<3;tick++){
 h.run('advanceLive(60/90)');
 const batch=h.run(`M.minuteEvents.filter(e=>e.type==='pass').map(e=>{
 const i=M.events.indexOf(e),touch=M.events[i+1];
 return {record:MatchView.describePass(e,touch?.type==='firstTouch'&&touch.toId===e.toId?touch:null),players:MatchView.read().players,teams:MatchView.read().teams};})`);
 for(const entry of batch){const e=entry.record.event,metres=Math.hypot((e.toPos[0]-e.fromPos[0])*1.05,(e.toPos[1]-e.fromPos[1])*.68);
 const key=e.success&&entry.record.firstTouch?(e.travelType==='aerial'&&metres>25?'long':e.travelType==='ground'&&metres<15?'short':null):!e.success&&e.toId!=null?'intercepted':null;
 if(key&&!examples[key])examples[key]={...entry,metres,source:'recorded real MatchEngine event; anatomical placement is animation-test staging'};
 }
}
if(!examples.short||!examples.long||!examples.intercepted)throw Error('Missing actual event example');
fs.writeFileSync(process.argv[2]||'dist/match3d-pass-recordings.json',JSON.stringify({schema:1,seedSource:'fresh / startMatch deterministic fixture, speed 1',examples},null,2)+'\n');
console.log(Object.fromEntries(Object.entries(examples).map(([k,v])=>[k,{eventId:v.record.event.eventId,metres:v.metres,duration:v.record.duration,contact:v.record.contactAt,arrival:v.record.arrivalAt,success:v.record.event.success}])));
