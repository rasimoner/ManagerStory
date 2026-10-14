const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'../dist');
const sources=['match-support.js','career-events.js','live-match.js','opponents-v731.js','pitch-v73.js','pitch-v731.js','app.js'].map(file=>fs.readFileSync(path.join(base,file),'utf8'));
function harness(existing=new Map()){
 const alerts=[],confirms=[];
 const app={innerHTML:'',classList:{toggle(){}},insertAdjacentHTML(_where,html){this.innerHTML+=html}};
 const ctx={console,structuredClone,AbortController,URL,Blob,setTimeout,clearTimeout,Math,
  localStorage:{getItem:key=>existing.get(key)||null,setItem:(key,val)=>existing.set(key,val),removeItem:key=>existing.delete(key)},
  document:{body:{classList:{toggle(){}}},querySelector(q){if(q==='#app')return app;if(q==='.bottomnav')return app.innerHTML.includes('class=bottomnav')?{}:null;return null;}},
  alert:message=>alerts.push(message),confirm:message=>{confirms.push(message);return true},prompt:()=>null};
 ctx.window=ctx;ctx.window.scrollTo=()=>{};vm.createContext(ctx);
 for(const source of sources)vm.runInContext(source,ctx);
 return {run:code=>vm.runInContext(code,ctx),app,storage:existing,alerts,confirms};
}
function finishLiveGame(h){
 h.run('resumeLive();advanceLive(30)');
 // a seeded injury can legitimately stop the first half; handle it like the second-half helper does
 for(let tries=0;h.run('M.reason')==='injury'&&tries<6;tries++){h.run('(function(){window.OUT=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const outP=S.players.find(p=>p.id===window.OUT);const subP=S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&p.injury===0&&positionPenaltyV61(p,M.matchRoles[window.OUT])>=.7);if(subP)doSub(subP.id);else if(outP)outP.injury=0;resumeLive()})()');h.run('advanceLive(30)');}
 assert.equal(h.run('M.reason'),'half');
 h.run("teamTalk('belief');startSecondHalf()");
 completeSecondHalf(h);
 assert.equal(h.run('M.min'),90);
 assert.equal(h.run('M.finished'),true);
 h.run('finishMatch()');
}
function completeSecondHalf(h){
 let tries=0;
 while(!h.run('M.finished')&&tries++<12){
  h.run('advanceLive(40)');
  if(h.run('M.reason')==='injury'){
   h.run("window.OUT=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const out=S.players.find(p=>p.id===window.OUT);const sub=S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&p.injury===0&&positionPenaltyV61(p,M.matchRoles[window.OUT])>=.7);if(sub)doSub(sub.id);else S.players.find(p=>p.id===window.OUT).injury=0;resumeLive()");
  } else if(h.run('M.pause')&&!h.run('M.finished'))h.run('resumeLive()');
 }
 assert.ok(tries<12,'second half completes after any required injury substitution');
}
function chooseCurrent(h){h.run('choose(S.event.choices[0][1])')}
test('career, press, tactical tabs, instruction, substitution, two league rounds, save and load',()=>{
 const h=harness();assert.match(h.app.innerHTML,/Yeni Kariyer/);
 h.run('S=fresh();init();render()');
 assert.equal(h.run('S.table.length'),18);assert.equal(h.run('S.leagueSchedule.length'),34);assert.equal(h.run('S.players.length'),16);
 assert.match(h.app.innerHTML,/ANADOLU HİSARI GAZETESİ/);
 h.run("choose('ambitious');completeOfficeDay()");
 assert.equal(h.run('S.event.kind'),'press');assert.ok(h.run('S.event.choices.length')>=3);
 const firstQuestion=h.run('S.event.questionId');chooseCurrent(h);
 assert.equal(h.run('S.event.kind'),'matchday');h.run("modal='formation';render()");assert.match(h.app.innerHTML,/Maça Geç/);
 h.run('startMatch()');assert.equal(h.run('M.min'),0);
 for(const [key,title] of [['details','Detaylar'],['pitch','Saha'],['stats','İstatistik'],['tactics','Taktik']]){
  h.run(`switchMatchTab('${key}')`);assert.match(h.app.innerHTML,new RegExp('aria-selected="true"[^>]*>'+title));assert.equal(h.run('M.min'),0);
 }
 h.run("setMatchTactic('tempo','Yüksek')");assert.equal(h.run('M.tempo'),'Yüksek');
 h.run("switchMatchTab('pitch');openMatchPlayer(12)");assert.match(h.app.innerHTML,/Maç puanı <b>6.5/);
 h.run("setMatchOrder(12,'runBehind')");assert.equal(h.run('M.orderKeys[12]'),'runBehind');
 h.run('window.OUT=12;subUI()');assert.match(h.app.innerHTML,/Mensah.*ST/);assert.match(h.app.innerHTML,/Oğuz/);
 h.run('doSub(13)');assert.ok(h.run('M.active.includes(13)&&!M.active.includes(12)'));assert.equal(h.run('M.substitutions.length'),1);
 const state=h.storage.get('msv4');assert.ok(state.length>1000);
 const reloaded=harness(new Map([['msv4',state]]));assert.equal(reloaded.run('M.min'),0);assert.equal(reloaded.run('M.tempo'),'Yüksek');assert.ok(reloaded.run('M.active.includes(13)'));
 finishLiveGame(reloaded);assert.equal(reloaded.run('S.results.length'),1);assert.equal(reloaded.run('S.table.reduce((n,x)=>n+x.p,0)'),18);assert.match(reloaded.app.innerHTML,/Önemli Anlar/);
 assert.equal(reloaded.run('S.event.kind'),'postpress');assert.ok(reloaded.run('S.event.choices.length')>=3);const post1=reloaded.run('S.event.questionId');
 chooseCurrent(reloaded);assert.equal(reloaded.run('S.day'),5);chooseCurrent(reloaded);
 assert.equal(reloaded.run('S.week'),2);chooseCurrent(reloaded);
 assert.equal(reloaded.run('S.day'),2);assert.equal(reloaded.run('S.event.kind'),'meeting');assert.match(reloaded.app.innerHTML,/kapını çalıyor/);
 chooseCurrent(reloaded);assert.equal(reloaded.run('S.day'),3);assert.equal(reloaded.run('S.event.kind'),'press');assert.notEqual(reloaded.run('S.event.questionId'),firstQuestion);
 chooseCurrent(reloaded);assert.equal(reloaded.run('S.event.kind'),'matchday');
 const nextOpponent=reloaded.run('currentOpponent()[0]');assert.notEqual(nextOpponent,'Ormanşehir');
 reloaded.run('startMatch()');finishLiveGame(reloaded);assert.equal(reloaded.run('S.results.length'),2);assert.equal(reloaded.run('S.table.reduce((n,x)=>n+x.p,0)'),36);
 assert.notEqual(reloaded.run('S.event.questionId'),post1);
 for(const [name,fn] of [['Lig','showLeague()'],['Kadro',"modal='squad';render()"],['Taktik',"modal='plan';render()"],['Transfer','showV6Transfers()'],['Akademi','showAcademy()']]){
  reloaded.run(fn);assert.match(reloaded.app.innerHTML,new RegExp('Ana navigasyon|bottomnav'));assert.ok(reloaded.app.innerHTML.includes(name));
 }
 assert.doesNotMatch(reloaded.app.innerHTML,/(?:NaN|undefined)/);
 assert.equal(reloaded.alerts.length,0);
});
test('old W/D/L saves migrate without losing fixtures, budgets, players, or archive',()=>{
 const h=harness();h.run('S=fresh();init();S.budget=7345678;S.players[0].fitness=63;S.form["Anadolu Hisarı"]=["W","D","L"];S.event={kind:"training",title:"Önceki kayıt",choices:[["İlerle","tactics"]]};S.v71=undefined;save()');
 const raw=h.storage.get('msv4');h.storage.delete('msv4-v70-backup');
 const migrated=harness(h.storage);assert.equal(migrated.run('S.budget'),7345678);assert.equal(migrated.run('S.players[0].fitness'),63);
 assert.equal(JSON.stringify(migrated.run('S.form["Anadolu Hisarı"]')),JSON.stringify(['G','B','M']));
 assert.match(migrated.run('formDots()'),/>G<.*>B<.*>M</);
 assert.equal(migrated.storage.get('msv4-v70-backup'),raw);assert.equal(migrated.run('S.leagueSchedule.length'),34);
 migrated.run('showLeague()');assert.doesNotMatch(migrated.app.innerHTML,/\b[WDL]\b/);
});
test('goal, card, tactical and fitness events are tied to the running match',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run('M.min=66;S.players.find(p=>p.id===12).fitness=43;render()');assert.match(h.app.innerHTML,/fitness yüzde 43, kritik/);
 h.run("recordMatchCard(userSide(),12)");assert.equal(h.run('M.stats.yellow[userSide()]'),1);
 h.run("recordMatchCard(userSide(),12)");assert.equal(h.run('M.stats.red[userSide()]'),1);assert.equal(h.run('M.active.includes(12)'),false);
 h.run("M.activeTab='details';render()");assert.match(h.app.innerHTML,/Kırmızı kart/);
 h.run("M.activeTab='stats';render()");assert.match(h.app.innerHTML,/Pas yüzdesi/);
 h.run("M.activeTab='tactics';setMatchTactic('line','Önde')");assert.equal(h.run('M.line'),'Önde');assert.equal(h.run('M.events.at(-1).type'),'tactic');
 h.run('window.OUT=0;subUI()');assert.equal(h.run('doSub(14)'),true);assert.ok(h.confirms.at(-1).includes('YİNE DE OYNAT'));assert.ok(h.run('M.positionSuitability[14]')<1);
 assert.ok(h.storage.get('msv4').includes('"rngState"'));
});
test('press pools have 25+ templates, choices, no near repeats and conditional player meetings',()=>{
 const h=harness();h.run('S=fresh();init()');
 assert.ok(h.run('PRE_PRESS.length')>=25);assert.ok(h.run('POST_PRESS.length')>=25);assert.ok(h.run('PLAYER_MEETINGS.length')>=15);
 assert.ok(h.run('PRE_PRESS.every(q=>q[3].length>=3)&&POST_PRESS.every(q=>q[4].length>=3)'));
 let seen=[];
 for(let week=1;week<=7;week++){
  h.run(`S.week=${week};S.fixture=${week-1};S.event=makeV71PrePress()`);seen.push(h.run('S.event.questionId'));
 }
 assert.equal(new Set(seen).size,seen.length);
 const reasons=new Set();for(let week=2;week<=24;week+=2){h.run(`S.week=${week};S.players.forEach(p=>{p.happiness=65;p.fitness=69;p.form=78})`);const kind=h.run('buildPlayerMeeting()?.meetingKind');if(kind)reasons.add(kind)}
 assert.ok(reasons.size>=4,`different player conversations: ${[...reasons]}`);
});
test('transfer and academy still use existing budgets, roster and cinematic flow',()=>{
 const h=harness();h.run('S=fresh();init();S.budget=100000000;render()');
 assert.equal(h.run('S.v6.transferPool.length'),110);
 assert.equal(h.run('S.v6.academy.length'),5);
 assert.equal(h.run('S.v6.cup.alive'),true);
 const before=h.run('S.players.length');const originalBudget=h.run('S.budget');
 h.run('v6Sign(S.v6.transferPool[0].id,asking(S.v6.transferPool[0]))');
 assert.equal(h.run('S.players.length'),before+1);assert.ok(h.run('S.budget')<originalBudget);assert.match(h.app.innerHTML,/İMZA TÖRENİ/);
 h.run('runCinematicNext()');assert.equal(h.run('S.players.length'),before+1);
 const promoted=h.run('S.v6.academy[0].name');h.run("promoteV6(S.v6.academy[0].id,'warm')");
 assert.equal(h.run('S.players.length'),before+2);assert.equal(h.run('S.players.at(-1).status'),'Altyapıdan A takım');assert.match(h.app.innerHTML,/İLK A TAKIM ANTRENMANI/);
 assert.equal(h.run('S.v6.cup.alive'),true);
 assert.ok(h.run('S.inbox.length')>=3);
 assert.equal(typeof promoted,'string');
});
test('academy replenishment never repeats promoted candidate identities across save and refresh',()=>{
 const h=harness();h.run('S=fresh();init()');
 const promotedIds=[],promotedPrints=[];
 for(let i=0;i<3;i++){
  promotedIds.push(h.run('S.v6.academy[0].id'));promotedPrints.push(h.run('academyFingerprint(S.v6.academy[0])'));
  h.run("promoteV6(S.v6.academy[0].id,'calm')");
  assert.equal(h.run('S.v6.academy.length'),5);
 }
 assert.equal(new Set(promotedIds).size,3);
 assert.equal(h.run(`S.v6.academy.some(x=>${JSON.stringify(promotedIds)}.includes(x.id)||${JSON.stringify(promotedPrints)}.includes(academyFingerprint(x)))`),false);
 h.run('save()');const reopened=harness(h.storage);reopened.run('refreshAcademy()');
 assert.equal(reopened.run(`S.v6.academy.some(x=>${JSON.stringify(promotedIds)}.includes(x.id)||${JSON.stringify(promotedPrints)}.includes(academyFingerprint(x)))`),false);
 assert.ok(reopened.run('S.v6.usedAcademyCandidateIds.length>=3'));
});
test('every offline asset exists and legacy GIFs are static atmospheric frames',()=>{
 const assetsDir=path.join(base,'assets');
 const sw=fs.readFileSync(path.join(base,'sw.js'),'utf8');
 const assets=[...sw.matchAll(/"(\.\/[^"\n]+)"/g)].map(x=>x[1].slice(2).split('?')[0]);
 assert.ok(assets.length>=29);
 for(const rel of assets)assert.ok(fs.statSync(path.join(base,rel)).size>0,rel);
 assert.ok(assets.includes('match-support.js')&&assets.includes('career-events.js')&&assets.includes('live-match.js')&&assets.includes('pitch-v73.js'));
 assert.ok(assets.includes('opponents-v731.js')&&assets.includes('pitch-v731.js'));
 for(const file of ['stadium','press','office','fans','training','signing','facilities']){
  const image=path.join(assetsDir,'atmosphere',`${file}.webp`);assert.ok(fs.statSync(image).size>50000,file);
 }
 const {execFileSync}=require('node:child_process');
 const result=execFileSync('python',['-c',`from pathlib import Path\nfrom PIL import Image\nfor p in Path('${assetsDir}/cinematics').glob('*.gif'):\n im=Image.open(p); assert im.n_frames==1,p\nprint('static legacy GIFs verified')`],{encoding:'utf8'});
 assert.match(result,/verified/);
});
test('live clock runs 45 minutes unaided, stops at half, resumes to exact 90:00',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 assert.equal(h.run('M.pause'),false);assert.equal(h.run('matchClock()'),'00:00');
 h.run('advanceLive(12.345)');assert.match(h.run('matchClock()'),/^18:/);
 assert.ok(h.run('M.events.some(e=>e.type==="pass" && e.fromId!=null && e.toId!=null)'));
 h.run('advanceLive(30);render()');assert.equal(h.run('M.min'),45);assert.equal(h.run('M.clockSeconds'),2700);
 assert.equal(h.run('M.pause'),true);assert.equal(h.run('M.reason'),'half');assert.match(h.app.innerHTML,/DEVRE ARASI/);
 const count=h.run('M.events.length');h.run('advanceLive(100)');assert.equal(h.run('M.events.length'),count);
 h.run("teamTalk('demand');startSecondHalf()");completeSecondHalf(h);h.run('render()');
 assert.equal(h.run('matchClock()'),'90:00');assert.equal(h.run('M.finished'),true);
 assert.equal(h.run('M.events.filter(e=>e.type==="goal").length'),h.run('M.hg+M.ag'));
 assert.equal(h.run('M.events.filter(e=>e.type==="shot").length'),h.run('M.shots[0]+M.shots[1]'));
 assert.doesNotMatch(h.app.innerHTML,/(?:NaN|undefined)/);
});
test('pause, touch and substitution freeze simulation and preserve position and event history',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();advanceLive(8)');
 const sec=h.run('M.clockSeconds'),before=h.run('M.events.length');
 h.run('openMatchPlayer(12)');assert.equal(h.run('M.pause'),true);assert.match(h.app.innerHTML,/Topla buluşma/);
 h.run('advanceLive(100)');assert.equal(h.run('M.clockSeconds'),sec);assert.equal(h.run('M.events.length'),before);
 h.run("setMatchOrder(12,'runBehind')");assert.equal(h.run('M.orderKeys[12]'),'runBehind');assert.equal(h.run('M.pause'),true);
 h.run('window.OUT=12;subUI();doSub(13)');assert.equal(h.run('M.active.includes(12)'),false);
 const start=h.run('M.events.length');h.run('resumeLive();advanceLive(3)');
 assert.ok(h.run('M.clockSeconds')>sec);
 const departed=h.run(`M.events.slice(${start}).filter(e=>e.playerId===12||e.fromId===12||e.toId===12)`);
 assert.equal(departed.length,0,JSON.stringify(departed));
 assert.ok(h.run('S.players.find(p=>p.id===13).fitness')<100);
 assert.equal(h.run('M.ballSide==="user" ? M.active.includes(M.ballOwner) : M.ballSide==="opp" ? M.oppIds.includes(M.ballOwner) : true'),true);
});
test('playback speeds change wall time only, while seeded MatchEvents remain identical',()=>{
 const signatures=[];
 for(const speed of [.5,1,2]){
  const h=harness();h.run('S=fresh();init();startMatch()');h.run(`setMatchSpeed(${speed});advanceLive(${30/speed})`);
  assert.equal(h.run('M.min'),45);assert.equal(h.run('M.reason'),'half');
  signatures.push(JSON.stringify(h.run('({score:[M.hg,M.ag],stats:M.stats,events:M.events.map(e=>[e.type,e.fromId,e.toId,e.playerId,e.text])})')));
 }
 assert.equal(signatures[0],signatures[1]);assert.equal(signatures[1],signatures[2]);
});
test('live save resumes at the same second and V7.1 career is backed up without replacing game data',()=>{
 const h=harness();h.run('S=fresh();init();S.version="7.1";delete S.v72;S.budget=7234567;save()');
 const old=h.storage.get('msv4');const migrated=harness(h.storage);
 assert.equal(migrated.storage.get('msv4-v71-backup'),old);assert.equal(migrated.run('S.budget'),7234567);
 migrated.run('startMatch();advanceLive(9.18);pauseLive()');const snap=migrated.storage.get('msv4');
 const reopened=harness(new Map([['msv4',snap]]));
 assert.equal(reopened.run('M.clockSeconds'),migrated.run('M.clockSeconds'));
 assert.equal(reopened.run('M.events.length'),migrated.run('M.events.length'));
 assert.equal(reopened.run('M.pause'),true);
 reopened.run('resumeLive();advanceLive(1)');assert.ok(reopened.run('M.clockSeconds')>migrated.run('M.clockSeconds'));
});
test('shouts have a ten-minute effect cooldown and tactical state survives pause',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();advanceLive(6);pauseLive()');
 h.run("shoutLive('press');setMatchTactic('press','Yüksek')");
 assert.equal(h.run('M.press'),'Yüksek');assert.equal(h.run('M.pause'),true);
 const morale=h.run('S.players.find(p=>p.id===6).morale');h.run("shoutLive('press')");
 assert.equal(h.run('S.players.find(p=>p.id===6).morale'),morale);assert.match(h.alerts.at(-1),/10 oyun dakikası/);
 h.run('resumeLive();advanceLive(8)');assert.ok(h.run('M.events.some(e=>e.type==="shout")'));
});
test('horizontal goals, keeper placement, halftime reversal and instruction offsets are physical coordinates',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');assert.equal(h.run('M.fieldView'),'3d');h.run('setMatchView("2d")');
 assert.match(h.app.innerHTML,/pitch-goal-left.*pitch-goal-right/);
 assert.ok(h.run("basePitchPosition(0,'user')[0]")<15);
 assert.ok(h.run("basePitchPosition('o0','opp')[0]")>85);
 const normal=h.run("pitchInstructionTarget(6,'user',[50,50],'user')[0]");
 h.run("M.orderKeys[6]='step'");assert.ok(h.run("pitchInstructionTarget(6,'user',[50,50],'user')[0]")>normal+8);
 h.run("M.orderKeys[6]='stay'");assert.ok(h.run("pitchInstructionTarget(6,'user',[50,50],'user')[0]")<normal-8);
 const wing=h.run("M.active.find(id=>M.matchRoles[id]==='LW')");
 const wideY=h.run(`pitchInstructionTarget(${wing},'user',[65,50],'user')[1]`);
 h.run(`M.orderKeys[${wing}]='inside'`);
 assert.ok(Math.abs(h.run(`pitchInstructionTarget(${wing},'user',[65,50],'user')[1]`)-50)<Math.abs(wideY-50));
 h.run('resetPitchHalf()');assert.ok(h.run("basePitchPosition(0,'user')[0]")>85);
 assert.ok(h.run("basePitchPosition('o0','opp')[0]")<15);
 assert.match(h.run('matchPitch()'),/← ANADOLU HİSARI HÜCUMU/);
});
test('readable ball timing varies by distance, pass skill and viewing speed without RNG changes',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 const short=h.run("eventAnimationTime({type:'pass',fromId:10,fromSide:'user',fromPos:[25,50],toPos:[30,50]})");
 const long=h.run("eventAnimationTime({type:'pass',fromId:10,fromSide:'user',fromPos:[25,50],toPos:[65,50]})");
 assert.ok(long>short+.4);
 h.run('M.speed=.5');assert.ok(h.run("eventAnimationTime({type:'pass',fromId:10,fromSide:'user',fromPos:[25,50],toPos:[65,50]})")>long);
 const slow=h.run('playerMoveRate(2,\'user\')');const quick=h.run('playerMoveRate(12,\'user\')');assert.ok(quick>slow*1.25);
 h.run('S.players.find(p=>p.id===12).fitness=35');assert.ok(h.run('playerMoveRate(12,\'user\')')<quick*.85);
});
test('generated match events include carrying, off ball runs, pressure, tackles and restarts',()=>{
 const h=harness();h.run("S=fresh();init();startMatch();M.orderKeys[12]='runBehind';advanceLive(25)");
 const types=h.run('new Set(M.events.map(e=>e.type))');
 for(const type of ['kickoff','pass','ballCarry','offBallRun','press','tackle','shot'])assert.ok(types.has(type),type);
 assert.ok(h.run('M.playerStats[12].runs')>0);
 assert.ok(h.run('M.events.filter(e=>e.type===\'pass\').every(e=>e.passKind&&Number.isFinite(e.distance))'));
 assert.ok(h.run('M.events.filter(e=>e.type===\'shot\').every(e=>[\'goal\',\'save\',\'block\',\'post\',\'wide\'].includes(e.outcome))'));
 assert.ok(h.run('M.events.every(e=>e.type!==\'throwIn\'||e.restartType===\'THROW_IN\')'));
 assert.ok(h.run('M.stats.tackles.every(Number.isFinite)'));
});
test('V7.2 career save is preserved and upgraded on load',()=>{
 const h=harness();h.run('S=fresh();init();S.version="7.2";S.budget=7732100;delete S.v73;save()');
 const original=h.storage.get('msv4'),restored=harness(h.storage);
 assert.equal(restored.storage.get('msv4-v72-backup'),original);
 assert.equal(restored.run('S.budget'),7732100);
 assert.equal(restored.run('S.version'),'7.4.2');assert.equal(restored.run('S.v73.schema'),1);
});
test('goal kick begins in six-yard area and cannot fall back to kickoff',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');const before=h.run('M.events.filter(e=>e.type==="kickoff").length');
 h.run('startPitchRestart("GOAL_KICK","opp",[102,27])');
 assert.equal(h.run('M.restart.restartType'),'GOAL_KICK');
 assert.equal(h.run('M.restart.restartPhase'),'LIVE');
 const restart=h.run('M.events.findLast(e=>e.type==="goalKick")');
 assert.equal(restart.fromPos[0],95.5);assert.ok([44,56].includes(restart.fromPos[1]));
 assert.ok(['short','medium','long'].includes(restart.passKind));
 assert.equal(h.run('M.events.filter(e=>e.type==="kickoff").length'),before);
 assert.match(h.run('matchPitch()'),/pitch-goal-area-left.*pitch-goal-area-right/);
});
test('corner and throw-in use their own touchline coordinates and ordered restart phases',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run('startPitchRestart("CORNER","user",[102,-3])');
 const corner=h.run('M.events.findLast(e=>e.type==="corner")');
 assert.deepEqual(Array.from(corner.fromPos),[98,2]);assert.ok(corner.toPos[0]>80);
 assert.equal(corner.restartType,'CORNER');
 const before=h.run('M.events.filter(e=>e.type==="kickoff").length');
 h.run('startPitchRestart("THROW_IN","opp",[37,103])');
 const throwIn=h.run('M.events.findLast(e=>e.type==="throwIn")');
 assert.deepEqual(Array.from(throwIn.fromPos),[37,98]);
 assert.equal(h.run('M.events.filter(e=>e.type==="kickoff").length'),before);
 assert.deepEqual(Array.from(h.run('M.events.slice(-5).map(e=>e.type)')),
  ['ballOut','restartPosition','restartPlayers','restartWait','throwIn']);
});
test('goal alone restarts at the centre and a missed shot performs a goal kick',()=>{
 const goal=harness();goal.run('S=fresh();init();startMatch();M.rand=()=>0;chanceV73(true)');
 assert.ok(goal.run('M.events.some(e=>e.type==="goal")'));
 assert.equal(goal.run('M.events.at(-1).type'),'kickoff');
 assert.deepEqual(Array.from(goal.run('M.events.at(-1).fromPos')),[50,50]);
 const wide=harness();wide.run('S=fresh();init();startMatch();M.rand=()=>.99;chanceV73(true)');
 assert.equal(wide.run('M.events.findLast(e=>e.type==="goalKick").restartType'),'GOAL_KICK');
 assert.equal(wide.run('M.events.filter(e=>e.type==="kickoff").length'),1);
});
test('long passes rise with a shadow; short passes stay on the ground and travel through intermediate positions',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 const long={type:'pass',passKind:'long',fromPos:[15,27],toPos:[72,48]};
 const short={type:'pass',passKind:'short',fromPos:[15,27],toPos:[20,27]};
 h.run('M.speed=.5');
 const duration=h.run('eventAnimationTime({type:"pass",passKind:"long",fromPos:[15,27],toPos:[72,48]})');
 assert.ok(duration>=.55&&duration<=.9);
 assert.ok(h.run('aerialHeight({type:"pass",passKind:"long"},.5)')>.9);
 assert.equal(h.run('aerialHeight({type:"pass",passKind:"short"},.5)'),0);
 assert.ok(h.run('animationPoint({type:"pass",fromPos:[15,27],toPos:[72,48]},.5,[15,27])[0]')>15);
 assert.ok(h.run('animationPoint({type:"pass",fromPos:[15,27],toPos:[72,48]},.5,[15,27])[0]')<72);
 assert.ok(h.run('eventAnimationTime({type:"pass",fromPos:[15,27],toPos:[20,27]})')<duration);
});
test('keeper and striker separate gently; corner crowd does not collapse to one point',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run('pitchV73.positions={"0":[10,50],"12":[10,50],"o0":[10,50]};softenPlayerOverlap(pitchV73.positions)');
 assert.notDeepEqual(Array.from(h.run('pitchV73.positions["0"]')),Array.from(h.run('pitchV73.positions["12"]')));
 h.run('startPitchRestart("CORNER","user",[102,-3])');
 const positions=h.run('pitchFrameState(.35,500).positions');
 const coords=Object.values(positions).map(x=>x.map(n=>Math.round(n)).join(','));
 assert.ok(new Set(coords).size>=16);
});
test('save variations and rebounds produce loose ball events before a new owner is selected',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 const events=[];
 for(let i=0;i<120;i++){
  h.run(`M.rand=R(${123456+i});M.dynamicPositions[12]=[82,50];setUserOwner(12);chanceV73(true)`);
  const e=h.run('M.events.findLast(e=>e.type==="save")');if(e)events.push(e.saveType);
  if(events.includes('PARRY')&&events.includes('DEFLECT_CORNER'))break;
 }
 assert.ok(events.includes('PARRY'));
 assert.ok(events.includes('DEFLECT_CORNER'));
 assert.ok(h.run('M.events.some((e,i,all)=>e.type==="save"&&e.saveType==="PARRY"&&all.slice(i+1,i+3).some(x=>x.type==="looseBall"))'));
 h.run('makeLooseBall([98,40],[90,50],"post","user")');
 assert.equal(h.run('M.events.at(-2).type'),'looseBall');assert.equal(h.run('M.events.at(-1).type'),'recovery');
});
test('opponent roster identities, attributes, fatigue, evolution and V7.3 migration persist',()=>{
 const h=harness();h.run('S=fresh();init()');
 assert.equal(h.run('Object.keys(S.opponentSquads).length'),17);
 assert.ok(h.run('Object.values(S.opponentSquads).every(team=>team.length>=16&&team.every(p=>p.id&&p.name&&p.pace&&p.gk!==undefined))'));
 h.run('startMatch()');const first=h.run('M.oppLineup.o9');
 assert.equal(h.run('opponentPlayer("o9").id'),first);
 const other=h.run('S.opponentSquads[currentOpponent()[0]][9]');
 assert.equal(h.run('baseAttribute("o9","opp","pace",0)'),other.pace);
 // the effective value is derived from the stored one (fitness/age), never above it and never a cliff below it
 const eff=h.run('playerAttribute("o9","opp","pace",0)');
 assert.ok(eff<=other.pace&&eff>=other.pace*.8);
 h.run('evolveOpponentSquads(S.fixture)');assert.equal(h.run('S.v731.lastEvolvedFixture'),0);
 h.run('S.version="7.3";save()');const original=h.storage.get('msv4');
 const reopened=harness(h.storage);
 assert.equal(reopened.storage.get('msv4-v73-backup'),original);
 assert.equal(reopened.run('S.version'),'7.4.2');
 assert.equal(reopened.run('M.oppLineup.o9'),first);
});
test('one ball state tracks owners and restarts without extra kickoffs',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 assert.equal(h.run('M.ballState.ownerId'),h.run('M.ballOwner'));
 h.run('startPitchRestart("FREE_KICK","user",[46,28])');
 assert.equal(h.run('M.restart.restartType'),'FREE_KICK');
 assert.equal(h.run('M.ballState.ownerId'),h.run('M.ballOwner'));
 assert.equal(h.run('M.events.filter(e=>e.type==="kickoff").length'),1);
 h.run('advanceLive(5)');assert.equal(h.run('M.ballState.ownerId'),h.run('M.ballOwner'));
});
test('return fixture uses identical opponent identities after growth and save',()=>{
 const h=harness();h.run('S=fresh();init()');
 const opponent=h.run('S.leagueSchedule[0].find(g=>g.home==="Anadolu Hisarı"||g.away==="Anadolu Hisarı")');
 const name=opponent.home==='Anadolu Hisarı'?opponent.away:opponent.home;
 const identities=h.run(`S.opponentSquads[${JSON.stringify(name)}].map(p=>p.id)`);
 h.run('evolveOpponentSquads(0);evolveOpponentSquads(16);S.fixture=17;save()');
 const reopened=harness(h.storage);
 const second=reopened.run('S.leagueSchedule[17].find(g=>g.home==="Anadolu Hisarı"||g.away==="Anadolu Hisarı")');
 assert.equal(second.home==='Anadolu Hisarı'?second.away:second.home,name);
 assert.deepEqual(Array.from(reopened.run(`S.opponentSquads[${JSON.stringify(name)}].map(p=>p.id)`)),Array.from(identities));
});
test('forced injury substitution follows player ID and permits out-of-position CAM to CB',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();S.players[11].injury=1;M.requiredSubstitution={playerId:11,reason:"injury",state:"SUBSTITUTION_REQUIRED"};M.pause=true;M.reason="injury";M.lifecycle="PAUSED";subUI()');
 assert.equal(h.run('window.OUT'),11);
 assert.equal(h.run('doSub(4)'),true);
 assert.equal(h.run('M.active.includes(11)'),false);
 assert.equal(h.run('M.active.includes(4)'),true);
 assert.equal(h.run('M.requiredSubstitution'),null);
 assert.ok(h.run('M.positionSuitability[4]')<1);
 assert.match(h.app.innerHTML,/DEĞİŞİKLİK TAMAMLANDI/);
 assert.ok(h.confirms.at(-1).includes('YİNE DE OYNAT'));
 h.run('resumeLive();advanceLive(1)');assert.equal(h.run('M.pause'),false);assert.ok(h.run('M.clockSeconds')>0);
});
test('forced injury resolves by injured player ID for natural, CM and ST replacements only after commit',()=>{
 const scenario=(replacementId,natural=false)=>{
  const h=harness();h.run('S=fresh();init();startMatch();S.players[11].injury=1;M.requiredSubstitution={playerId:11,reason:"injury",state:"SUBSTITUTION_REQUIRED"};M.pause=true;M.reason="injury";M.lifecycle="PAUSED"');
  if(natural)h.run(`S.players[${replacementId}].pos="CAM"`);
  h.run('resumeLive()');assert.equal(h.run('M.pause'),true);assert.ok(h.alerts.at(-1).includes('Sakatlanan'));
  h.run('subUI()');assert.equal(h.run('M.requiredSubstitution.playerId'),11);assert.ok(h.run('M.active.includes(11)'));
  assert.equal(h.run(`doSub(${replacementId})`),true);assert.equal(h.run('M.requiredSubstitution'),null);
  assert.equal(h.run('M.active.includes(11)'),false);assert.equal(h.run(`M.active.includes(${replacementId})`),true);
  assert.equal(h.run('M.reason'),'manual');assert.doesNotMatch(h.storage.get('msv4'),/"requiredSubstitution":\{"playerId":11/);
  h.run('resumeLive()');assert.equal(h.run('M.pause'),false);
 };
 scenario(4,true);scenario(8);scenario(13);
});
test('90:00 finalization stops event production, animation queue and result can settle once',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();M.min=89;M.clockSeconds=5340;M.pause=false;M.reason="";M.lifecycle="RUNNING_SECOND_HALF";advanceLive(1)');
 assert.equal(h.run('M.clockSeconds'),5400);assert.equal(h.run('M.lifecycle'),'FINISHED');
 assert.equal(h.run('M.finished'),true);assert.equal(h.run('pitchV73.queue.length'),0);
 const before=h.run('M.events.length'),score=h.run('[M.hg,M.ag]'),ball=h.run('JSON.stringify(pitchV73.ball)'),positions=h.run('JSON.stringify(pitchV73.positions)');
 h.run('advanceLive(300);matchEvent("pass","invalid");paintLivePitch()');
 assert.equal(h.run('M.events.length'),before);assert.deepEqual(Array.from(h.run('[M.hg,M.ag]')),Array.from(score));assert.equal(h.run('JSON.stringify(pitchV73.ball)'),ball);assert.equal(h.run('JSON.stringify(pitchV73.positions)'),positions);
 h.run('finishMatch();finishMatch()');assert.equal(h.run('S.results.length'),1);assert.equal(h.run('S.table.reduce((n,x)=>n+x.p,0)'),18);
});
test('team tactics change pitch positions, pressure and seeded engine effects immediately',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 const normal=h.run('pitchInstructionTarget(11,"user",[55,50],"user")[0]');
 h.run('setMatchTactic("mentality","Cesur")');const forward=h.run('pitchInstructionTarget(11,"user",[55,50],"user")[0]');
 assert.ok(forward>normal+4);assert.ok(h.run('tacticalEffects().attack')>1);assert.ok(h.run('tacticalEffects().frequency')>1);
 h.run('setMatchTactic("mentality","Temkinli")');assert.ok(h.run('pitchInstructionTarget(11,"user",[55,50],"user")[0]')<normal-4);
 h.run('setMatchTactic("press","Yüksek")');const pressure=h.run('pitchInstructionTarget(6,"user",[48,51],"opp")');
 assert.ok(h.run('tacticalEffects().fatigue')>1.2);
 h.run('setMatchTactic("press","Düşük")');const passive=h.run('pitchInstructionTarget(6,"user",[48,51],"opp")');
 assert.notDeepEqual(Array.from(pressure),Array.from(passive));
 h.run('setMatchTactic("line","Önde")');const high=h.run('pitchInstructionTarget(2,"user",[55,50],"opp")[0]');
 h.run('setMatchTactic("line","Geride")');assert.ok(high>h.run('pitchInstructionTarget(2,"user",[55,50],"opp")[0]')+12);
 h.run('setMatchTactic("width","Geniş")');const wide=h.run('pitchInstructionTarget(10,"user",[55,50],"user")[1]');
 h.run('setMatchTactic("width","Dar")');const narrow=h.run('pitchInstructionTarget(10,"user",[55,50],"user")[1]');assert.ok(Math.abs(wide-50)>Math.abs(narrow-50));
 const distribution=style=>h.run(`M.passingStyle=${JSON.stringify(style)};M.rand=R(9123);Array.from({length:50},()=>{const id=choosePassTarget('user',6),a=eventPoint(6,'user'),b=eventPoint(id,'user');return Math.hypot(a[0]-b[0],a[1]-b[1])}).reduce((a,b)=>a+b,0)/50`);
 assert.ok(distribution('Direkt')>distribution('Kısa')+5);
 assert.equal(h.run('M.min'),0);
});
test('conversation response changes trust and happiness with personality, then persists on V7.3.1 migration',()=>{
 const h=harness();h.run('S=fresh();init();S.players[11].personality="Sensitive";S.players[3].personality="Lider";S.event={kind:"press",title:"Basın",text:"?",choices:[["Güven","pressTrust"]]};save()');
 const old=JSON.parse(h.storage.get('msv4'));old.version='7.3.1';delete old.v732;for(const p of old.players)delete p.managerTrust;
 h.storage.set('msv4',JSON.stringify(old));const migrated=harness(h.storage);
 const initial=migrated.run('S.players[11].managerTrust');
 migrated.run('applyConversationEffect("press","pressDemand")');
 assert.ok(migrated.run('S.players[11].managerTrust')<initial);
 assert.ok(migrated.run('S.players[3].managerTrust')>initial);
 assert.ok(migrated.run('S.players[11].pressure')>50);assert.ok(migrated.run('S.players[3].motivation')>50);
 migrated.run('save()');const reopened=harness(migrated.storage);
 assert.equal(reopened.run('S.players[11].managerTrust'),initial-1);
 assert.ok(reopened.run('S.players[11].pressure')>50);
 assert.equal(reopened.run('S.v732.conversationHistory.length'),1);
 assert.ok(reopened.storage.get('msv4-v731-backup'));
});
test('injury at halftime remains resolvable without skipping halftime side switch',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();M.min=45;M.clockSeconds=2700;M.pause=true;M.reason="half";M.lifecycle="HALF_TIME";S.players[11].injury=1;M.requiredSubstitution={playerId:11,reason:"injury",state:"SUBSTITUTION_REQUIRED"}');
 h.run('startSecondHalf()');assert.equal(h.run('M.reason'),'half');assert.match(h.alerts.at(-1),/Sakatlanan/);
 h.run('window.OUT=11;doSub(4)');assert.equal(h.run('M.reason'),'half');assert.equal(h.run('M.requiredSubstitution'),null);
 h.run('startSecondHalf()');assert.equal(h.run('M.secondHalf'),true);assert.equal(h.run('M.lifecycle'),'RUNNING_SECOND_HALF');
});
test('authoritative second stamps events; stale 02:00 animation cannot replay under 07:56',()=>{
 // the test wipes M.events, so it needs a fixture that is still goalless at 07:56 (otherwise score and goal events legitimately disagree)
 let h;for(let fixture=0;fixture<34;fixture++){h=harness();h.run(`S=fresh();init();S.fixture=${fixture};startMatch();advanceLive(476/90)`);if(h.run('M.hg+M.ag')===0)break;}
 assert.equal(h.run('matchClock()'),'07:56');
 h.run('M.events=[];M.story=[];matchEvent("pass","Eski etiket",{gameSecond:120,minute:2})');
 assert.equal(h.run('M.events.at(-1).gameSecond'),476);
 assert.equal(h.run('M.events.at(-1).minute'),7);
 h.run('const state=currentPitchState();state.active={type:"pass",gameSecond:120,fromPos:[20,50],toPos:[60,50]};state.queue=[{type:"shot",gameSecond:120},{type:"pass",gameSecond:460}];synchronizePitchPresentation(state)');
 assert.ok(h.run('pitchV73.active===null||pitchV73.active.type==="presentationSync"'));
 assert.deepEqual(Array.from(h.run('pitchV73.queue.map(e=>e.gameSecond)')),[460]);
 assert.equal(h.run('matchSyncDebug().invariant'),true);
});
test('presentation catch-up and GOAL never snap an in-flight ball to its destination',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();M.pause=false;M.reason="";M.lifecycle="RUNNING"');
 h.run('const s=currentPitchState();s.ball=[10,40];s.ballState.position=[10,40];s.active={type:"pass",eventId:50,gameSecond:0,fromPos:[10,40],toPos:[70,60]};s.progress=.35;s.eventStartBall=[10,40];matchEvent("goal","⚽ GOL!",{side:0,scorer:"Aras",toPos:[98,50]})');
 assert.deepEqual(Array.from(h.run('pitchV73.ball')),[10,40]);
 assert.equal(h.run('pitchV73.active.type'),'pass');
 h.run('pitchV73.active.gameSecond=-200;M.matchElapsedSeconds=300;synchronizePitchPresentation(pitchV73)');
 assert.equal(h.run('pitchV73.active.type'),'presentationSync');
 const start=Array.from(h.run('pitchV73.ball'));
 h.run('advancePitchPresentation(.05,1000)');const middle=Array.from(h.run('pitchV73.ball'));
 assert.notDeepEqual(middle,start);assert.notDeepEqual(middle,Array.from(h.run('M.ballState.position')));
});
test('pass, long ball, shot and dribble presentation durations stay visible at every speed',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 for(const speed of [.5,1,2]){
  h.run(`M.speed=${speed}`);
  const short=h.run('eventAnimationTime({type:"pass",fromPos:[20,50],toPos:[28,50],fromId:11,fromSide:"user"})');
  const long=h.run('eventAnimationTime({type:"pass",travelType:"aerial",fromPos:[20,25],toPos:[72,70],fromId:11,fromSide:"user"})');
  const shot=h.run('eventAnimationTime({type:"shot",fromPos:[78,50],toPos:[98,50]})');
  assert.ok(short>=.25&&short<=.65);assert.ok(long>=.55&&long<=.9);assert.ok(shot>=.28&&shot<=.5);
 }
 h.run('const s=currentPitchState();s.ball=[30,45];s.ballState.position=[30,45];s.active={type:"ballCarry",gameSecond:0,fromId:11,fromSide:"user",fromPos:[30,45],toPos:[48,50]};s.progress=.2;s.eventStartBall=[30,45];s.positions[String(11)]=[30,45];pitchFrameState(.08,1000)');
 const ball=Array.from(h.run('pitchV73.ball')),carrier=Array.from(h.run('pitchV73.positions[String(11)]'));
 const carryGap=Math.hypot(ball[0]-carrier[0],ball[1]-carrier[1]);
 assert.ok(carryGap<4,`dribble gap ${carryGap}`);
});
test('GOAL event changes score and commentary atomically, independent of presentation queue',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();advanceLive(2)');
 h.run('const state=currentPitchState();state.queue=[{type:"pass",gameSecond:0}];matchEvent("goal","⚽ GOL!",{side:0,scorer:"Aras",toPos:[98,50]});render()');
 assert.equal(h.run('M.hg'),1);assert.equal(h.run('M.events.at(-1).homeGoals'),1);
 assert.equal(h.run('M.events.at(-1).gameSecond'),180);
 assert.match(h.app.innerHTML,/1–0/);assert.ok(h.run('liveCommentaryLines().some(x=>x.includes("GOL"))'));
 assert.equal(h.run('pitchV73.queue.some(e=>e.gameSecond===0)'),false);
 assert.equal(h.run('matchSyncDebug().invariant'),true);
});
test('0.5×, 1× and 2× produce identical gameSecond timeline and scores with one seed',()=>{
 const signatures=[];
 for(const speed of [.5,1,2]){
  const h=harness();h.run('S=fresh();init();startMatch()');h.run(`setMatchSpeed(${speed});advanceLive(${30/speed})`);
  assert.equal(h.run('M.matchElapsedSeconds'),2700);
  signatures.push(JSON.stringify(h.run('({score:[M.hg,M.ag],events:M.events.map(e=>[e.type,e.gameSecond,e.homeGoals,e.awayGoals])})')));
  assert.ok(h.run('M.events.every(e=>e.gameSecond<=M.matchElapsedSeconds)'));
 }
 assert.equal(signatures[0],signatures[1]);assert.equal(signatures[1],signatures[2]);
});
test('pause at 23:41, injury and position warning never accumulate wall-time or advance visual action',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();advanceLive(1421/90);pauseLive()');
 const before=h.run('M.matchElapsedSeconds'),eventCount=h.run('M.events.length');
 h.run('const state=currentPitchState();state.active={type:"pass",gameSecond:1421,fromPos:[35,45],toPos:[55,45]};state.progress=.3');
 h.run('advanceLive(10);pitchFrameState(10,50000)');
 assert.equal(h.run('M.matchElapsedSeconds'),before);assert.equal(h.run('M.events.length'),eventCount);assert.equal(h.run('pitchV73.progress'),.3);
 h.run('resumeLive()');assert.equal(h.run('M.matchElapsedSeconds'),before);
 h.run('S.players[11].injury=1;M.requiredSubstitution={playerId:11,reason:"injury",state:"SUBSTITUTION_REQUIRED"};pauseLive("injury");window.OUT=11;subUI()');
 h.run('advanceLive(10)');assert.equal(h.run('M.matchElapsedSeconds'),before);
 h.run('doSub(4)');assert.ok(h.confirms.at(-1).includes('YİNE DE OYNAT'));
 assert.equal(h.run('M.matchElapsedSeconds'),before);
 h.run('resumeLive()');assert.equal(h.run('M.matchElapsedSeconds'),before);
 h.run('advanceLive(1/90)');assert.ok(h.run('M.matchElapsedSeconds')>before);
});
test('halftime and fulltime lock the single clock and stop all later football events',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();advanceLive(30)');
 assert.equal(h.run('M.matchElapsedSeconds'),2700);assert.equal(h.run('M.lifecycle'),'HALF_TIME');
 const halfCount=h.run('M.events.length');h.run('advanceLive(40)');assert.equal(h.run('M.events.length'),halfCount);
 h.run('startSecondHalf();advanceLive(30)');assert.equal(h.run('M.matchElapsedSeconds'),5400);assert.equal(h.run('M.lifecycle'),'FINISHED');
 const fullCount=h.run('M.events.length');h.run('advanceLive(40);matchEvent("goal","GOL",{side:0})');
 assert.equal(h.run('M.events.length'),fullCount);assert.equal(h.run('M.matchElapsedSeconds'),5400);
 assert.equal(h.run('matchSyncDebug().invariant'),true);
});
test('legacy V7.3.2 match clock migrates without a second serialized clock',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();advanceLive(2.61);pauseLive();save()');
 const legacy=JSON.parse(h.storage.get('msv4'));legacy.activeMatchV71.clockSeconds=legacy.activeMatchV71.matchElapsedSeconds;delete legacy.activeMatchV71.matchElapsedSeconds;
 h.storage.set('msv4',JSON.stringify(legacy));const loaded=harness(h.storage);
 assert.equal(loaded.run('M.matchElapsedSeconds'),legacy.activeMatchV71.clockSeconds);
 loaded.run('save()');const snapshot=JSON.parse(loaded.storage.get('msv4')).activeMatchV71;
 assert.equal(snapshot.matchElapsedSeconds,legacy.activeMatchV71.clockSeconds);
 assert.equal(Object.hasOwn(snapshot,'clockSeconds'),false);
});
test('background frame pauses match and resumed delta starts fresh',()=>{
 const h=harness();h.run('window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};S=fresh();init();startMatch();advanceLive(2)');
 h.run('document.hidden=true;liveFrameStep(300000)');
 assert.equal(h.run('M.reason'),'background');assert.equal(h.run('M.pause'),true);
 const before=h.run('M.matchElapsedSeconds');h.run('document.hidden=false;resumeLive();liveFrameStep(999999)');
 assert.equal(h.run('M.matchElapsedSeconds'),before);
});
test('club atmosphere resolves career, stadium and scoring identities independently without changing saved gameplay',()=>{
 const h=harness();h.run('S=fresh();init();S.currentClubId="Ormanşehir";save();render()');
 assert.equal(h.run('resolveClubIdentity("career").id'),'Ormanşehir');
 assert.match(h.app.innerHTML,/ORMANŞEHİR GAZETESİ/);
 assert.match(h.app.innerHTML,/goal-club-17\.webp/);
 assert.equal(h.run('resolveClubIdentity("stadium",{homeTeam:"Anadolu Hisarı"}).id'),'Anadolu Hisarı');
 assert.equal(h.run('resolveClubIdentity("awaySupporters",{awayTeam:"Ormanşehir"}).id'),'Ormanşehir');
 assert.equal(h.run('resolveClubIdentity("goal",{teamId:"Ormanşehir"}).secondaryColor'),'#eee');
 assert.equal(h.run('resolveClubIdentity("goal",{teamId:"Anadolu Hisarı"}).primaryColor'),'#f3c623');
 const restored=harness(h.storage);assert.equal(restored.run('resolveClubIdentity("career").id'),'Ormanşehir');
 assert.equal(restored.run('S.table.length'),18);
 assert.match(restored.run("clubProps('career',{kind:'signing'})"),/club-emblem/);
 for(const kind of ['press','locker'])
  assert.doesNotMatch(restored.run(`clubProps('career',{kind:'${kind}'})`),/club-emblem|crest/);
 for(const kind of ['office','stadium','training','fans','goal','away'])
  assert.equal(restored.run(`clubProps('career',{kind:'${kind}'})`),'');
 assert.equal(restored.run('officePhoto("Ormanşehir")'),'assets/atmosphere/office-club-17.webp');
 assert.equal(restored.run('fanPhoto("Ormanşehir")'),'assets/atmosphere/goal-club-17.webp');
 assert.equal(restored.run('fanPhoto("Anadolu Hisarı")'),'assets/atmosphere/goal-club-0.webp');
 restored.run('delete S.currentClubId;save()');const legacy=harness(restored.storage);
 assert.equal(legacy.run('resolveClubIdentity("career").id'),'Anadolu Hisarı');
 assert.equal(restored.run('resolveClubIdentity("goal",{teamId:"Unknown"}).primaryColor'),'#55646b');
 assert.equal(restored.run('Object.keys(CLUBSTYLE).length'),18);
});
test('goal presentation takes scoring side and deterministic scene without recoloring the photo',()=>{
 const h=harness();h.run('S=fresh();init();startMatch();M.home="Ormanşehir";M.away="Anadolu Hisarı";M.userHome=false');
 h.run('enqueuePitchEvent({type:"goal",side:0,gameSecond:123,minute:2,scorer:"Kaya"})');
 assert.equal(h.run('pitchV73.goalTeam'),'Ormanşehir');assert.equal(h.run('pitchV73.goalColors[0]'),'#235c2b');
 assert.equal(h.run('pitchV73.goalVariant'),3);
 h.run('enqueuePitchEvent({type:"goal",side:1,gameSecond:123,minute:2,scorer:"Aras"})');
 assert.equal(h.run('pitchV73.goalTeam'),'Anadolu Hisarı');assert.equal(h.run('pitchV73.goalColors[0]'),'#f3c623');
 const css=fs.readFileSync(path.join(base,'style.css'),'utf8');
 assert.doesNotMatch(css,/mix-blend-mode|background-blend-mode|hue-rotate|sepia\(/);
 assert.doesNotMatch(css,/\.club-flag|\.club-scarf|\.club-pennant|\.club-kit/);
 assert.doesNotMatch(h.run("clubProps('goal',{teamId:'Ormanşehir'})"),/club-flag|club-scarf/);
 for(let i=0;i<18;i++)assert.ok(fs.statSync(path.join(base,'assets/atmosphere',`goal-club-${i}.webp`)).size>40000);
 for(let i=0;i<18;i++)assert.ok(fs.statSync(path.join(base,'assets/atmosphere',`office-club-${i}.webp`)).size>40000);
 assert.doesNotMatch(css,/\.club-props--(press|locker) \.club-emblem/);
 assert.match(css,/\.club-props--signing \.club-emblem[^}]+height:40%/);
 const {execFileSync}=require('node:child_process');
 execFileSync('python',['-c',`from PIL import Image
from pathlib import Path
p=Path('${base}/assets/atmosphere')
a,b=[Image.open(p/f'goal-club-{i}.webp').convert('RGB') for i in (0,17)]
assert a.size==b.size
assert sum(abs(x-y) for x,y in zip(a.getpixel((500,120)),b.getpixel((500,120))))>70 # photographed scarf changes
assert sum(abs(x-y) for x,y in zip(a.getpixel((500,300)),b.getpixel((500,300))))<10 # skin stays natural
assert sum(abs(x-y) for x,y in zip(a.getpixel((500,570)),b.getpixel((500,570))))>60 # jersey changes too
c,d=[Image.open(p/f'office-club-{i}.webp').convert('RGB') for i in (0,17)]
assert sum(abs(x-y) for x,y in zip(c.getpixel((460,175)),d.getpixel((460,175))))>35
assert sum(abs(x-y) for x,y in zip(c.getpixel((830,210)),d.getpixel((830,210))))>35
assert sum(abs(x-y) for x,y in zip(c.getpixel((700,175)),d.getpixel((700,175))))<10 # wall untouched
`]);
 for(const name of ['fans-neutral','fans-day','fans-rain','fans-night','locker-base','press-base','signing-base','stadium-base','training-base','office-base','facilities-base'])
  assert.ok(fs.existsSync(path.join(base,'assets/atmosphere',name+'.webp')),name);
});
test('carried positions survive turnovers, committed overlap and recovery use movement bounds',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run(`window.RB=M.active.find(id=>M.matchRoles[id]==='RB');M.orderKeys[RB]='overlap';
 M.dynamicPositions[String(RB)]=[60,85];M.pitchMotion={};M.min=15;
 M.ballSide='user';M.ballOwner=RB;setBallState([60,85],RB);evolvePitchPositions();`);
 const advanced=h.run('eventPoint(RB,"user")');
 assert.ok(advanced[0]>60,'fullback commits forward');
 h.run(`M.ballSide='opp';M.ballOwner='o7';setBallState([55,84],'o7');M.min=16;evolvePitchPositions()`);
 const afterLoss=h.run('eventPoint(RB,"user")');
 assert.ok(Math.abs(afterLoss[0]-advanced[0])<15,'no instant return to home position');
 h.run('M.min=20;evolvePitchPositions()');
 const recovered=h.run('eventPoint(RB,"user")');
 assert.ok(Math.abs(recovered[0]-afterLoss[0])<15,'recovery remains speed bounded');
 assert.notEqual(JSON.stringify(recovered),JSON.stringify(h.run('basePitchPosition(RB,"user")')));
});
test('1v1 uses real defender position and leaves loser at the duel location',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run(`M.dynamicPositions[12]=[65,50];M.oppIds.forEach(id=>M.dynamicPositions[id]=[15,15]);
 M.dynamicPositions.o2=[72,50];setUserOwner(12);M.rand=()=>.99;
 window.start=eventPoint(12,'user');pitchDribble(12,'user',currentOpponent());`);
 const end=h.run('eventPoint(12,"user")');
 assert.ok(end[0]>65,'dribbler advanced');
 assert.equal(h.run('M.ballSide'),'opp');
 assert.ok(Math.abs(h.run('M.ballState.position[0]')-end[0])<.001,'turnover starts at duel');
 assert.ok(h.run('M.events.some(e=>e.type===\'dribble\'&&!e.success)'));
 h.run('M.min=1;evolvePitchPositions()');
 assert.ok(Math.abs(h.run('eventPoint(12,"user")[0]')-end[0])<15,'loser recovers from current position');
});
test('pass lanes, roles and opponent score change the same engine decisions',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 const defaultOptions=h.run('passOptions("user",M.ballOwner,M.passingStyle).map(x=>[x.id,x.weight])');
 assert.ok(defaultOptions.length>=8);
 h.run('M.width="Geniş"');
 const wide=h.run('passOptions("user",M.ballOwner,M.passingStyle).map(x=>[x.id,x.weight])');
 const wing=h.run('M.active.find(id=>["LW","RW"].includes(M.matchRoles[id]))');
 assert.ok(wide.find(x=>x[0]===wing)[1]>defaultOptions.find(x=>x[0]===wing)[1]);
 h.run('M.min=75;M.hg=2;M.ag=0');
 assert.ok(h.run('opponentAttitude().risk')>1);
 h.run('M.hg=0;M.ag=3');
 assert.ok(h.run('opponentAttitude().risk')<1);
});
test('club imagery chooses photographed shirts and scarves by scoring team',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 assert.notEqual(h.run('fanPhoto(M.home)'),h.run('fanPhoto(M.away)'));
 assert.match(h.run('fanPhoto(M.away)'),/goal-club-\d+\.webp$/);
 assert.match(h.run('officePhoto(managedClubName())'),/office-club-\d+\.webp$/);
 h.run('M.min=5;M.matchElapsedSeconds=300;matchEvent("goal","Rakip gol attı",{side:1-userSide(),scorer:"Rakip"})');
 assert.equal(h.run('currentPitchState().goalTeam'),h.run('M.userHome?M.away:M.home'));
});
test('same duel roll separates skilled and tired dribbler against positioned defender',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run(`window.p=S.players.find(p=>p.id===12);window.d=opponentPlayer('o2');
 M.oppIds.forEach(id=>M.dynamicPositions[id]=[15,15]);M.dynamicPositions.o2=[72,50];
 M.dynamicPositions[12]=[65,50];p.dribbling=95;p.technique=95;p.acceleration=90;p.fitness=100;
 d.tackling=43;d.positioning=43;M.rand=()=>.5;setUserOwner(12);window.strong=pitchDribble(12,'user',currentOpponent());`);
 assert.equal(h.run('strong'),true);
 h.run(`M.dynamicPositions[12]=[65,50];M.dynamicPositions.o2=[72,50];
 p.dribbling=42;p.technique=42;p.acceleration=50;p.fitness=31;
 d.tackling=90;d.positioning=90;setUserOwner(12);window.weak=pitchDribble(12,'user',currentOpponent());`);
 assert.equal(h.run('weak'),false);
});
test('press and individual instruction tradeoffs alter positions and fatigue',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 const player=h.run('M.active.find(id=>M.matchRoles[id]==="RB")');
 h.run(`window.RB=${player};M.ballSide='user';M.ballOwner=RB;setBallState([60,85],RB);
 M.dynamicPositions[RB]=[60,85];M.min=13;M.orderKeys[RB]='overlap';evolvePitchPositions();`);
 const overlap=h.run('eventPoint(RB,"user")[0]');
 h.run(`M.dynamicPositions[RB]=[60,85];M.pitchMotion={};M.orderKeys[RB]='stay';M.min=13;evolvePitchPositions();`);
 assert.ok(overlap>h.run('eventPoint(RB,"user")[0]'));
 h.run('M.press="Yüksek"');const high=h.run('tacticalEffects().fatigue');
 h.run('M.press="Düşük"');assert.ok(high>h.run('tacticalEffects().fatigue'));
});
test('a scoreless twenty minute period still has coherent movement, pressure and ball ownership',()=>{
 // the seeded fixture must stay goalless for 20 minutes (a goal legitimately resets shape via kickoff)
 let h;for(let fixture=0;fixture<34;fixture++){h=harness();h.run(`S=fresh();init();S.fixture=${fixture};startMatch();advanceLive(13.35)`);if(h.run('M.hg+M.ag')===0)break;}
 assert.ok(h.run('M.min>=20'));
 assert.equal(h.run('M.hg+M.ag'),0);
 assert.ok(h.run('Object.keys(M.dynamicPositions).length>=20'));
 assert.ok(h.run('Object.values(M.dynamicPositions).every(q=>q.every(Number.isFinite))'));
 assert.equal(h.run('M.ballState.ownerId'),h.run('M.ballOwner'));
 assert.ok(h.run('M.events.some(e=>e.type==="offBallRun")'));
 assert.ok(h.run('M.events.some(e=>e.type==="press")'));
 assert.ok(h.run('M.events.some(e=>["ballCarry","dribble"].includes(e.type))'));
 const positions=h.run('M.active.map(id=>M.dynamicPositions[id])');
 assert.ok(new Set(positions.map(q=>Math.round(q[0])+":"+Math.round(q[1]))).size>7);
});
test('a successful first duel can continue against a different defender',()=>{
 const h=harness();h.run('S=fresh();init();startMatch()');
 h.run(`M.oppIds.forEach(id=>M.dynamicPositions[id]=[12,12]);
 M.dynamicPositions.o2=[70,50];M.dynamicPositions.o3=[84,38];
 M.dynamicPositions.o4=[84,50];M.dynamicPositions.o5=[84,62];M.dynamicPositions[12]=[65,50];
 const p=S.players.find(p=>p.id===12);p.dribbling=94;p.technique=94;p.fitness=100;
 opponentPlayer('o2').tackling=42;opponentPlayer('o3').tackling=42;
 M.rand=()=>.25;setUserOwner(12);
 window.first=pitchDribble(12,'user',currentOpponent());
 window.second=pitchDribble(12,'user',currentOpponent());`);
 assert.equal(h.run('first&&second'),true);
 assert.ok(h.run('M.events.filter(e=>e.type==="tackle"&&e.defenderId==="o2").length')>0);
 assert.ok(h.run('M.events.some(e=>e.type==="tackle"&&["o3","o4","o5"].includes(e.defenderId))'));
 assert.ok(h.run('eventPoint(12,"user")[0]')>78);
});

