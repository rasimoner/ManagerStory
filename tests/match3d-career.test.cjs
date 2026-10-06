const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,playToEnd}=require('./engine-harness.cjs');
function setup(){const h=harness();for(const f of ['match3d-live-clock.js','match-view-adapter.js'])h.run(fs.readFileSync('dist/'+f,'utf8'));h.run('S=fresh();init();startMatch();resumeLive()');return h;}
test('career view and tab switches retain the engine, RNG, events and pending presentation',()=>{
 const h=setup();h.run('window.originalMatch=M;setMatchView("3d");for(let i=0;i<20;i++)ManagerStoryLive3D.step(.05,i*50);');
 const before=h.run('JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress,ManagerStoryLive3D.time])');
 for(const action of ['setMatchView("2d")','switchMatchTab("stats")','switchMatchTab("details")','switchMatchTab("pitch")','setMatchView("3d")'])h.run(action);
 assert.equal(h.run('M===originalMatch'),true);assert.equal(h.run('ManagerStoryLive3D.tempo'),1);assert.equal(before,h.run('JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress,ManagerStoryLive3D.time])'));
 h.run('pauseLive()');const paused=h.run('JSON.stringify(MatchView.read())');h.run('ManagerStoryLive3D.step(1,2000)');assert.equal(paused,h.run('JSON.stringify(MatchView.read())'));
 h.run('resumeLive()');for(const rate of [.5,1,2]){h.run(`setMatchSpeed(${rate});`);const p=h.run('pitchV73.progress'),d=h.run('pitchV73.activeDuration');h.run('ManagerStoryLive3D.step(.001,2100)');assert.ok(Math.abs(h.run('pitchV73.progress')-p-.001*rate/d)<1e-9);}
});
for(const seed of [1,8800])test(`career normal tempo seed ${seed}: same raw engine/RNG/career, half and single finish`,()=>{
 const h=setup();h.run(`M.rand=R(${seed});setMatchView("3d");`);
 const sub=fs.readFileSync('tests/engine-harness.cjs','utf8').match(/const SUBSTITUTE = '([^\n]+)';/)[1];h.run(`window.qaSub=${JSON.stringify(sub)}`);
 const measured=h.run(`(()=>{let wall=0,half=false;for(let i=0;i<120000;i++){if(M.reason==='half'){half=true;startSecondHalf();}else if(M.reason==='injury')eval(qaSub);else if(M.pause&&!M.finished)resumeLive();wall+=.08;ManagerStoryLive3D.step(.08,wall*1000);if(M.finished&&!ManagerStoryLive3D.finishing)break;}return {wall,half,finished:M.finished,pending:ManagerStoryLive3D.finishing,direction:attackDirection('user')};})()`);
 assert.ok(Math.abs(measured.wall-(seed===1?451.76:469.20))<1e-6,'normal full-match presentation duration stays unchanged');
 assert.equal(measured.finished,true);assert.equal(measured.pending,false);assert.equal(measured.half,true);assert.equal(measured.direction,-1);
 const raw='JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})';
 const base=setup();base.run(`M.rand=R(${seed})`);playToEnd(base);assert.equal(h.run(raw),base.run(raw));assert.equal(h.run('M.events.filter(e=>e.type==="end").length'),1);
 h.run('finishMatch()');base.run('finishMatch()');assert.equal(h.run('JSON.stringify(S)'),base.run('JSON.stringify(S)'));const career=h.run('JSON.stringify(S)');h.run('finishMatch()');assert.equal(h.run('JSON.stringify(S)'),career);
 console.log('normal tempo measurement',seed,JSON.stringify(measured));
});
