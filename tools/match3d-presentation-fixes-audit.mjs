import fs from 'node:fs';
import {setup as roundSetup,full} from './match3d-round2-audit.mjs';
export const baseline='a2211d851d955c9ffe2baecd23b20c8fdafccfc6';
export const setup=(before=false)=>roundSetup(before,baseline);
export {full};
export function audit(){return {baseline,matches:[1,8800].map(seed=>{const before=full(setup(true),seed),after=full(setup(),seed);return {seed,before,after,preserved:before.raw===after.raw&&before.career===after.career};})};}
if(process.argv[1]?.endsWith('match3d-presentation-fixes-audit.mjs')){
 const a=audit(),summary={baseline,environment:'CPU real engine/common clock; native RAF regression separately; visual approval pending',matches:a.matches.map(({seed,before,after,preserved})=>({seed,preserved,beforeSeconds:before.wall,afterSeconds:after.wall,beforeClips:before.clips.length,afterClips:after.clips.length,events:after.events.length,clipSeconds:after.clips.reduce((n,c)=>n+c.duration,0),singleResult:after.singleResult,drained:after.finished&&!after.pending}))};
 fs.mkdirSync('docs/qa-presentation-fixes',{recursive:true});fs.writeFileSync('docs/qa-presentation-fixes/summary.json',JSON.stringify(summary,null,2));fs.writeFileSync('/tmp/presentation-fixes-full.json',JSON.stringify(a));console.log(JSON.stringify(summary,null,2));
}