// ---- V7.3.5 restored presentation: home-team stadium, dual-colour locker/press ----
function layerStyle(html,kind){
 const m=html.match(new RegExp(`club-layers--${kind}" style="([^"]*)"`));
 return m?m[1]:null;
}
function setFixture(h,home,away){
 h.run(`S=fresh();init();ensureLeague();(function(){const g=S.leagueSchedule[S.fixture%34];const m=g.find(x=>x.home==='Anadolu Hisarı'||x.away==='Anadolu Hisarı');m.home=${JSON.stringify(home)};m.away=${JSON.stringify(away)}})();render()`);
}
function stadiumSection(h){const html=h.app.innerHTML;const start=html.indexOf('<section class=stadiumhero>');return html.slice(start,html.indexOf('</section>',start))}
test('scenario A: stadium identity comes from the home team when the managed club is home',()=>{
 const h=harness();setFixture(h,'Anadolu Hisarı','Kıyıspor');
 const style=layerStyle(stadiumSection(h),'stadium');
 assert.match(style,/--club-primary:#f3c623/);assert.match(style,/--club-secondary:#b3132b/);
 assert.match(stadiumSection(h),/Anadolu Hisarı/);
});
test('scenario B: away match shows the opponent home-team identity, never the managed club',()=>{
 const h=harness();setFixture(h,'Kıyıspor','Anadolu Hisarı');
 const section=stadiumSection(h),style=layerStyle(section,'stadium');
 assert.match(style,/--club-primary:#0b7285/);assert.match(style,/--club-secondary:#ffdd57/);
 assert.doesNotMatch(style,/#f3c623|#b3132b/);
 assert.match(section,/Kıyıspor Stadı/);
 assert.equal(h.run('stadiumProps(currentFixture().game)').includes('#f3c623'),false);
});
test('scenario C: an unrelated primary/secondary pair reaches the stadium, locker and both press rooms',()=>{
 const h=harness();setFixture(h,'Kadıköy Rüzgârı','Anadolu Hisarı');
 const stadium=layerStyle(stadiumSection(h),'stadium');
 assert.match(stadium,/--club-primary:#6a1b9a/);assert.match(stadium,/--club-secondary:#f7d117/);
 h.run('S.currentClubId="Marmara 1912";S.event={kind:"press",title:"Basın",text:"?",choices:[["Güven","pressTrust"]]};render()');
 const pre=layerStyle(h.app.innerHTML,'press');
 assert.match(pre,/--club-primary:#6a1b9a/);assert.match(pre,/--club-secondary:#f7d117/);
 h.run('S.event={kind:"postpress",title:"Maç Sonu",text:"?",choices:[["Güven","postTeam"]]};render()');
 assert.equal(layerStyle(h.app.innerHTML,'press'),pre,'pre- and post-match press share one identity path');
 h.run('S.event={kind:"matchday",title:"Maç günü",text:"?",choices:[["Devam","x"]]};render()');
 const locker=layerStyle(h.app.innerHTML,'locker');
 assert.match(locker,/--club-primary:#1746a2/);assert.match(locker,/--club-secondary:#ff7a00/);
 assert.doesNotMatch(h.app.innerHTML,/club-emblem/);
});
test('a missing or invalid colour never overwrites the other valid colour',()=>{
 const h=harness();
 const only2=h.run("clubLayers('press',{primaryColor:'bad',secondaryColor:'#123456'})");
 assert.match(only2,/--club-secondary:#123456/);assert.doesNotMatch(only2,/--club-primary/);
 const only1=h.run("clubLayers('locker',{primaryColor:'#abcdef'})");
 assert.match(only1,/--club-primary:#abcdef/);assert.doesNotMatch(only1,/--club-secondary/);
 assert.equal(h.run("clubProps('career',{kind:'stadium'})"),'');
});
test('club layers use plain masks over neutral bases: no tint, no blend, both colours present',()=>{
 const css=fs.readFileSync(path.join(base,'style.css'),'utf8');
 assert.doesNotMatch(css,/mix-blend-mode|background-blend-mode|hue-rotate|sepia\(/);
 for(const scene of ['press','locker','stadium'])for(const part of ['a','b','shade'])
  assert.ok(fs.existsSync(path.join(base,'assets/atmosphere',`${scene}-club-${part}.webp`)),`${scene}-${part}`);
 assert.match(css,/\.club-layer--a\{background:var\(--club-primary/);
 assert.match(css,/\.club-layer--b\{background:var\(--club-secondary/);
 const sw=fs.readFileSync(path.join(base,'sw.js'),'utf8');
 for(const scene of ['press','locker'])assert.match(sw,new RegExp(`${scene}-club-base\\.webp`));
 const {execFileSync}=require('node:child_process');
 execFileSync('python',['-c',`from PIL import Image
from pathlib import Path
p=Path('${base}/assets/atmosphere')
def px(n,x,y): return Image.open(p/n).convert('RGBA').getpixel((x,y))
def spread(c): return max(c[:3])-min(c[:3])
# neutral bases carry no baked club colour on the painted surfaces
assert spread(px('press-club-base.webp',300,250))<25 and spread(px('press-club-base.webp',1200,250))<25
assert spread(px('locker-club-base.webp',110,90))<25
# primary and secondary masks cover different surfaces
assert px('press-club-a.webp',300,250)[3]>200 and px('press-club-a.webp',1200,250)[3]<20
assert px('press-club-b.webp',1200,250)[3]>200 and px('press-club-b.webp',300,250)[3]<20
assert px('locker-club-a.webp',110,90)[3]>200 and px('locker-club-b.webp',1400,50)[3]>200
assert px('locker-club-a.webp',100,300)[3]<20  # wood stays wood
assert px('stadium-club-a.webp',100,350)[3]>100 or px('stadium-club-b.webp',100,350)[3]>100  # pitch-side boards
assert px('stadium-club-a.webp',700,450)[3]<5 and px('stadium-club-b.webp',700,450)[3]<5  # grass untouched
`]);
});

test('press scenes take colours from the home team of their own match and show no logo',()=>{
 const h=harness();setFixture(h,'Kıyıspor','Anadolu Hisarı');
 h.run('S.event={kind:"press",title:"Basın",text:"?",choices:[["Güven","pressTrust"]]};render()');
 let s=layerStyle(h.app.innerHTML,'press');
 assert.match(s,/--club-primary:#0b7285/);assert.match(s,/--club-secondary:#ffdd57/);
 const i=h.app.innerHTML.indexOf('class=eventvisual');
 assert.ok(i>0);assert.doesNotMatch(h.app.innerHTML.slice(i,i+900),/club-emblem|class="crest"|class=crest/);
 // post-match: fixture already advanced, so the home team must come from the match just played
 h.run('S.v71=S.v71||{};S.v71.lastMatch={home:"Kadıköy Rüzgârı",away:"Anadolu Hisarı",hg:1,ag:0};S.event={kind:"postpress",title:"Maç Sonu",text:"?",choices:[["Güven","postTeam"]]};render()');
 s=layerStyle(h.app.innerHTML,'press');
 assert.match(s,/--club-primary:#6a1b9a/);assert.match(s,/--club-secondary:#f7d117/);
 assert.doesNotMatch(h.app.innerHTML,/club-emblem/);
});
