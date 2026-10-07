const test=require('node:test'),assert=require('node:assert/strict');let result;
async function audit(){return result??=(await import('../tools/match3d-stage3i-audit.mjs')).audit();}
test('real standalone gain has one contact, actual winner and continuous true continuation',async()=>{
 const a=await audit();assert.equal(a.preserved,true);assert.equal(a.metadataLeak,false);assert.equal(a.earlyOwnerChanges,0);assert.ok(a.maxSpeed<=6);assert.ok(a.boundaries.every(b=>b.ballStep<=.02&&b.rootStep<=.02));assert.ok(a.startGap<.02);
 assert.deepEqual(a.visited,[1,3,6,7,8]);const contact=a.phases.find(p=>p.threshold===.76),before=a.phases.find(p=>p.threshold===.759999),end=a.phases.at(-1);assert.equal(before.owner,6);assert.equal(contact.owner,'o10');assert.ok(contact.toeBall<=.22);assert.equal(contact.contest.eventId,5);assert.equal(end.owner,'o10');assert.ok(end.winnerGap<=.02);assert.ok(Math.hypot(end.defender[0]-51.60634863603276,end.defender[1]-46.31708598120823)<.02);
});
test('independent gain pause/rate, radar snapshot and narrative share immutable common clock',async()=>{
 const {setup}=await import('../tools/match3d-minute-audit.mjs'),h=setup();h.run('M.rand=R(1);window.wall=0;while(!pitchV73.contestMotion?.independent||pitchV73.contestMotion.progress<.65){wall+=.01;ManagerStoryLive3D.step(.01,wall*1000)}');
 assert.equal(h.run('pitchV73.queue.some(e=>[4,5].includes(e.eventId))'),false);assert.equal(h.run('MatchView.read().presentation.contestMotion.event.type'),'press');
 const expr='JSON.stringify([pitchV73.positions,pitchV73.ball,pitchV73.carrier,pitchV73.progress,ManagerStoryLive3D.time])',held=h.run(expr);h.run('M.pause=true');for(const speed of [.5,1,2]){h.run(`ManagerStoryLive3D.setSpeed(${speed});ManagerStoryLive3D.step(1,999999)`);assert.equal(h.run(expr),held);}h.run('M.pause=false');
 for(const speed of [.5,1,2]){h.run(`ManagerStoryLive3D.setSpeed(${speed})`);const p=h.run('pitchV73.progress'),D=h.run('pitchV73.activeDuration'),t=h.run('ManagerStoryLive3D.time');h.run('wall+=.001;ManagerStoryLive3D.step(.001,wall*1000)');assert.ok(Math.abs(h.run('pitchV73.progress')-p-.001*speed/8/D)<1e-8);assert.ok(Math.abs(h.run('ManagerStoryLive3D.time')-t-.001*speed/8)<1e-8);}
 assert.equal(h.run('Object.isFrozen(MatchView.read().presentation.contestMotion)'),true);assert.equal(h.run('JSON.stringify(MatchView.read().ball.displayPosition)===JSON.stringify(pitchV73.ball)'),true);
});
test('full searched 35-minute seed preserves old engine order/results/score/stats/RNG with both original decision functions',async()=>{
 const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{harness}=require('./engine-harness.cjs'),{setup}=await import('../tools/match3d-minute-audit.mjs');
 const current=setup(),old=harness(),source=execFileSync('git',['show','bc7244b:dist/pitch-v73.js'],{encoding:'utf8'});old.run(source.slice(source.indexOf('function actionMinute('),source.indexOf('function chanceV73(')));old.run(source.slice(source.indexOf('function chanceV73('),source.indexOf('function resolveShot(')));old.run('S=fresh();init();startMatch();resumeLive()');
 const drive='M.rand=R(1);for(let n=0;n<35&&!M.pause&&!M.finished;n++)advanceLive(60/90)',state='JSON.stringify({events:M.events,score:[M.hg,M.ag],stats:M.stats,shots:M.shots,players:M.playerStats,rng:M.rand.state})';current.run(drive);old.run(drive);assert.equal(current.run(state),old.run(state));
 const decisions=current.run('currentPitchState().queue.filter(e=>e.contest?.independent).map(e=>({eventId:e.eventId,resultId:e.contest.result.eventId,decision:e.contest.decision,defenderStart:e.contest.defenderStart,defenderEnd:e.contest.defenderEnd}))');
 assert.ok(decisions.some(e=>e.decision==='actionMinute'));fs.writeFileSync('docs/qa-stage3i/engine-preservation.json',JSON.stringify({seed:1,minutes:35,identical:true,compared:['events-all-fields-and-order','winners','score','team-and-player-stats','shots','RNG-state'],decisions},null,2));
});
