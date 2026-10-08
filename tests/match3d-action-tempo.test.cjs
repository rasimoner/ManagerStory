const test=require('node:test'),assert=require('node:assert/strict');
const baseline='8acd5bbbf831f0e4b719ffd00bc0e7b0ba91f71c';
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1.05,(a[1]-b[1])*.68);
let cache;
async function audit(){if(cache)return cache;const {setup,full}=await import('../tools/match3d-round2-audit.mjs');return cache=[1,8800].map(seed=>({seed,before:full(setup(true,baseline),seed),after:full(setup(),seed)}));}
test('same engine/RNG/statistics/career, halftime/final drain and exactly one real action representation in both matches',async()=>{
 for(const {seed,before,after} of await audit()){
  assert.equal(after.raw,before.raw);assert.equal(after.career,before.career);assert.ok(after.finished&&!after.pending&&after.singleResult);
  const ids=after.clips.flatMap(c=>[...new Set([c.id,...c.linked])]).filter(x=>x!=null);
  for(const e of after.events.filter(e=>e.eventId!=null&&['dribble','press','tackle','interception','shot','save','goal','wide','block','post','end'].includes(e.type)))assert.equal(ids.filter(id=>id===e.eventId).length,1,`${seed}/${e.eventId} once`);
  assert.ok(after.clips.some(c=>c.gameSecond>=2700)&&after.clips.some(c=>c.gameSecond>=5400));
  console.log(JSON.stringify({seed,equalEngineRngStatsCareer:true,events:after.events.length,beforeSeconds:before.wall,afterSeconds:after.wall}));
 }
});
test('duels and keeper-limited shots share the existing movement rate; following pass/run uses visible-distance budget',async()=>{
 let duels=0,shots=0,next=0,passPeak=0;const coverage=new Set();
 for(const {seed,before,after} of await audit()){
  for(const c of after.clips){if(c.contest){duels++;const old=before.clips.find(x=>x.id===c.id&&x.contest);assert.ok(c.duration<=old.duration+1e-8);coverage.add(`duel/${c.contest.attackerKeepsBall}/${c.contest.press.minute>45?2:1}`);}
   if(c.result){shots++;coverage.add(`${c.result.type}/${c.to[0]>50?1:-1}`);const old=before.clips.find(x=>x.id===c.id&&x.result);if(c.result.type==='save')assert.ok(c.duration<=old.duration+1e-8);}
   if(['pass','cross'].includes(c.type)){const speed=distance(c.from,c.to)*(c.deliveryTiming?1/(1-Math.min(.25,.08/c.deliveryTiming.flight)/2):1.5)/(c.deliveryTiming?.flight??c.duration*.57);passPeak=Math.max(passPeak,speed);assert.ok(speed<=22.00001,`${seed}/${c.id} flight ${speed}`);}
  }
  for(let i=0;i<after.clips.length;i++){const a=after.clips[i];if(!a.contest&&!a.result)continue;
   for(const b of after.clips.slice(i+1)){if(!['enginePositionGap','pass','cross','ballCarry','dribble','run'].includes(b.type)||b.contest)break;next++;
    for(const [id,end] of Object.entries(b.endPositions)){const fraction=['ballCarry','dribble','run'].includes(b.type)&&id===String(b.fromId) ? (b.carryFromControl?1:.57) : ['pass','cross'].includes(b.type)&&id===String(b.fromId) ? (b.deliveryTiming?.preparation/b.duration||.19) : ['pass','cross'].includes(b.type)&&id===String(b.toId) ? (b.deliveryTiming?(b.deliveryTiming.preparation+b.deliveryTiming.flight)/b.duration:.76) : 1;
     const speed=distance(b.startPositions[id],end)*1.5/(b.duration*fraction);assert.ok(speed<=24.003,`${seed}/${a.id}→${b.id} ${id} root ${speed}`);
    }if(b.type!=='enginePositionGap')break;
   }
  }
 }
 for(const result of ['save','wide','goal'])for(const dir of [-1,1])assert.ok(coverage.has(`${result}/${dir}`));assert.ok([...coverage].some(c=>c.startsWith('post/'))&&[...coverage].some(c=>c.startsWith('block/')));assert.ok(next>0);console.log(JSON.stringify({duels,shots,continuations:next,passPeak,coverage:[...coverage]}));
});
test('normal and delayed frames consume only the shared capped delta, including frames that cross action boundaries',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs');const choices=[];let crossings=0,maxClips=0;
 for(const m of await audit())for(const c of m.after.clips.filter(c=>c.contest||c.result)){const key=c.contest?`duel/${c.contest.attackerKeepsBall}`:`shot/${c.result.type}/${c.result.saveType}`;if(!choices.some(x=>x.key===key))choices.push({seed:m.seed,id:c.id,key});}
 for(const item of choices){const a=setup(),b=setup();seek(a,item.seed,item.id);seek(b,item.seed,item.id);
  for(const speed of [.5,1,2]){a.run(`setMatchSpeed(${speed})`);b.run(`setMatchSpeed(${speed})`);
   for(let i=0;i<120;i++){const dt=i%3===0?.016:.12,delay=dt===.12?2:dt;
    const start=a.run('ManagerStoryLive3D.time');a.run(`ManagerStoryLive3D.step(${dt},0)`);b.run(`ManagerStoryLive3D.step(${delay},0)`);
    const snap='JSON.stringify([ManagerStoryLive3D.time,pitchV73.positions,pitchV73.ball,pitchV73.progress,pitchV73.active?.eventId,M.events,M.rand.state])';assert.equal(a.run(snap),b.run(snap));
    const r=a.run('({time:ManagerStoryLive3D.time,takes:qaFrameTakes,paused:ManagerStoryLive3D.paused})');const delta=r.time-start,used=delta>0?r.takes.reduce((n,t)=>n+t.take,0):0;
    assert.ok(delta<=Math.min(.12,dt)*speed/2+1e-9);assert.ok(used<=delta+1e-8);maxClips=Math.max(maxClips,r.takes.length);if(r.takes.length>1)crossings++;
   }
  }
 }assert.ok(crossings>0);console.log(JSON.stringify({examples:choices.length,crossingFrames:crossings,maxAdvancedClipsInFrame:maxClips,noDebt:true}));
});
test('unchanged camera follows shared time and world motion; 2D/3D/pause and half-rate remain common',async()=>{
 const {setup,seek}=await import('../tools/match3d-round2-audit.mjs'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');let cameraTravel=0,worldTravel=0;
 for(const m of await audit()){const shot=m.after.clips.find(c=>c.result?.type==='save'),h=setup();seek(h,m.seed,shot.id);const sampler=createLivePoseSampler();let prev;
  for(let i=0;i<300;i++){h.run('ManagerStoryLive3D.step(.016,0)');const snap=h.run('MatchView.read()'),s=sampler(snap);assert.equal(s.seconds,snap.presentation.seconds);if(prev){const ball=Math.hypot(s.ball[0]-prev.ball[0],s.ball[2]-prev.ball[2]),cam=Math.hypot(s.camera.focus[0]-prev.camera.focus[0],s.camera.focus[2]-prev.camera.focus[2]);cameraTravel+=cam;worldTravel+=ball;assert.ok(Number.isFinite(cam));}prev=s;}
  h.run('pauseLive()');const frozen=h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,ManagerStoryLive3D.time])');h.run('setMatchView("2d");ManagerStoryLive3D.step(2,0);setMatchView("3d")');assert.equal(h.run('JSON.stringify([pitchV73.positions,pitchV73.ball,ManagerStoryLive3D.time])'),frozen);
 }assert.ok(cameraTravel>0&&worldTravel>0);console.log(JSON.stringify({cameraTravel,worldTravel,cameraHasNoIndependentTime:true}));
});
