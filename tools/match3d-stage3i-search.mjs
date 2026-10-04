import fs from 'node:fs';import {setup} from './match3d-minute-audit.mjs';
const searched=[],found=[];
for(let seed=1;seed<=30;seed++){
 const h=setup();h.run(`M.rand=R(${seed});for(let n=0;n<35&&!M.pause&&!M.finished;n++)advanceLive(60/90)`);
 const gains=h.run('structuredClone(currentPitchState().queue.filter(e=>e.contest?.independent).map(e=>({eventId:e.eventId,contest:e.contest})))');
 searched.push({seed,minute:h.run('M.min'),interceptions:h.run('M.events.filter(e=>e.type==="interception").length'),independent:gains.length});
 if(gains.length){found.push({seed,...gains[0],events:h.run('structuredClone(M.events)')});break;}
}
const result={limit:{seeds:30,minutes:35},searched,found};fs.writeFileSync('docs/qa-stage3i/search.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,found:found.map(({events,...f})=>f)},null,2));
